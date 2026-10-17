import {showImportStatus,controlShowImport} from './show-import';
import {CATEGORIES} from './room-data';
import {parseNewsletterFeed} from './newsletter';
export class ServiceError extends Error{constructor(message:string,public status=400){super(message);}}
export type Visitor={admin:boolean;account:{email:string;userId:string;displayName:string}|null;userId:string|null;ipHash:string;verified:boolean};
type Dependencies={checkText:(s:string)=>Promise<void>;rate:(key:string,limit:number,windowMs?:number)=>Promise<void>;log:(actor:string,action:string,detail:string)=>Promise<void>};
const reply=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
const field=(v:unknown,max:number,required=false)=>{if(typeof v!=='string'||v.length>max||(required&&!v.trim()))throw new ServiceError('Check the text and character limits.');return v.trim();};
async function config(database:D1Database,key:string,fallback='[]'){const row=await database.prepare('SELECT value FROM settings WHERE key=?').bind(key).first<{value:string}>();try{return JSON.parse(row?.value||fallback);}catch{return JSON.parse(fallback);}}
export async function canModerate(who:Visitor,database:D1Database){return who.admin||!!who.account&&(await config(database,'chatModerators')).includes(who.account.email.toLowerCase());}
const chatTouch=(database:D1Database,roomId:string)=>database.prepare('UPDATE rooms SET chatRevision=chatRevision+1 WHERE id=?').bind(roomId);
const digest=async(v:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))).map(v=>v.toString(16).padStart(2,'0')).join('');
export async function roomServices(req:Request,url:URL,path:string,b:any,who:Visitor,database:D1Database,deps:Dependencies):Promise<Response|null>{
 const time=Date.now();
 if(req.method==='GET'&&path==='chat'){
   const roomId=field(url.searchParams.get('room'),100,true);
   if(!await database.prepare('SELECT id FROM rooms WHERE id=?').bind(roomId).first())throw new ServiceError('Room not found.',404);
   const rows=(await database.prepare("SELECT id,userId,author,role,body,createdAt FROM chat_messages WHERE roomId=? AND status='visible' ORDER BY createdAt DESC,id DESC LIMIT 100").bind(roomId).all<{id:string;userId:string;author:string;role:string;body:string;createdAt:number}>()).results;
   const mute=who.userId?await database.prepare('SELECT MAX(until) until FROM chat_mutes WHERE roomId=? AND (userId=? OR ipHash=?) AND until>?').bind(roomId,who.userId,who.ipHash,time).first<{until:number}>():null;
   return reply({messages:rows.reverse().map(({userId,...row})=>({...row,own:userId===who.userId})),muteUntil:mute?.until||0,canModerate:await canModerate(who,database),suggestedName:who.admin?'Ryan':`Guest ${who.userId?.slice(-4)||''}`});
 }
 if(req.method==='GET'&&path==='chat/admin'){
   if(!who.admin)throw new ServiceError('Admin access required.',403);
   const mutes=(await database.prepare('SELECT id,roomId,author,until,reason FROM chat_mutes WHERE until>? ORDER BY until DESC LIMIT 100').bind(time).all()).results;
   return reply({mutes,moderators:await config(database,'chatModerators')});
 }
 if(req.method==='GET'&&path==='newsletter/automation'){
   if(!who.admin)throw new ServiceError('Admin access required.',403);
   const roomId=field(url.searchParams.get('room'),100,true);
   return reply(await showImportStatus(database,roomId));
 }
 if(req.method==='GET'&&path==='newsletter'){
   if(!who.admin)throw new ServiceError('Admin access required.',403);
   const cached=await config(database,'newsletterLatest','null');if(cached?.expires>time)return reply(cached.newsletter);
   let response:Response;try{response=await fetch('https://tbpn.substack.com/feed',{signal:AbortSignal.timeout(8000),headers:{Accept:'application/rss+xml'}});}catch{throw new ServiceError('The newsletter feed is unavailable. Paste the run-of-show instead.',503);}
   if(!response.ok)throw new ServiceError('The newsletter feed is unavailable. Paste the run-of-show instead.',503);
   const xml=await response.text();if(xml.length>2000000)throw new ServiceError('The newsletter feed is too large. Use the paste box.',503);
   const newsletter=parseNewsletterFeed(xml);if(!newsletter)throw new ServiceError('The latest issue could not be read. Paste its topics instead.',503);
   await database.prepare("INSERT INTO settings (key,value) VALUES ('newsletterLatest',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(JSON.stringify({expires:time+60000,newsletter})).run();
   return reply(newsletter);
 }
 if(req.method!=='POST')return null;
 if(path==='chat'){
   const roomId=field(b.roomId,100,true),body=field(b.body,500,true),author=field(b.author||'Guest',30,true),id=field(b.clientId,36,true);
   if(!/^[a-f0-9-]{36}$/.test(id))throw new ServiceError('Invalid message identifier.');
   await deps.checkText(body+' '+author);
   if(!await database.prepare('SELECT id FROM rooms WHERE id=?').bind(roomId).first())throw new ServiceError('Room not found.',404);
   const existing=await database.prepare('SELECT userId,body FROM chat_messages WHERE id=?').bind(id).first<{userId:string;body:string}>();
   if(existing){if(existing.userId!==who.userId||existing.body!==body)throw new ServiceError('Please retry this message.',409);return reply({ok:true,id});}
   await deps.rate('chat:'+who.userId,15);await deps.rate('chat-network:'+who.ipHash,45);
   const role=who.admin?'admin':await canModerate(who,database)?'moderator':'member';
   const results=await database.batch([
     database.prepare("INSERT INTO chat_messages (id,roomId,userId,ipHash,author,role,body,status,createdAt) SELECT ?,?,?,?,?,?,?,'visible',? WHERE NOT EXISTS (SELECT 1 FROM chat_mutes WHERE roomId=? AND (userId=? OR ipHash=?) AND until>?) RETURNING id").bind(id,roomId,who.userId,who.ipHash,author,role,body,time,roomId,who.userId,who.ipHash,time),
     database.prepare('UPDATE rooms SET chatRevision=chatRevision+1 WHERE id=? AND EXISTS (SELECT 1 FROM chat_messages WHERE id=?)').bind(roomId,id)
   ]);
   if(!results[0].results.length)throw new ServiceError('You are temporarily muted in this room.',403);
   return reply({ok:true,id},201);
 }
 if(path==='chat/moderate'){
   const message=await database.prepare('SELECT id,roomId,userId,ipHash,author,role FROM chat_messages WHERE id=?').bind(field(b.id,36,true)).first<{id:string;roomId:string;userId:string;ipHash:string;author:string;role:string}>();
   if(!message)throw new ServiceError('Message not found.',404);
   const moderate=await canModerate(who,database);
   if(b.action==='hide'){
     if(!moderate&&message.userId!==who.userId)throw new ServiceError('Moderator access required.',403);
     await database.batch([database.prepare("UPDATE chat_messages SET status='hidden' WHERE id=?").bind(message.id),chatTouch(database,message.roomId)]);
   }else if(b.action==='mute'){
     if(!moderate)throw new ServiceError('Moderator access required.',403);
     if(message.role==='admin'||(!who.admin&&message.role==='moderator'))throw new ServiceError('This role cannot be muted by your account.',403);
     const minutes=Number(b.minutes);if(![5,60,1440].includes(minutes))throw new ServiceError('Choose a 5-minute, 1-hour, or 24-hour mute.');
     const reason=field(b.reason||'Room moderation',200);
     await database.batch([database.prepare('INSERT INTO chat_mutes (id,roomId,userId,ipHash,author,until,reason) VALUES (?,?,?,?,?,?,?) ON CONFLICT(roomId,userId) DO UPDATE SET until=excluded.until,reason=excluded.reason').bind(crypto.randomUUID(),message.roomId,message.userId,message.ipHash,message.author,time+minutes*60000,reason),chatTouch(database,message.roomId)]);
   }else throw new ServiceError('Unknown moderation action.');
   await deps.log(who.account?.email||who.userId!,'chat:'+b.action,message.id);return reply({ok:true});
 }
 if(path==='chat/admin'){
   if(!who.admin)throw new ServiceError('Admin access required.',403);
   if(b.action==='roles'){
     if(!Array.isArray(b.moderators)||b.moderators.length>30)throw new ServiceError('Use up to 30 moderator emails.');
     const emails=[...new Set(b.moderators.map((v:unknown)=>field(v,254,true).toLowerCase()))];if(emails.some(v=>!/^\S+@\S+\.\S+$/.test(String(v))))throw new ServiceError('Enter valid email addresses.');
     await database.prepare("INSERT INTO settings (key,value) VALUES ('chatModerators',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(JSON.stringify(emails)).run();
     await database.prepare("INSERT INTO settings (key,value) VALUES ('catalogRevision','1') ON CONFLICT(key) DO UPDATE SET value=CAST(CAST(value AS INTEGER)+1 AS TEXT)").run();
   }else if(b.action==='unmute'){
     const mute=await database.prepare('SELECT roomId FROM chat_mutes WHERE id=?').bind(field(b.id,36,true)).first<{roomId:string}>();
     if(mute)await database.batch([database.prepare('DELETE FROM chat_mutes WHERE id=?').bind(b.id),chatTouch(database,mute.roomId)]);
   }else throw new ServiceError('Unknown moderation action.');
   await deps.log(who.account!.email,'chat:'+b.action,'Chat settings updated');return reply({ok:true});
 }
 if(path==='newsletter/automation'){
   if(!who.admin)throw new ServiceError('Admin access required.',403);
   const roomId=field(b.roomId,100,true);
   if(!await database.prepare('SELECT roomId FROM episodes WHERE roomId=?').bind(roomId).first())throw new ServiceError('Automatic sync is available on episode boards.');
   await deps.rate('newsletter-control:'+who.userId,10);
   try{await controlShowImport(database,roomId,field(b.action,20,true));}catch(e){throw new ServiceError((e as Error).message);}
   await deps.log(who.account!.email,'newsletter:'+b.action,roomId);
   return reply(await showImportStatus(database,roomId));
 }
 if(path==='newsletter/import'){
   if(!who.admin)throw new ServiceError('Admin access required.',403);
   const roomId=field(b.roomId,100,true),title=field(b.title||'Run of show',150,true),source=field(b.url||'',300);
   if(source&&!/^https:\/\/(?:tbpn\.substack\.com|www\.tbpn\.com|tbpn\.com)\//.test(source))throw new ServiceError('Use an official TBPN newsletter URL, or leave it blank for pasted notes.');
   if(!Array.isArray(b.topics)||!b.topics.length||b.topics.length>30)throw new ServiceError('Choose 1–30 topics.');
   const room=await database.prepare('SELECT status FROM rooms WHERE id=?').bind(roomId).first();if(!room||room.status!=='open')throw new ServiceError('Choose an open board.',403);
   const rows=[];for(const topic of b.topics){const name=field(topic.title,70,true),category=field(topic.category||'Moment',20);if(!CATEGORIES.includes(category))throw new ServiceError('Invalid category.');await deps.checkText(name);const origin='newsletter:'+await digest((source||title)+'\n'+name.toLowerCase());rows.push({id:crypto.randomUUID(),name,category,origin});}
   const existing=(await database.prepare('SELECT title,origin,status FROM moments WHERE roomId=?').bind(roomId).all<{title:string;origin:string|null;status:string}>()).results;const names=new Set(existing.map(row=>row.title.toLowerCase())),origins=new Set(existing.map(row=>row.origin));const fresh=rows.filter(row=>{if(names.has(row.name.toLowerCase())||origins.has(row.origin))return false;names.add(row.name.toLowerCase());origins.add(row.origin);return true;});const count=existing.filter(row=>row.status==='approved').length;if(count+fresh.length>300)throw new ServiceError('This board can hold 300 approved moments. Import fewer topics.');
   const results=await database.batch([...fresh.map(row=>database.prepare("INSERT OR IGNORE INTO moments (id,roomId,title,description,category,timestamp,image,status,createdBy,ipHash,createdAt,origin) SELECT ?,?,?,?, ?,0,NULL,'approved',?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM moments WHERE roomId=? AND lower(title)=lower(?)) AND (SELECT COUNT(*) FROM moments WHERE roomId=? AND status='approved')<300").bind(row.id,roomId,row.name,('Run of show: '+title+(source?' · '+source:'')).slice(0,400),row.category,who.userId,who.ipHash,time,row.origin,roomId,row.name,roomId)),database.prepare('UPDATE rooms SET revision=revision+1 WHERE id=?').bind(roomId)]);
   const added=results.slice(0,-1).reduce((sum,r)=>sum+Number(r.meta.changes||0),0);
   await deps.log(who.account!.email,'newsletter',`${added} topics · ${title}`);return reply({ok:true,added,skipped:rows.length-added},201);
 }
 return null;
}
