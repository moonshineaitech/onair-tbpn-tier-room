import {TIERS,type Moment,type Vote} from './room-data';
import {emptyReaction,type BoardPost} from './community-data';
export type PublicBoard={post:BoardPost;room:{id:string;title:string};moments:Moment[];version:string};
export async function publicBoard(database:D1Database,id:string,roomId=''):Promise<PublicBoard|null>{
 if(!/^(?:[a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i.test(id)||roomId.length>100)return null;
 const row=await database.prepare("SELECT p.id,p.roomId,p.title,p.byline,p.entries,p.createdAt,p.updatedAt,p.automatic,r.title episodeTitle FROM board_posts p JOIN rooms r ON r.id=p.roomId WHERE p.id=? AND p.status='visible' AND (?='' OR p.roomId=?)").bind(id,roomId,roomId).first<{id:string;roomId:string;title:string;byline:string;entries:string;createdAt:number;updatedAt:number;automatic:number;episodeTitle:string}>();
 if(!row)return null;
 const moments=(await database.prepare("SELECT id,roomId,title,description,category,timestamp,image,status,createdAt,version FROM moments WHERE roomId=? AND status='approved' ORDER BY createdAt,id").bind(row.roomId).all<Moment>()).results;
 const approved=new Set(moments.map(m=>m.id)),seen=new Set<string>();let saved:unknown;try{saved=JSON.parse(row.entries);}catch{return null;}if(!Array.isArray(saved))return null;
 const entries:Vote[]=saved.filter((e):e is Vote=>{if(!e||typeof e.itemId!=='string'||!approved.has(e.itemId)||seen.has(e.itemId)||!TIERS.some(t=>t.id===e.tier)||!Number.isFinite(e.score)||e.score<0||e.score>100)return false;seen.add(e.itemId);return true;}).map(({itemId,tier,score})=>({itemId,tier,score}));
 const post:BoardPost={id:row.id,roomId:row.roomId,title:row.title,byline:row.byline,entries,createdAt:row.createdAt,updatedAt:row.updatedAt,automatic:!!row.automatic,own:false,reactions:emptyReaction()};
 const fingerprint=JSON.stringify([row.roomId==='thiel-nashville-2026'?'board-predictions-v1':'board-card-v4',post.id,post.title,post.byline,post.updatedAt,post.entries,row.episodeTitle,moments.map(m=>[m.id,m.title,m.category,m.image])]);
 const version=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(fingerprint)))).map(n=>n.toString(16).padStart(2,'0')).join('').slice(0,24);
 return {post,room:{id:row.roomId,title:row.episodeTitle},moments,version};
}
