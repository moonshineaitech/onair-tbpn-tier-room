import type {Room} from './room-data';

const fields='r.*,e.phase episodePhase,e.lastLiveAt episodeLastLiveAt,e.startedAt episodeStartedAt,e.endedAt episodeEndedAt,m.playbackId streamPlaybackId,m.title streamTitle,m.thumbnail streamThumbnail,m.liveStatus streamLiveStatus,m.statusCheckedAt streamStatusCheckedAt,m.checkedAt streamCheckedAt';
const join='FROM rooms r LEFT JOIN episodes e ON e.roomId=r.id LEFT JOIN stream_metadata m ON m.source=r.videoId';
const live="(CASE WHEN m.checkedAt>COALESCE(e.lastLiveAt,0) THEN m.liveStatus='live' AND m.statusCheckedAt>=? ELSE e.phase='live' AND e.lastLiveAt>=? END)";
export async function findRoom(database:D1Database,id:string){
 return database.prepare(`SELECT ${fields} ${join} WHERE r.id=?`).bind(id).first<Room>();
}
export async function latestEpisodeRoom(database:D1Database,time=Date.now()){
 return database.prepare(`SELECT ${fields} ${join} WHERE e.roomId IS NOT NULL ORDER BY CASE WHEN e.phase='live' AND e.lastLiveAt>=? THEN 0 ELSE 1 END,e.startedAt DESC,r.id DESC LIMIT 1`).bind(time-180000).first<Room>();
}
export async function recentRooms(database:D1Database){
 return (await database.prepare(`SELECT ${fields} ${join} ORDER BY r.createdAt DESC,r.id DESC LIMIT 100`).all<Room>()).results;
}
export async function searchRooms(database:D1Database,query='',kind='all',offset=0,time=Date.now()){
 const since=time-180000,filter=kind==='live'?live:kind==='replays'?"(e.phase='ended' OR m.liveStatus='replay')":kind==='custom'?"e.roomId IS NULL AND r.id NOT IN ('tbpn-live','the-warm-up')":'1=1',args=kind==='live'?[since,since]:[];
 const where=`WHERE ${filter} AND (instr(lower(r.title||' '||r.description||' '||COALESCE(m.title,'')),lower(?))>0 OR EXISTS (SELECT 1 FROM moments m WHERE m.roomId=r.id AND m.status='approved' AND instr(lower(m.title||' '||m.description),lower(?))>0))`;
 const q=query.trim().slice(0,80),skip=Number.isSafeInteger(offset)?Math.max(0,Math.min(1000000,offset)):0;
 const [count,rows]=await Promise.all([
  database.prepare(`SELECT COUNT(*) total ${join} ${where}`).bind(...args,q,q).first<{total:number}>(),
  database.prepare(`SELECT ${fields},(SELECT COUNT(*) FROM moments m WHERE m.roomId=r.id AND m.status='approved') momentCount ${join} ${where} ORDER BY CASE WHEN ${live} THEN 0 ELSE 1 END,COALESCE(e.startedAt,r.createdAt) DESC,r.id DESC LIMIT 30 OFFSET ?`).bind(...args,q,q,since,since,skip).all<Room>()
 ]);
 return {rooms:rows.results,total:count?.total||0,offset:skip,pageSize:30};
}
