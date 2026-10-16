import type {Broadcast} from './tbpn-stream';
import {currentBroadcast} from './tbpn-stream';

// A single INSERT...SELECT freezes the saved rankings, even if the viewer closed
// their browser. One post per owner and episode makes repeated checks idempotent.
export function automaticPosts(database:D1Database,roomId:string,time=Date.now()){
 return database.prepare(`INSERT INTO board_posts (id,roomId,userId,title,byline,entries,createdAt,updatedAt,automatic,status)
 SELECT lower(hex(randomblob(16))),b.roomId,b.userId,b.title,b.byline,
 (SELECT json_group_array(json_object('itemId',v.itemId,'tier',v.tier,'score',v.score)) FROM votes v JOIN moments m ON m.id=v.itemId WHERE v.userId=b.userId AND m.roomId=b.roomId AND m.status='approved'),?,?,1,'visible'
 FROM boards b WHERE b.roomId=? AND b.autoPublish=1 AND EXISTS (SELECT 1 FROM votes v JOIN moments m ON m.id=v.itemId WHERE v.userId=b.userId AND m.roomId=b.roomId AND m.status='approved')
 ON CONFLICT(roomId,userId) DO UPDATE SET entries=excluded.entries,title=excluded.title,byline=excluded.byline,updatedAt=excluded.updatedAt,automatic=1 WHERE board_posts.status='visible'`).bind(time,time,roomId);
}
export async function finishEpisode(database:D1Database,roomId:string,time=Date.now()){
 const marker='episodeEnded:'+roomId;if(await database.prepare('SELECT key FROM settings WHERE key=?').bind(marker).first())return;
 await database.batch([
  database.prepare("UPDATE episodes SET phase='ended',endedAt=COALESCE(endedAt,?) WHERE roomId=?").bind(time,roomId),
  automaticPosts(database,roomId,time),
  database.prepare('UPDATE boards SET publishedId=(SELECT id FROM board_posts p WHERE p.roomId=boards.roomId AND p.userId=boards.userId) WHERE roomId=? AND autoPublish=1').bind(roomId),
  database.prepare('UPDATE rooms SET revision=revision+1 WHERE id=?').bind(roomId),
  database.prepare('INSERT OR IGNORE INTO settings (key,value) VALUES (?,?)').bind(marker,String(time))
 ]);
}
export async function syncEpisodes(database:D1Database,broadcast:Broadcast,time=Date.now()){
 if(broadcast.stale||!broadcast.checkedAt||time-broadcast.checkedAt>120000)return {stale:true,created:0,ended:0};
 const handled=await database.prepare("SELECT value FROM settings WHERE key='episodeLastCheck'").first<{value:string}>();if(Number(handled?.value||0)>=broadcast.checkedAt)return {stale:false,created:0,ended:0};
 let created=0,ended=0;
 const video=broadcast.selected;
 if(video.isLive){
  const id='show-'+video.videoId,existing=await database.prepare('SELECT roomId FROM episodes WHERE videoId=?').bind(video.videoId).first();
  if(!existing){
   const date=new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',month:'short',day:'numeric',year:'numeric'}).format(time);
   await database.batch([
    database.prepare("INSERT OR IGNORE INTO rooms (id,title,description,videoId,status,createdAt,revision,chatRevision) VALUES (?,?,?,?,'open',?,0,0)").bind(id,'TBPN · '+date,video.title,video.videoId,time),
    database.prepare("INSERT OR IGNORE INTO episodes (videoId,roomId,title,startedAt,lastLiveAt,phase) VALUES (?,?,?,?,?,'live')").bind(video.videoId,id,video.title,time,broadcast.checkedAt),
    database.prepare("INSERT INTO settings (key,value) VALUES ('catalogRevision','1') ON CONFLICT(key) DO UPDATE SET value=CAST(CAST(value AS INTEGER)+1 AS TEXT)")
   ]);created=1;
  }
  await database.prepare("UPDATE episodes SET lastLiveAt=?,offlineSince=NULL WHERE videoId=? AND phase='live'").bind(broadcast.checkedAt,video.videoId).run();
 }
 // A first visit after a show ends still gets a distinct replay episode. The
 // title identifies the broadcast; the discovery time is not claimed as air date.
 if(!video.isLive&&!await database.prepare('SELECT videoId FROM episodes WHERE videoId=?').bind(video.videoId).first()){
  const id='show-'+video.videoId;
  await database.batch([
   database.prepare("INSERT OR IGNORE INTO rooms (id,title,description,videoId,status,createdAt,revision,chatRevision) VALUES (?,?,?,?,'open',?,0,0)").bind(id,('TBPN · '+video.title).slice(0,90),video.title,video.videoId,time),
   database.prepare("INSERT OR IGNORE INTO episodes (videoId,roomId,title,startedAt,lastLiveAt,endedAt,phase) VALUES (?,?,?,?,0,?,'ended')").bind(video.videoId,id,video.title,time,broadcast.checkedAt),
   database.prepare("INSERT INTO settings (key,value) VALUES ('catalogRevision','1') ON CONFLICT(key) DO UPDATE SET value=CAST(CAST(value AS INTEGER)+1 AS TEXT)")
  ]);created++;
 }
 const active=(await database.prepare("SELECT videoId,roomId,offlineSince FROM episodes WHERE phase='live' ORDER BY startedAt DESC LIMIT 10").all<{videoId:string;roomId:string;offlineSince:number|null}>()).results;
 for(const episode of active){
  if(video.isLive&&episode.videoId===video.videoId)continue;
  // Never infer an ending from a failed fetch, or from one transient missing badge.
  if(episode.offlineSince===null)await database.prepare("UPDATE episodes SET offlineSince=? WHERE videoId=? AND phase='live' AND offlineSince IS NULL").bind(broadcast.checkedAt,episode.videoId).run();
  else if(broadcast.checkedAt-episode.offlineSince>=120000){await finishEpisode(database,episode.roomId,broadcast.checkedAt);ended++;}
 }
 await database.prepare("INSERT INTO settings (key,value) VALUES ('episodeLastCheck',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(value AS INTEGER)<CAST(excluded.value AS INTEGER)").bind(String(broadcast.checkedAt)).run();
 return {stale:false,created,ended};
}
export async function checkEpisodes(database:D1Database){const broadcast=await currentBroadcast(database);return {broadcast,...await syncEpisodes(database,broadcast)};}
