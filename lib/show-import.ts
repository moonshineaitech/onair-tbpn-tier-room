import {newsletterForEpisode,parseNewsletterIssues,type Newsletter,type NewsletterTopic} from './newsletter';
import {sourceBytes,topicImage,type AcquiredImage} from './newsletter-images';
import {assertAllowedText} from './moderation';

type Entry=NewsletterTopic&{origin:string;itemId?:string;done?:boolean;attempts:number;note?:string};
export type ShowImport={phase:'waiting'|'images'|'complete';checkedAt:number;nextAttemptAt:number;issue?:{title:string;url:string;publishedAt:string};entries:Entry[];added:number;skipped:number;blocked:number;error?:string};
const key=(roomId:string)=>'newsletterAuto:'+roomId;
const digest=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(n=>n.toString(16).padStart(2,'0')).join('');
async function setting<T>(db:D1Database,name:string,fallback:T):Promise<T>{const row=await db.prepare('SELECT value FROM settings WHERE key=?').bind(name).first<{value:string}>();try{return row?JSON.parse(row.value):fallback;}catch{return fallback;}}
async function put(db:D1Database,name:string,value:unknown){await db.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(name,JSON.stringify(value)).run();}
export async function showImportStatus(db:D1Database,roomId:string){
 const job=await setting<ShowImport|null>(db,key(roomId),null),paused=await setting(db,'newsletterPaused:'+roomId,false),heartbeat=await setting<{checkedAt:number;status:string}|null>(db,'newsletterAutomationHeartbeat',null);
 return {enabled:!paused,phase:paused?'paused':job?.phase||'watching',checkedAt:job?.checkedAt||0,collector:heartbeat,issue:job?.issue||null,added:job?.added||0,skipped:job?.skipped||0,blocked:job?.blocked||0,images:job?.entries.filter(e=>e.note==='saved').length||0,pending:job?.entries.filter(e=>!e.done).length||0,total:job?.entries.length||0,error:job?.error||null};
}
export async function controlShowImport(db:D1Database,roomId:string,action:string){
 if(!['pause','resume','retry'].includes(action))throw new Error('Unknown sync action.');
 await put(db,'newsletterPaused:'+roomId,action==='pause');
 if(action!=='pause'){const job=await setting<ShowImport|null>(db,key(roomId),null);if(job){job.nextAttemptAt=0;job.error=undefined;for(const entry of job.entries)if(entry.note==='image unavailable'){entry.done=false;entry.attempts=0;}if(job.entries.some(e=>!e.done))job.phase='images';await put(db,key(roomId),job);}}
}
type Options={time?:number;deadline?:number;loadIssues?:()=>Promise<Newsletter[]>;acquireImage?:(topic:NewsletterTopic,videoId:string,deadline:number)=>Promise<AcquiredImage|null>};
// A two-minute D1 lease makes the public collector safe to call concurrently. The
// job is durable between bounded batches; every moment has a unique source key.
export async function importShow(db:D1Database,bucket:R2Bucket|undefined,episode:{roomId:string;videoId:string;startedAt:number},options:Options={}){
 const time=options.time??Date.now(),deadline=options.deadline??Date.now()+12500,name=key(episode.roomId),lock='newsletterLease:'+episode.roomId,token=crypto.randomUUID(),lease=JSON.stringify({token,until:time+120000});
 if(await setting(db,'newsletterPaused:'+episode.roomId,false))return {status:'paused'};
 const previous=await setting<ShowImport|null>(db,name,null);if(previous&&(previous.phase==='complete'||previous.nextAttemptAt>time))return {status:previous.phase};
 const acquired=await db.prepare("INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(json_extract(settings.value,'$.until') AS INTEGER)<? RETURNING key").bind(lock,lease,time).first();
 if(!acquired)return {status:'busy'};
 let job=await setting<ShowImport>(db,name,{phase:'waiting',checkedAt:0,nextAttemptAt:0,entries:[],added:0,skipped:0,blocked:0});
 try{
  // Re-read after acquiring the lease: another invocation may have just finished.
  if(job.phase==='complete'||job.nextAttemptAt>time)return {status:job.phase};
  job.checkedAt=time;job.nextAttemptAt=time+60000;job.error=undefined;
  if(!job.issue){
   const issues=options.loadIssues?await options.loadIssues():parseNewsletterIssues(new TextDecoder().decode((await sourceBytes('https://tbpn.substack.com/feed','article',AbortSignal.timeout(Math.max(1,Math.min(4000,deadline-Date.now()))),2000000)).bytes));
   const newsletter=newsletterForEpisode(issues,episode.videoId,episode.startedAt);
   if(!newsletter){job.error='Waiting for this show’s newsletter. Previous issues are never imported into a new episode.';await put(db,name,job);return {status:'waiting'};}
   job.issue={title:newsletter.title,url:newsletter.url,publishedAt:newsletter.publishedAt};
   job.entries=await Promise.all(newsletter.topics.map(async topic=>({...topic,origin:'newsletter:'+await digest(newsletter.url+'\n'+topic.title.toLowerCase()),attempts:0})));
   await put(db,name,job);
  }
  for(const entry of job.entries){
   if(entry.itemId||entry.done)continue;
   if(await setting(db,'newsletterPaused:'+episode.roomId,false))return {status:'paused'};
   try{await assertAllowedText(db,entry.title);}catch(error){if(!(error instanceof Error)||!error.message.includes('blocked by this room'))throw error;job.blocked++;entry.done=true;entry.note='blocked by moderation';continue;}
   const id=crypto.randomUUID();
   const result=await db.prepare("INSERT OR IGNORE INTO moments (id,roomId,title,description,category,timestamp,image,status,createdBy,ipHash,createdAt,origin) SELECT ?,?,?,?,?,0,NULL,'approved','newsletter-automation','system',?,? WHERE EXISTS (SELECT 1 FROM rooms WHERE id=? AND status='open') AND NOT EXISTS (SELECT 1 FROM moments WHERE roomId=? AND lower(title)=lower(?)) AND (SELECT COUNT(*) FROM moments WHERE roomId=? AND status='approved')<300 AND NOT EXISTS (SELECT 1 FROM settings WHERE key=? AND value='true') RETURNING id").bind(id,episode.roomId,entry.title,('Run of show: '+job.issue!.title+' · '+job.issue!.url+(entry.sourceUrl?'\nTopic: '+entry.sourceUrl:'')).slice(0,400),entry.category,time+job.entries.indexOf(entry),entry.origin,episode.roomId,episode.roomId,entry.title,episode.roomId,'newsletterPaused:'+episode.roomId).first<{id:string}>();
   const existing=await db.prepare('SELECT id,createdBy,origin FROM moments WHERE roomId=? AND (origin=? OR lower(title)=lower(?)) LIMIT 1').bind(episode.roomId,entry.origin,entry.title).first<{id:string;createdBy:string;origin:string|null}>();
   if(!existing&&await setting(db,'newsletterPaused:'+episode.roomId,false))return {status:'paused'};
   entry.itemId=existing?.id;
   if(existing?.createdBy==='newsletter-automation'&&existing.origin===entry.origin)job.added++;
   else{job.skipped++;entry.done=true;entry.note='existing, moderated, or full board';}
   await put(db,name,job);
   if(result)await db.prepare('UPDATE rooms SET revision=revision+1 WHERE id=?').bind(episode.roomId).run();
  }
  job.phase='images';await put(db,name,job);
  if(await setting(db,'newsletterPaused:'+episode.roomId,false))return {status:'paused'};
  const work=job.entries.filter(e=>!e.done&&e.itemId).slice(0,12);
  for(let offset=0;offset<work.length&&Date.now()<deadline-300;offset+=4){
   const results=await Promise.allSettled(work.slice(offset,offset+4).map(async entry=>{
    const current=await db.prepare('SELECT version,image,status,createdBy FROM moments WHERE id=?').bind(entry.itemId).first<{version:number;image:string|null;status:string;createdBy:string}>();
    if(!current||current.version!==1||current.image||current.status!=='approved'||current.createdBy!=='newsletter-automation'){entry.done=true;entry.note='admin content preserved';return;}
    if(!bucket){job.error='Image storage is temporarily unavailable. Topics are saved; images will retry.';return;}
    const image=await (options.acquireImage||topicImage)(entry,episode.videoId,deadline);entry.attempts++;
    if(!image){if(entry.attempts>=3){entry.done=true;entry.note='image unavailable';}return;}
    const day=Math.floor(time/86400000),quota='images:'+day;
    const reserved=await db.prepare('INSERT INTO rates (key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 WHERE count<100 RETURNING count').bind(quota,(day+1)*86400000).first();
    if(!reserved){job.error='Daily image limit reached. Topics are saved; remaining images retry after midnight UTC.';job.nextAttemptAt=(day+1)*86400000;return;}
    const objectKey=crypto.randomUUID(),url='/api/image/'+objectKey;let retained=false;
    try{
     await bucket.put(objectKey,image.bytes,{httpMetadata:{contentType:image.contentType},customMetadata:{source:image.sourceUrl.slice(0,2000),credit:image.credit.slice(0,500),kind:image.kind}});
     const changed=await db.prepare("UPDATE moments SET image=?,version=version+1 WHERE id=? AND version=1 AND image IS NULL AND status='approved' AND createdBy='newsletter-automation' AND NOT EXISTS (SELECT 1 FROM settings WHERE key=? AND value='true') RETURNING id").bind(url,entry.itemId,'newsletterPaused:'+episode.roomId).first();
     if(changed){retained=true;entry.done=true;entry.note='saved';await db.batch([db.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind('imageCredit:'+entry.itemId,JSON.stringify({image:url,url:image.sourceUrl,label:image.credit,kind:image.kind})),db.prepare('UPDATE rooms SET revision=revision+1 WHERE id=?').bind(episode.roomId)]);}
     else{entry.done=true;entry.note='admin content preserved';}
    }finally{if(!retained){await bucket.delete(objectKey);await db.prepare('UPDATE rates SET count=MAX(0,count-1) WHERE key=?').bind(quota).run();}}
   }));
   await put(db,name,job);
   const failed=results.find(r=>r.status==='rejected');if(failed?.status==='rejected')throw failed.reason;
  }
  if(job.entries.every(e=>e.done)){job.phase='complete';job.error=job.entries.some(e=>e.note==='image unavailable')?'Some source images were unavailable. Add an image on the board or retry.':undefined;}
  await put(db,name,job);return {status:job.phase,added:job.added,images:job.entries.filter(e=>e.note==='saved').length};
 }catch(error){job.error='Newsletter sync will retry automatically. Saved topics and admin edits are preserved.';await put(db,name,job);console.warn('Newsletter sync deferred',episode.videoId,error instanceof Error?error.message:'source error');return {status:'retrying'};}
 finally{await db.prepare('DELETE FROM settings WHERE key=? AND value=?').bind(lock,lease).run();}
}
export async function collectShowNewsletter(db:D1Database,bucket:R2Bucket|undefined,broadcast:{selected:{videoId:string;isLive:boolean};stale:boolean;checkedAt:number},deadline:number){
 const time=Date.now();let result:{status:string;added?:number;images?:number}={status:'watching'};
 if(!broadcast.stale&&time-broadcast.checkedAt<120000){
  const episode=await db.prepare('SELECT roomId,videoId,startedAt FROM episodes WHERE videoId=?').bind(broadcast.selected.videoId).first<{roomId:string;videoId:string;startedAt:number}>();
  const pending=episode?await setting<ShowImport|null>(db,key(episode.roomId),null):null;
  if(episode&&(broadcast.selected.isLive||pending&&pending.phase!=='complete'&&time-episode.startedAt<43200000))result=await importShow(db,bucket,episode,{deadline});
 }
 await put(db,'newsletterAutomationHeartbeat',{checkedAt:time,status:broadcast.stale?'upstream unavailable':result.status});return result;
}
