import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { SAMPLE_ROOM, SAMPLE_MOMENTS, TBPN_LIVE, TBPN_CHANNEL, CATEGORIES, TIERS, initialPlacement, type Moment, type Placement } from '@/lib/room-data';
import {decodeUpload} from '@/lib/upload';
import {assertAllowedText,defaultWords} from '@/lib/moderation';
import {currentBroadcast} from '@/lib/tbpn-stream';
import {roomServices,canModerate,ServiceError} from '@/lib/room-services';
import {communityServices,communityState} from '@/lib/community-services';
import {checkEpisodes,finishEpisode} from '@/lib/episode-lifecycle';
import {trustedGateway,exchangeLoginCode} from '@/lib/gateway-auth';
export const dynamic='force-dynamic';
const db=()=>{if(!env.DB)throw new Error('Database is not connected. Please try again shortly.');return env.DB;};
class ApiError extends Error{constructor(message:string,public status=400){super(message);}}
const json=(data:unknown,status=200,extra:Record<string,string>={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store',...extra}});
const hash=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(b=>b.toString(16).padStart(2,'0')).join('');
const identifier=()=>crypto.randomUUID();
const now=()=>Date.now();
const admins=()=>String(env.ADMIN_EMAILS||'ryan@moonshineai.com').toLowerCase().split(',').map(s=>s.trim());
async function identity(req:Request){
  let account=await getChatGPTUser();
  const ipHash=await hash((env.SESSION_PEPPER||'local-preview')+':'+((await trustedGateway(req)?req.headers.get('x-onair-client-ip'):req.headers.get('cf-connecting-ip'))||'preview'));
  const cookie=req.headers.get('cookie')?.match(/(?:^|;\s*)onair_session=([a-f0-9-]{36})/)?.[1];
  const session=cookie?await db().prepare('SELECT * FROM sessions WHERE id=? AND expires>?').bind(await hash(cookie),now()).first():null;
  if(!account&&typeof session?.account==='string'){try{const saved=JSON.parse(session.account);if(typeof saved.userId==='string'&&typeof saved.email==='string'&&typeof saved.displayName==='string')account=saved;}catch{}}
  const admin=!!account&&admins().includes(account.email.toLowerCase());
  return {admin,account,ipHash,verified:admin||!!session,userId:account?'account:'+account.userId:session?'visitor:'+session.id:null};
}
async function rate(key:string,limit:number,windowMs=60000){
  const bucket=Math.floor(now()/windowMs),full=key+':'+bucket;
  const r=await db().prepare('INSERT INTO rates (key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(full,now()+windowMs).first<{count:number}>();
  if((r?.count||0)>limit)throw new ApiError('A little too fast. Please try again in a minute.',429);
}
async function seed(){
  const ready=await db().prepare("SELECT COUNT(*) n FROM rooms WHERE id IN ('tbpn-live','the-warm-up')").first<{n:number}>();if(ready?.n===2)return;
  await db().prepare('INSERT OR IGNORE INTO rooms (id,title,description,videoId,status,createdAt) VALUES (?,?,?,?,?,?)').bind(TBPN_LIVE.id,TBPN_LIVE.title,TBPN_LIVE.description,TBPN_LIVE.videoId,'open',TBPN_LIVE.createdAt).run();
  if(await db().prepare("SELECT id FROM rooms WHERE id='the-warm-up'").first())return;
  await db().batch([
    db().prepare('INSERT OR IGNORE INTO rooms (id,title,description,videoId,status,createdAt) VALUES (?,?,?,?,?,?)').bind(SAMPLE_ROOM.id,SAMPLE_ROOM.title,SAMPLE_ROOM.description,null,'open',SAMPLE_ROOM.createdAt),
    ...SAMPLE_MOMENTS.map(m=>db().prepare('INSERT OR IGNORE INTO moments (id,roomId,title,description,category,timestamp,image,status,createdBy,ipHash,createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(m.id,m.roomId,m.title,m.description,m.category,0,null,'approved','system','system',m.createdAt))
  ]);
}
async function setting(key:string,fallback:string){return (await db().prepare('SELECT value FROM settings WHERE key=?').bind(key).first<{value:string}>())?.value??fallback;}
async function checkText(text:string){try{await assertAllowedText(db(),text);}catch(e){throw new ApiError((e as Error).message);}}
function str(v:unknown,max:number,required=false){if(typeof v!=='string'||v.length>max||(required&&!v.trim()))throw new ApiError('Please check the required fields and character limits.');return v.trim();}
function youtube(v:unknown){const s=str(v,300);if(!s)return null;if(s==='tbpn-live'||s==='channel:'+TBPN_CHANNEL)return 'channel:'+TBPN_CHANNEL;if(/^[\w-]{11}$/.test(s))return s;try{const u=new URL(s);if(['youtube.com','www.youtube.com','m.youtube.com','youtu.be'].includes(u.hostname)){if(u.pathname.toLowerCase().replace(/\/$/,'')==='/@tbpnlive/live'||u.pathname.toLowerCase().replace(/\/$/,'')==='/@tbpnlive')return 'channel:'+TBPN_CHANNEL;const id=u.hostname==='youtu.be'?u.pathname.slice(1).split('/')[0]:u.searchParams.get('v')||u.pathname.match(/\/(?:live|embed|shorts)\/([\w-]{11})/)?.[1];if(id&&/^[\w-]{11}$/.test(id))return id;}}catch{}throw new ApiError('Add a valid YouTube video or livestream URL.');}
async function log(actor:string,action:string,detail:string){await db().prepare('INSERT INTO audit (id,actor,action,detail,createdAt) VALUES (?,?,?,?,?)').bind(identifier(),actor,action,detail,now()).run();}
async function sharedBoard(roomId:string){
  const items=(await db().prepare("SELECT id FROM moments WHERE roomId=? AND status='approved' ORDER BY createdAt,id").bind(roomId).all<{id:string}>()).results;
  const saved=(await db().prepare('SELECT itemId,tier,score,position,version,updatedAt FROM placements WHERE roomId=?').bind(roomId).all<Placement>()).results;
  return items.map((m,i)=>saved.find(s=>s.itemId===m.id)||initialPlacement(m as Moment,i));
}
async function touch(roomId:string){await db().prepare('UPDATE rooms SET revision=revision+1 WHERE id=?').bind(roomId).run();}
async function catalog(){await db().prepare("INSERT INTO settings (key,value) VALUES ('catalogRevision','1') ON CONFLICT(key) DO UPDATE SET value=CAST(CAST(value AS INTEGER)+1 AS TEXT)").run();}
const uploadDay=()=>Math.floor(now()/86400000);
async function uploadQuota(){const count=(await db().prepare('SELECT count FROM rates WHERE key=?').bind('images:'+uploadDay()).first<{count:number}>())?.count||0;return {remaining:Math.max(0,100-count),limit:100,resetAt:(uploadDay()+1)*86400000};}
async function storeImage(value:unknown){
  if(!value)return null;
  let decoded;try{decoded=decodeUpload(value);}catch(e){throw new ApiError((e as Error).message);}
  if(!env.BUCKET)throw new ApiError('Image storage is unavailable.',503);
  const day=uploadDay(),quotaKey='images:'+day;
  const reserved=await db().prepare('INSERT INTO rates (key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 WHERE count<100 RETURNING count').bind(quotaKey,(day+1)*86400000).first();
  if(!reserved)throw new ApiError('The site has reached its 100 image uploads for today. Try again after midnight UTC.',429);
  const key=identifier();try{await env.BUCKET.put(key,decoded.bytes,{httpMetadata:{contentType:decoded.contentType}});}catch(e){await db().prepare('UPDATE rates SET count=MAX(0,count-1) WHERE key=?').bind(quotaKey).run();throw e;}
  return {url:'/api/image/'+key,key,quotaKey};
}
async function discardImage(image:Awaited<ReturnType<typeof storeImage>>){if(image){await env.BUCKET?.delete(image.key);await db().prepare('UPDATE rates SET count=MAX(0,count-1) WHERE key=?').bind(image.quotaKey).run();}}
function momentFields(b:Record<string,unknown>){const title=str(b.title,70,true),description=str(b.description||'',400),category=str(b.category,20,true),timestamp=Number(b.timestamp||0);if(!CATEGORIES.includes(category)||!Number.isInteger(timestamp)||timestamp<0||timestamp>86400)throw new ApiError('Check the category and timestamp.');return {title,description,category,timestamp};}
async function stream(req:Request,roomId:string){
  const database=db();
  if(!await database.prepare('SELECT id FROM rooms WHERE id=?').bind(roomId).first())throw new ApiError('Room not found.',404);
  const enc=new TextEncoder();let cancelled=false;
  const body=new ReadableStream({async start(controller){
    const send=(message:string)=>{if(!cancelled)controller.enqueue(enc.encode(message));};
    const abort=()=>{cancelled=true;};req.signal.addEventListener('abort',abort,{once:true});
    try{send('retry: 700\n\n');let previous='';const until=Date.now()+22000;
      while(!cancelled&&Date.now()<until){
        const room=await database.prepare("SELECT revision,chatRevision,COALESCE((SELECT value FROM settings WHERE key='catalogRevision'),'0') catalogRevision FROM rooms WHERE id=?").bind(roomId).first<{revision:number;chatRevision:number;catalogRevision:string}>();
        if(!room)break;
        const key=room.revision+':'+room.catalogRevision+':'+room.chatRevision;if(key!==previous){previous=key;send(`event: sync\ndata: ${JSON.stringify({revision:room.revision,catalogRevision:Number(room.catalogRevision),chatRevision:room.chatRevision})}\n\n`);}else send(': heartbeat\n\n');
        await new Promise(resolve=>setTimeout(resolve,1000));
      }
    }catch{if(!cancelled)send('event: reconnect\ndata: {}\n\n');}
    finally{req.signal.removeEventListener('abort',abort);if(!cancelled){cancelled=true;controller.close();}}
  },cancel(){cancelled=true;}});
  return new Response(body,{headers:{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','X-Accel-Buffering':'no','Connection':'keep-alive'}});
}
async function handle(req:Request){
  try{
    const url=new URL(req.url),path=url.pathname.replace(/^\/api\//,'');
    if(req.method==='GET'&&path.startsWith('image/')){
      const key=path.slice(6);if(!/^[a-f0-9-]{36}$/.test(key))throw new ApiError('Image not found.',404);
      const visible=await db().prepare('SELECT id FROM moments WHERE image=? AND status=?').bind('/api/image/'+key,'approved').first();
      if(!visible&&!(await identity(req)).admin)throw new ApiError('Image not found.',404);
      const object=await env.BUCKET?.get(key);if(!object)throw new ApiError('Image not found.',404);
      return new Response(object.body,{headers:{'Content-Type':object.httpMetadata?.contentType||'image/jpeg','Cache-Control':'private, max-age=300','X-Content-Type-Options':'nosniff'}});
    }
    await seed();
    if(req.method==='GET'&&(path==='stream'||path==='lifecycle')){const result=await checkEpisodes(db(),env.BUCKET);return json(path==='stream'?result.broadcast:{ok:true,checkedAt:result.broadcast.checkedAt,stale:result.stale,created:result.created,ended:result.ended,newsletter:result.newsletter});}
    if(req.method==='GET'&&path==='events')return await stream(req,url.searchParams.get('room')||SAMPLE_ROOM.id);
    const who=await identity(req);
    const community=req.method==='GET'?await communityServices(req,url,path,undefined,who,db(),{checkText,rate,log}):null;if(community)return community;
    const extra=req.method==='GET'?await roomServices(req,url,path,undefined,who,db(),{checkText,rate,log}):null;if(extra)return extra;
    if(req.method==='GET'&&path==='state'){
      if(!url.searchParams.get('room'))await checkEpisodes(db(),env.BUCKET);
      const rooms=(await db().prepare('SELECT * FROM rooms ORDER BY createdAt DESC LIMIT 100').all()).results;
      const latestEpisode=await db().prepare('SELECT roomId FROM episodes ORDER BY startedAt DESC LIMIT 1').first<{roomId:string}>();
      const roomId=url.searchParams.get('room')||latestEpisode?.roomId||TBPN_LIVE.id;
      const room=rooms.find(r=>r.id===roomId);if(!room)throw new ApiError('Room not found.',404);
      const moments=(await db().prepare(`SELECT m.id,m.roomId,m.title,m.description,m.category,m.timestamp,m.image,m.status,m.createdAt,m.version,AVG(v.score) score,COUNT(v.itemId) count,(SELECT value FROM settings WHERE key='imageCredit:'||m.id) imageCredit FROM moments m LEFT JOIN votes v ON v.itemId=m.id WHERE m.roomId=? AND m.status='approved' GROUP BY m.id ORDER BY m.createdAt ASC,m.id ASC LIMIT 300`).bind(roomId).all()).results;
      const mine=who.userId?(await db().prepare("SELECT v.itemId,v.tier,v.score FROM votes v JOIN moments m ON m.id=v.itemId WHERE v.userId=? AND m.roomId=? AND m.status='approved'").bind(who.userId,roomId).all()).results:[];
      const hasBoard=who.userId?!!await db().prepare('SELECT userId FROM boards WHERE userId=? AND roomId=?').bind(who.userId,roomId).first():false;
      const used=(await db().prepare('SELECT COUNT(*) n FROM moments WHERE roomId=? AND (createdBy=? OR ipHash=?)').bind(roomId,who.userId||'',who.ipHash).first<{n:number}>())?.n||0;
      const limit=Number(await setting('submissionLimit','3'));
      const stats=await db().prepare("SELECT COUNT(*) votes,COUNT(DISTINCT userId) participants FROM votes WHERE itemId IN (SELECT id FROM moments WHERE roomId=? AND status='approved')").bind(roomId).first();
      const pending=who.userId?(await db().prepare("SELECT id,title,status FROM moments WHERE createdBy=? AND roomId=? AND status!='approved' ORDER BY createdAt DESC").bind(who.userId,roomId).all()).results:[];
      const shared=await sharedBoard(roomId);
      const online=(await db().prepare('SELECT COUNT(*) n FROM presence WHERE roomId=? AND seenAt>?').bind(roomId,now()-45000).first<{n:number}>())?.n||0;
      return json({...await communityState(db(),roomId,who.userId),rooms,room,moments:moments.map(m=>{let credit=null;try{const c=JSON.parse(String(m.imageCredit||'null'));if(c?.image===m.image)credit=c;}catch{}return {...m,imageCredit:credit};}),shared,revision:room.revision,catalogRevision:Number(await setting('catalogRevision','0')),uploads:await uploadQuota(),online,mine,hasBoard,used,limit,stats,pending,verified:who.verified,admin:who.admin,canModerate:await canModerate(who,db()),account:who.account?{email:who.account.email,name:who.account.displayName}:null,verification:env.TURNSTILE_SITE_KEY&&env.TURNSTILE_SECRET_KEY?'turnstile':'browser',siteKey:env.TURNSTILE_SITE_KEY&&env.TURNSTILE_SECRET_KEY?env.TURNSTILE_SITE_KEY:null});
    }
    if(req.method==='GET'&&path==='admin'){
      if(!who.admin)throw new ApiError('Admin sign-in required.',403);
      const [queue,reports,audit]=await Promise.all([
        db().prepare("SELECT id,roomId,title,description,category,timestamp,image,status,createdAt FROM moments WHERE status IN ('pending','hidden') ORDER BY createdAt DESC LIMIT 100").all(),
        db().prepare('SELECT r.id,r.itemId,r.reason,r.createdAt,m.title FROM reports r JOIN moments m ON m.id=r.itemId ORDER BY r.createdAt DESC LIMIT 100').all(),
        db().prepare('SELECT action,detail,createdAt FROM audit ORDER BY createdAt DESC LIMIT 30').all(),
      ]);
      return json({queue:queue.results,reports:reports.results,audit:audit.results,blockedWords:JSON.parse(await setting('blockedWords',JSON.stringify(defaultWords))),submissionLimit:Number(await setting('submissionLimit','3'))});
    }
    if(req.method==='GET'&&path==='challenge'){
      await rate('challenge:'+who.ipHash,10);
      const id=identifier();await db().prepare('INSERT INTO challenges (id,ipHash,expires,used) VALUES (?,?,?,0)').bind(id,who.ipHash,now()+300000).run();
      await db().batch([db().prepare('DELETE FROM challenges WHERE expires<?').bind(now()),db().prepare('DELETE FROM sessions WHERE expires<?').bind(now()),db().prepare('DELETE FROM rates WHERE expires<?').bind(now())]);
      return json({id,difficulty:4});
    }
    if(req.method!=='POST')throw new ApiError('Not found.',404);
    if(req.headers.get('origin')!==url.origin)throw new ApiError('Please submit from this website.',403);
    const length=Number(req.headers.get('content-length')||0);if(length>3000000)throw new ApiError('File is too large.',413);
    const raw=await req.text();if(raw.length>3000000)throw new ApiError('File is too large.',413);
    let b;try{b=JSON.parse(raw);}catch{throw new ApiError('Invalid request.');}
    await rate('write:'+who.ipHash,180);
    if(path==='gateway/exchange'){
      if(!await trustedGateway(req))throw new ApiError('Gateway access required.',403);
      const token=await exchangeLoginCode(db(),str(b.code,100,true),str(b.verifier,100,true),who.ipHash);if(!token)throw new ApiError('Sign-in expired. Please try again.',403);
      return json({ok:true},200,{'Set-Cookie':`onair_session=${token}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=604800`});
    }
    if(path==='verify'){
      if(env.TURNSTILE_SITE_KEY&&env.TURNSTILE_SECRET_KEY){
        const token=str(b.token,2048,true);
        const r=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret:env.TURNSTILE_SECRET_KEY,response:token,...(req.headers.get('cf-connecting-ip')?{remoteip:req.headers.get('cf-connecting-ip')!}:{})})});
        const check=await r.json() as {success:boolean;hostname?:string};
        if(!check.success||check.hostname!==url.hostname)throw new ApiError('Verification expired. Please try again.',403);
      }else{
        const id=str(b.id,36,true),nonce=str(String(b.nonce),12,true);
        if(!(await hash(id+':'+nonce)).startsWith('0000'))throw new ApiError('Browser check failed. Please try again.',403);
        const used=await db().prepare('UPDATE challenges SET used=1 WHERE id=? AND ipHash=? AND used=0 AND expires>? RETURNING id').bind(id,who.ipHash,now()).first();
        if(!used)throw new ApiError('Browser check expired. Please try again.',403);
      }
      const token=identifier();await db().prepare('INSERT INTO sessions (id,ipHash,expires) VALUES (?,?,?)').bind(await hash(token),who.ipHash,now()+7*86400000).run();
      return json({ok:true},200,{'Set-Cookie':`onair_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${url.protocol==='https:'?'; Secure':''}`});
    }
    if(!who.verified||!who.userId)throw new ApiError('Verify your browser to join the room.',401);
    if(path==='logout'){
      const token=req.headers.get('cookie')?.match(/(?:^|;\s*)onair_session=([a-f0-9-]{36})/)?.[1];if(token)await db().prepare('DELETE FROM sessions WHERE id=?').bind(await hash(token)).run();
      return json({ok:true},200,{'Set-Cookie':'onair_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'});
    }
    const communityWrite=await communityServices(req,url,path,b,who,db(),{checkText,rate,log});if(communityWrite)return communityWrite;
    const service=await roomServices(req,url,path,b,who,db(),{checkText,rate,log});if(service)return service;
    if(path==='presence'){
      const roomId=str(b.roomId,100,true);
      if(!await db().prepare('SELECT id FROM rooms WHERE id=?').bind(roomId).first())throw new ApiError('Room not found.',404);
      await db().batch([db().prepare('INSERT INTO presence (userId,roomId,seenAt) VALUES (?,?,?) ON CONFLICT(userId,roomId) DO UPDATE SET seenAt=excluded.seenAt').bind(who.userId,roomId,now()),db().prepare('DELETE FROM presence WHERE seenAt<?').bind(now()-90000)]);
      return json({ok:true});
    }
    if(path==='move'){
      await rate('move:'+who.userId,90);
      const roomId=str(b.roomId,100,true),itemId=str(b.itemId,100,true),tier=str(b.tier,1,true),score=Number(b.score),version=Number(b.version);
      if(![...TIERS.map(t=>t.id),'U'].includes(tier)||!Number.isInteger(score)||score<0||score>100||!Number.isInteger(version)||version<0)throw new ApiError('Invalid placement.');
      const room=await db().prepare('SELECT status FROM rooms WHERE id=?').bind(roomId).first();if(!room||room.status!=='open')throw new ApiError('This room is closed for ranking.',403);
      const board=await sharedBoard(roomId),current=board.find(p=>p.itemId===itemId);if(!current)throw new ApiError('Moment not found.',404);
      if(current.version!==version)throw new ApiError('Someone just moved this moment. The latest board has been restored; try your move again.',409);
      const target=board.filter(p=>p.tier===tier&&p.itemId!==itemId).sort((a,b)=>a.position-b.position||a.itemId.localeCompare(b.itemId));
      const beforeId=b.beforeId==null?null:str(b.beforeId,100,true),before=beforeId?target.findIndex(p=>p.itemId===beforeId):-1;
      if(beforeId&&before<0)throw new ApiError('The drop target moved. Please try again.',409);
      const position=before>=0?((before?target[before-1].position:target[before].position-2048)+target[before].position)/2:(target.at(-1)?.position??-1024)+1024;
      const updatedAt=now();
      const changed=await db().prepare(`INSERT INTO placements (roomId,itemId,tier,score,position,version,updatedAt) SELECT ?,?,?,?,?,1,? WHERE EXISTS (SELECT 1 FROM rooms WHERE id=? AND status='open') ON CONFLICT(roomId,itemId) DO UPDATE SET tier=excluded.tier,score=excluded.score,position=excluded.position,version=placements.version+1,updatedAt=excluded.updatedAt WHERE placements.version=? AND EXISTS (SELECT 1 FROM rooms WHERE id=? AND status='open') RETURNING itemId,tier,score,position,version,updatedAt`).bind(roomId,itemId,tier,score,position,updatedAt,roomId,version,roomId).first<Placement>();
      if(!changed)throw new ApiError('This moment or room just changed. Please try again.',409);
      await touch(roomId);
      return json({ok:true,placement:changed});
    }
    if(path==='vote'){
      const roomId=str(b.roomId,100,true);const room=await db().prepare('SELECT status FROM rooms WHERE id=?').bind(roomId).first();
      if(!room)throw new ApiError('Room not found.',404);
      if(!Array.isArray(b.votes)||b.votes.length>300)throw new ApiError('Invalid board.');
      const approved=(await db().prepare("SELECT id FROM moments WHERE roomId=? AND status='approved'").bind(roomId).all()).results.map(m=>m.id);
      const rows=b.votes.map((v:{itemId:unknown;tier:unknown;score:unknown})=>{const id=str(v.itemId,100,true),tier=str(v.tier,1,true),score=Number(v.score);if(!approved.includes(id)||!TIERS.some(t=>t.id===tier)||!Number.isInteger(score)||score<0||score>100)throw new ApiError('Invalid vote.');return {id,tier,score};});
      if(new Set(rows.map((r:{id:string})=>r.id)).size!==rows.length)throw new ApiError('Duplicate moments.');
      await db().batch([db().prepare('DELETE FROM votes WHERE userId=? AND itemId IN (SELECT id FROM moments WHERE roomId=?)').bind(who.userId,roomId),db().prepare('INSERT INTO boards (userId,roomId,updatedAt,autoPublish,byline,version) VALUES (?,?,?,1,?,1) ON CONFLICT(userId,roomId) DO UPDATE SET updatedAt=excluded.updatedAt,version=boards.version+1').bind(who.userId,roomId,now(),'Viewer '+who.userId.slice(-4)),...rows.map((v:{id:string;tier:string;score:number})=>db().prepare('INSERT INTO votes (userId,itemId,tier,score,updatedAt) VALUES (?,?,?,?,?)').bind(who.userId,v.id,v.tier,v.score,now()))]);
      await touch(roomId);return json({ok:true,saved:rows.length});
    }
    if(path==='moments'){
      const roomId=str(b.roomId,100,true),{title,description,category,timestamp}=momentFields(b);
      await checkText(title+' '+description);
      const room=await db().prepare('SELECT status FROM rooms WHERE id=?').bind(roomId).first();if(!room||room.status!=='open')throw new ApiError('This room is closed for submissions.',403);
      if(!who.admin)await rate('submit:'+who.ipHash,8,86400000);
      const limit=Number(await setting('submissionLimit','3'));
      const tier=who.admin?str(b.tier||'U',1,true):'U';if(![...TIERS.map(t=>t.id),'U'].includes(tier))throw new ApiError('Invalid tier.');
      const image=await storeImage(b.image),id=identifier();
      const insert=db().prepare(`INSERT INTO moments (id,roomId,title,description,category,timestamp,image,status,createdBy,ipHash,createdAt) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE (?=1 OR (SELECT COUNT(*) FROM moments WHERE roomId=? AND (createdBy=? OR ipHash=?))<?) AND (SELECT COUNT(*) FROM moments WHERE roomId=? AND status='approved')<300 RETURNING id`).bind(id,roomId,title,description,category,timestamp,image?.url||null,who.admin?'approved':'pending',who.userId,who.ipHash,now(),who.admin?1:0,roomId,who.userId,who.ipHash,limit,roomId);
      let inserted;try{const results=await db().batch([insert,
        ...(who.admin?[db().prepare('INSERT INTO placements (roomId,itemId,tier,score,position,version,updatedAt) SELECT ?,?,?,?,?,1,? WHERE EXISTS (SELECT 1 FROM moments WHERE id=?)').bind(roomId,id,tier,TIERS.find(t=>t.id===tier)?.value??50,now(),now(),id)]:[]),
        db().prepare('UPDATE rooms SET revision=revision+1 WHERE id=? AND EXISTS (SELECT 1 FROM moments WHERE id=?)').bind(roomId,id)
      ]);inserted=results[0].results[0];}catch(e){await discardImage(image);throw e;}
      if(!inserted){await discardImage(image);throw new ApiError(who.admin?'This board has reached its 300 moment capacity.':`Your submission limit or this board’s capacity has been reached.`,429);}
      if(who.admin)await log(who.account!.email,'createMoment',title);
      return json({ok:true,id,message:who.admin?'Published to the live board.':'Submitted for moderator review.'},201);
    }
    if(path==='report'){
      const itemId=str(b.itemId,100,true),reason=str(b.reason,200,true);await rate('report:'+who.userId,5,3600000);await checkText(reason);
      if(!await db().prepare("SELECT id FROM moments WHERE id=? AND status='approved'").bind(itemId).first())throw new ApiError('Moment not found.',404);
      await db().prepare('INSERT INTO reports (id,itemId,userId,reason,createdAt) VALUES (?,?,?,?,?)').bind(identifier(),itemId,who.userId,reason,now()).run();return json({ok:true});
    }
    if(path==='admin'){
      if(!who.admin)throw new ApiError('Admin access required.',403);
      const actor=who.account!.email;
      if(b.action==='editMoment'){
        const id=str(b.id,100,true),version=Number(b.version),{title,description,category,timestamp}=momentFields(b);
        if(!Number.isInteger(version)||version<1)throw new ApiError('Invalid edit version.');
        await checkText(title+' '+description);
        const current=await db().prepare('SELECT image,roomId,version FROM moments WHERE id=?').bind(id).first<{image:string|null;roomId:string;version:number}>();
        if(!current)throw new ApiError('Moment not found.',404);if(current.version!==version)throw new ApiError('This moment changed while you were editing. Reopen it to edit the latest version.',409);
        const uploaded=await storeImage(b.image);
        const image=uploaded?.url||(b.removeImage?null:current.image);
        let changed;try{changed=await db().prepare('UPDATE moments SET title=?,description=?,category=?,timestamp=?,image=?,version=version+1 WHERE id=? AND version=? RETURNING id').bind(title,description,category,timestamp,image,id,version).first();}catch(e){await discardImage(uploaded);throw e;}
        if(!changed){await discardImage(uploaded);throw new ApiError('This moment changed while you were editing. Reopen it and try again.',409);}
        await touch(current.roomId);
        if(current.image&&current.image!==image)await env.BUCKET?.delete(current.image.split('/').pop()!);
      }else if(b.action==='settings'){
        if(!Array.isArray(b.blockedWords)||b.blockedWords.length>300)throw new ApiError('Use up to 300 blocked words.');
        const words=Array.from(new Set(b.blockedWords.map((w:unknown)=>str(w,60,true))));const limit=Number(b.submissionLimit);if(!Number.isInteger(limit)||limit<1||limit>10)throw new ApiError('Use a submission limit from 1 to 10.');
        await db().batch([db().prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind('blockedWords',JSON.stringify(words)),db().prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind('submissionLimit',String(limit))]);
      }else if(b.action==='moderate'){
        const id=str(b.id,100,true),status=str(b.status,20,true);if(!['approved','rejected','hidden'].includes(status))throw new ApiError('Invalid status.');
        const moment=await db().prepare('SELECT title,description,roomId FROM moments WHERE id=?').bind(id).first<{title:string;description:string;roomId:string}>();if(!moment)throw new ApiError('Moment not found.',404);if(status==='approved')await checkText(moment.title+' '+moment.description);
        await db().prepare('UPDATE moments SET status=?,version=version+1 WHERE id=?').bind(status,id).run();
        await touch(moment.roomId);
      }else if(b.action==='room'){
        const title=str(b.title,90,true),description=str(b.description||'',400),videoId=youtube(b.video||'');const id=identifier();
        const inserted=await db().prepare('INSERT INTO rooms (id,title,description,videoId,status,createdAt) SELECT ?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM rooms)<100 RETURNING id').bind(id,title,description,videoId,'open',now()).first();if(!inserted)throw new ApiError('The site has reached its 100 board tabs. Reuse an existing tab.',429);await catalog();await log(actor,'room',title);return json({ok:true,roomId:id});
      }else if(b.action==='editRoom'){
        const id=str(b.id,100,true),title=str(b.title,90,true),description=str(b.description||'',400),videoId=youtube(b.video||'');
        if(!await db().prepare('SELECT id FROM rooms WHERE id=?').bind(id).first())throw new ApiError('Room not found.',404);
        await db().prepare('UPDATE rooms SET title=?,description=?,videoId=?,revision=revision+1 WHERE id=?').bind(title,description,videoId,id).run();await catalog();
      }else if(b.action==='roomStatus'){
        const id=str(b.id,100,true),status=str(b.status,10,true);if(!['open','closed'].includes(status))throw new ApiError('Invalid room status.');await db().prepare('UPDATE rooms SET status=?,revision=revision+1 WHERE id=?').bind(status,id).run();if(status==='closed')await finishEpisode(db(),id);await catalog();
      }else if(b.action==='dismissReport'){await db().prepare('DELETE FROM reports WHERE id=?').bind(str(b.id,100,true)).run();}
      else throw new ApiError('Unknown action.');
      await log(actor,str(b.action,30,true),b.id?str(b.id,100):'Room settings updated');return json({ok:true});
    }
    throw new ApiError('Not found.',404);
  }catch(e){if(e instanceof ApiError||e instanceof ServiceError)return json({error:e.message},e.status);console.error('ON AIR request failed',e);return json({error:'The room could not be reached. Please try again.'},503);}
}
export const GET=handle;
export const POST=handle;
