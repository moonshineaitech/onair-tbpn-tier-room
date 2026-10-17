import type {Room} from './room-data';

const fields='r.*,e.phase episodePhase,e.lastLiveAt episodeLastLiveAt,e.startedAt episodeStartedAt,e.endedAt episodeEndedAt';
const join='FROM rooms r LEFT JOIN episodes e ON e.roomId=r.id';
export async function findRoom(database:D1Database,id:string){
 return database.prepare(`SELECT ${fields} ${join} WHERE r.id=?`).bind(id).first<Room>();
}
export async function latestEpisodeRoom(database:D1Database,time=Date.now()){
 return database.prepare(`SELECT ${fields} ${join} WHERE e.roomId IS NOT NULL ORDER BY CASE WHEN e.phase='live' AND e.lastLiveAt>=? THEN 0 ELSE 1 END,e.startedAt DESC,r.id DESC LIMIT 1`).bind(time-300000).first<Room>();
}
export async function recentRooms(database:D1Database){
 return (await database.prepare(`SELECT ${fields} ${join} ORDER BY r.createdAt DESC,r.id DESC LIMIT 100`).all<Room>()).results;
}
export async function searchRooms(database:D1Database,query='',kind='all',offset=0){
 const filter=kind==='live'?"e.phase='live'":kind==='replays'?"e.phase='ended'":kind==='custom'?"e.roomId IS NULL AND r.id NOT IN ('tbpn-live','the-warm-up')":'1=1';
 const where=`WHERE ${filter} AND (instr(lower(r.title||' '||r.description),lower(?))>0 OR EXISTS (SELECT 1 FROM moments m WHERE m.roomId=r.id AND m.status='approved' AND instr(lower(m.title||' '||m.description),lower(?))>0))`;
 const q=query.trim().slice(0,80),skip=Number.isSafeInteger(offset)?Math.max(0,Math.min(1000000,offset)):0;
 const [count,rows]=await Promise.all([
  database.prepare(`SELECT COUNT(*) total ${join} ${where}`).bind(q,q).first<{total:number}>(),
  database.prepare(`SELECT ${fields},(SELECT COUNT(*) FROM moments m WHERE m.roomId=r.id AND m.status='approved') momentCount ${join} ${where} ORDER BY COALESCE(e.startedAt,r.createdAt) DESC,r.id DESC LIMIT 30 OFFSET ?`).bind(q,q,skip).all<Room>()
 ]);
 return {rooms:rows.results,total:count?.total||0,offset:skip,pageSize:30};
}
