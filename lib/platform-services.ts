import {ServiceError,type Visitor} from './room-services';
import {managesRoom} from './room-permissions';
import {parseStreamSource} from './stream-source';
import {resolveStreamSource} from './stream-resolution';
type Deps={checkText:(text:string,roomId?:string)=>Promise<void>;rate:(key:string,limit:number,windowMs?:number)=>Promise<void>;log:(actor:string,action:string,detail:string)=>Promise<void>};
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
function text(value:unknown,max:number,required=false){if(typeof value!=='string'||value.length>max||required&&!value.trim())throw new ServiceError('Check the required fields and text limits.');return value.trim();}
export async function platformServices(req:Request,url:URL,path:string,b:any,who:Visitor,db:D1Database,deps:Deps){
 if(!['rooms/create','rooms/manage'].includes(path))return null;
 if(path==='rooms/manage'){
  const roomId=text(req.method==='GET'?url.searchParams.get('room'):b.roomId,100,true);if(!await managesRoom(who,db,roomId))throw new ServiceError('Host access required for this room.',403);
  if(req.method==='GET'){
   const [settings,queue,mutes]=await Promise.all([db.prepare('SELECT blockedWords FROM room_hosts WHERE roomId=?').bind(roomId).first<{blockedWords:string}>(),db.prepare("SELECT id,title,description,category,image,status,version FROM moments WHERE roomId=? AND status IN ('pending','hidden') ORDER BY createdAt DESC LIMIT 100").bind(roomId).all(),db.prepare('SELECT id,author,until FROM chat_mutes WHERE roomId=? AND until>? ORDER BY until DESC LIMIT 100').bind(roomId,Date.now()).all()]);
   return reply({roomFilters:!!settings,blockedWords:JSON.parse(settings?.blockedWords||'[]'),queue:queue.results,mutes:mutes.results});
  }
  if(req.method!=='POST')return null;
  if(b.action==='words'){
   if(!Array.isArray(b.blockedWords)||b.blockedWords.length>100)throw new ServiceError('Use up to 100 additional blocked words.');const words=[...new Set(b.blockedWords.map((s:unknown)=>text(s,60,true)))];
   const row=await db.prepare('SELECT roomId FROM room_hosts WHERE roomId=?').bind(roomId).first();if(!row)throw new ServiceError('Additional room filters are available on hosted stream rooms.');
   await db.prepare('UPDATE room_hosts SET blockedWords=? WHERE roomId=?').bind(JSON.stringify(words),roomId).run();
  }else if(b.action==='unmute')await db.prepare('DELETE FROM chat_mutes WHERE id=? AND roomId=?').bind(text(b.id,36,true),roomId).run();
  else throw new ServiceError('Unknown room action.');
  await db.prepare('UPDATE rooms SET revision=revision+1,chatRevision=chatRevision+1 WHERE id=?').bind(roomId).run();return reply({ok:true});
 }
 if(req.method!=='POST')return null;
 const title=text(b.title,90,true),description=text(b.description||'',400),video=text(b.video||'',1500),topics=b.topics===undefined?[]:b.topics;
 if(!Array.isArray(topics)||topics.length>20)throw new ServiceError('Start with up to 20 moments.');const names=[...new Set(topics.map((s:unknown)=>text(s,70,true)))];await deps.checkText([title,description,...names].join('\n'));
 try{parseStreamSource(video);}catch(e){throw new ServiceError((e as Error).message);}
 if(!who.admin){await deps.rate('create-room:'+who.userId,3,86400000);await deps.rate('create-room-network:'+who.ipHash,5,86400000);}
 let source:string|null;try{source=await resolveStreamSource(video);}catch(e){throw new ServiceError((e as Error).message);}
 const id=crypto.randomUUID(),time=Date.now(),rows=await db.batch([
  db.prepare("INSERT INTO rooms (id,title,description,videoId,status,createdAt,revision) SELECT ?,?,?,?,'open',?,1 WHERE (SELECT COUNT(*) FROM room_hosts)<1000 RETURNING id").bind(id,title,description,source,time),
  db.prepare('INSERT INTO room_hosts (roomId,ownerId,createdAt) SELECT ?,?,? WHERE EXISTS (SELECT 1 FROM rooms WHERE id=?)').bind(id,who.userId,time,id),
  ...names.map((name,index)=>db.prepare("INSERT INTO moments (id,roomId,title,description,category,timestamp,status,createdBy,ipHash,createdAt) SELECT ?,?,?,'','Moment',0,'approved',?,?,? WHERE EXISTS (SELECT 1 FROM rooms WHERE id=?)").bind(crypto.randomUUID(),id,name,who.userId,who.ipHash,time+index,id)),
  db.prepare("INSERT INTO settings (key,value) VALUES ('catalogRevision','1') ON CONFLICT(key) DO UPDATE SET value=CAST(CAST(value AS INTEGER)+1 AS TEXT)")
 ]);
 if(!rows[0].results.length)throw new ServiceError('The platform is at its room capacity. Please join an existing room.',429);
 await deps.log(who.account?.email||who.userId!,'room:create',id);return reply({ok:true,roomId:id,sourceWarning:source?.startsWith('youtube-handle:')?'Channel lookup was unavailable. Your watch link works; use a specific video URL to embed it.':null},201);
}
