import type {Visitor} from './room-services';
export async function managesRoom(who:Visitor,db:D1Database,roomId:string){return who.admin||!!who.userId&&!!await db.prepare('SELECT roomId FROM room_hosts WHERE roomId=? AND ownerId=?').bind(roomId,who.userId).first();}
