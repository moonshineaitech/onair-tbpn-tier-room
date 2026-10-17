import {managesRoom} from './room-permissions';
import {ServiceError,type Visitor} from './room-services';
import {timingWrite} from './moment-timing';
export async function timingServices(req:Request,url:URL,path:string,b:any,who:Visitor,db:D1Database){
 if(req.method==='GET'&&path==='timing/status'){
  const roomId=url.searchParams.get('room')||'',room=await db.prepare('SELECT videoId FROM rooms WHERE id=?').bind(roomId).first<{videoId:string|null}>();if(!room)throw new ServiceError('Room not found.',404);
  const row=await db.prepare('SELECT value FROM settings WHERE key=?').bind('timingSync:'+room.videoId).first<{value:string}>();return Response.json(row?JSON.parse(row.value):{status:'waiting for timing source',chapters:0,captions:false},{headers:{'Cache-Control':'no-store'}});
 }
 if(req.method!=='POST'||path!=='timing')return null;
 if(!['set','clear','auto'].includes(b.action)||!Number.isInteger(b.version)||b.version<0)throw new ServiceError('Invalid timing edit.');
 const moment=await db.prepare("SELECT roomId,title FROM moments WHERE id=? AND status='approved'").bind(String(b.itemId||'')).first<{roomId:string;title:string}>();if(!moment||moment.roomId!==b.roomId)throw new ServiceError('Moment not found.',404);
 if(!await managesRoom(who,db,moment.roomId))throw new ServiceError('Host access required.',403);
 const seconds=b.action==='set'?Number(b.seconds):null;if(seconds!==null&&(!Number.isInteger(seconds)||seconds<0||seconds>86400))throw new ServiceError('Use a timestamp within 24 hours.');
 const result=await timingWrite(db,moment.roomId,b.itemId,seconds,b.action==='set'?'admin':'none',b.action!=='auto',b.version,'Admin '+b.action).first();if(!result)throw new ServiceError('This timestamp changed. Refresh the moment and try again.',409);
 await db.batch([db.prepare('UPDATE moments SET timestamp=0 WHERE id=?').bind(b.itemId),db.prepare('UPDATE rooms SET revision=revision+1 WHERE id=?').bind(moment.roomId),db.prepare('INSERT INTO audit (id,actor,action,detail,createdAt) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),who.account?.email||who.userId!,'timestamp:'+b.action,moment.title+' · '+(seconds??'pending'),Date.now())]);
 return Response.json({ok:true,version:(result as {version:number}).version});
}
