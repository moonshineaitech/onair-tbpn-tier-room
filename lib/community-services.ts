import {managesRoom} from './room-permissions';
import {ServiceError,type Visitor} from './room-services';
import {REACTION_VALUES,emptyReaction,summarizeDistribution,type ReactionTarget,type ReactionSummary,type BoardPost,type PersonalBoard} from './community-data';
import {TIERS,initialPlacement,type Moment} from './room-data';
import {finishEpisode} from './episode-lifecycle';

type Deps={checkText:(text:string,roomId?:string)=>Promise<void>;rate:(key:string,limit:number,windowMs?:number)=>Promise<void>;log:(actor:string,action:string,detail:string)=>Promise<void>};
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const text=(v:unknown,max:number,required=true)=>{if(typeof v!=='string'||v.length>max||(required&&!v.trim()))throw new ServiceError('Check the text and character limits.');return v.trim();};
const touch=(database:D1Database,roomId:string)=>database.prepare('UPDATE rooms SET revision=revision+1 WHERE id=?').bind(roomId);
async function roomExists(database:D1Database,roomId:string){if(!await database.prepare('SELECT id FROM rooms WHERE id=?').bind(roomId).first())throw new ServiceError('Episode not found.',404);}

export async function reactionSummary(database:D1Database,roomId:string,type:string,id:string,userId:string|null):Promise<ReactionSummary>{
 const rows=(await database.prepare('SELECT value,COUNT(*) n,MAX(CASE WHEN userId=? THEN 1 ELSE 0 END) mine FROM reactions WHERE roomId=? AND targetType=? AND targetId=? GROUP BY value').bind(userId||'',roomId,type,id).all<{value:string;n:number;mine:number}>()).results;
 const result=emptyReaction();for(const row of rows){result.counts[row.value]=Number(row.n);if(row.mine)result.mine.push(row.value);}result.net=(result.counts.up||0)-(result.counts.down||0);return result;
}
export async function communityState(database:D1Database,roomId:string,userId:string|null){
 const [rankings,board,episode,published,pulses]=await Promise.all([
  database.prepare("SELECT v.itemId,v.tier,COUNT(*) count,AVG(v.score) average FROM votes v JOIN moments m ON m.id=v.itemId WHERE m.roomId=? AND m.status='approved' GROUP BY v.itemId,v.tier").bind(roomId).all<{itemId:string;tier:string;count:number;average:number}>(),
  userId?database.prepare('SELECT title,byline,autoPublish,publishedId,updatedAt,version FROM boards WHERE roomId=? AND userId=?').bind(roomId,userId).first<PersonalBoard>():null,
  database.prepare('SELECT videoId,roomId,title,phase,startedAt,endedAt FROM episodes WHERE roomId=?').bind(roomId).first(),
  database.prepare("SELECT COUNT(*) n FROM board_posts WHERE roomId=? AND status='visible'").bind(roomId).first<{n:number}>(),
  database.prepare("SELECT r.targetId,r.value,COUNT(*) n FROM reactions r JOIN moments m ON m.id=r.targetId AND m.roomId=r.roomId WHERE r.roomId=? AND r.targetType='moment' AND m.status='approved' GROUP BY r.targetId,r.value").bind(roomId).all<{targetId:string;value:string;n:number}>()
 ]);
 const momentReactions:Record<string,{total:number;net:number;likes:number}>={};for(const r of pulses.results){const p=momentReactions[r.targetId]||={total:0,net:0,likes:0};p.total+=Number(r.n);if(r.value==='up')p.net+=Number(r.n);if(r.value==='down')p.net-=Number(r.n);if(r.value==='like')p.likes=Number(r.n);}
 return {distribution:summarizeDistribution(rankings.results),personalBoard:board?{...board,autoPublish:!!board.autoPublish}:null,episode,publishedCount:published?.n||0,momentReactions};
}
async function validTarget(database:D1Database,roomId:string,type:ReactionTarget,id:string){
 if(type==='board'){if(!await database.prepare("SELECT id FROM board_posts WHERE id=? AND roomId=? AND status='visible'").bind(id,roomId).first())throw new ServiceError('Board not found.',404);return;}
 if(type==='ranking'){
  const [postId,itemId,...extra]=id.split(':');if(extra.length)throw new ServiceError('Invalid ranking.');
  const post=await database.prepare("SELECT entries FROM board_posts WHERE id=? AND roomId=? AND status='visible'").bind(postId,roomId).first<{entries:string}>();
  if(!post||!JSON.parse(post.entries).some((v:{itemId:string})=>v.itemId===itemId))throw new ServiceError('Ranking not found.',404);
  if(!await database.prepare("SELECT id FROM moments WHERE id=? AND roomId=? AND status='approved'").bind(itemId,roomId).first())throw new ServiceError('Moment not found.',404);return;
 }
 const [itemId,tier,...extra]=id.split(':');if(extra.length||(type==='moment'&&tier)||(type==='live-rank'&&!TIERS.some(t=>t.id===tier)))throw new ServiceError('Invalid ranking.');
 const moment=await database.prepare("SELECT id FROM moments WHERE id=? AND roomId=? AND status='approved'").bind(itemId,roomId).first<{id:string}>();if(!moment)throw new ServiceError('Moment not found.',404);
 if(type==='live-rank'){const placement=await database.prepare('SELECT tier FROM placements WHERE roomId=? AND itemId=?').bind(roomId,itemId).first<{tier:string}>();if((placement?.tier||initialPlacement(moment as Moment,0).tier)!==tier)throw new ServiceError('This live placement changed. Open its latest tier to react.',409);}
}
async function posts(database:D1Database,roomId:string,userId:string|null,id:string|null,sort:string,offset=0,query=''){
 const order=sort==='top'?"COALESCE((SELECT SUM(CASE value WHEN 'up' THEN 1 WHEN 'down' THEN -1 ELSE 0 END) FROM reactions r WHERE r.targetType='board' AND r.targetId=p.id AND r.roomId=p.roomId),0) DESC,p.createdAt DESC":'p.createdAt DESC';
 const result=(await database.prepare(`SELECT p.* FROM board_posts p WHERE p.roomId=? AND p.status='visible' ${id?'AND p.id=?':''} AND instr(lower(p.title||' '||p.byline),lower(?))>0 ORDER BY ${order} LIMIT 100 OFFSET ?`).bind(...(id?[roomId,id,query,0]:[roomId,query,offset])).all<{id:string;roomId:string;userId:string;title:string;byline:string;entries:string;createdAt:number;updatedAt:number;automatic:number;status:string}>()).results;
 const approved=new Set((await database.prepare("SELECT id FROM moments WHERE roomId=? AND status='approved'").bind(roomId).all<{id:string}>()).results.map(m=>m.id));
 const reactions=(await database.prepare("SELECT targetId,value,COUNT(*) n,MAX(CASE WHEN userId=? THEN 1 ELSE 0 END) mine FROM reactions WHERE roomId=? AND targetType='board' GROUP BY targetId,value").bind(userId||'',roomId).all<{targetId:string;value:string;n:number;mine:number}>()).results;
 const summaries=new Map<string,ReactionSummary>();for(const row of reactions){const summary=summaries.get(row.targetId)||emptyReaction();summary.counts[row.value]=Number(row.n);if(row.mine)summary.mine.push(row.value);summary.net=(summary.counts.up||0)-(summary.counts.down||0);summaries.set(row.targetId,summary);}
 return result.map(({userId:owner,status:_,entries,automatic,...p}):BoardPost=>({...p,entries:JSON.parse(entries).filter((v:{itemId:string})=>approved.has(v.itemId)),automatic:!!automatic,own:owner===userId,reactions:summaries.get(p.id)||emptyReaction()}));
}
export async function communityServices(req:Request,url:URL,path:string,b:any,who:Visitor,database:D1Database,deps:Deps):Promise<Response|null>{
 if(!['community','reactions','boards/settings','boards/publish','boards/unpublish','boards/moderate','posts','insights','insights/export','episode/finish'].includes(path))return null;
 const roomId=text(req.method==='GET'?url.searchParams.get('room'):b.roomId,100);await roomExists(database,roomId);
 if(req.method==='GET'){
  if(path==='community')return reply(await communityState(database,roomId,who.userId));
  if(path==='reactions'){const type=text(url.searchParams.get('type'),20) as ReactionTarget,id=text(url.searchParams.get('id'),220);if(!['moment','live-rank','board','ranking'].includes(type))throw new ServiceError('Invalid reaction target.');await validTarget(database,roomId,type,id);return reply(await reactionSummary(database,roomId,type,id,who.userId));}
  if(path==='posts')return reply({posts:await posts(database,roomId,who.userId,url.searchParams.get('id'),url.searchParams.get('sort')||'newest',Math.min(1000000,Math.max(0,Math.floor(Number(url.searchParams.get('offset'))||0))),(url.searchParams.get('q')||'').slice(0,80))});
  if(path==='insights'||path==='insights/export'){
   if(!await managesRoom(who,database,roomId))throw new ServiceError('Host access required.',403);
   const data=await communityState(database,roomId,who.userId),moments=(await database.prepare("SELECT m.id,m.title,m.category,CASE WHEN t.itemId IS NOT NULL THEN t.seconds WHEN m.timestamp>0 THEN m.timestamp END timestamp,COALESCE(t.source,CASE WHEN m.timestamp>0 THEN 'author' ELSE 'none' END) timingSource,(SELECT COUNT(*) FROM chat_messages c WHERE c.roomId=m.roomId AND c.momentId=m.id AND c.status='visible') comments,(SELECT COUNT(DISTINCT userId) FROM chat_messages c WHERE c.roomId=m.roomId AND c.momentId=m.id AND c.status='visible') commenters FROM moments m LEFT JOIN moment_timings t ON t.itemId=m.id WHERE m.roomId=? AND m.status='approved'").bind(roomId).all<{id:string;title:string;category:string;timestamp:number|null;timingSource:string;comments:number;commenters:number}>()).results;
   const participants=(await database.prepare("SELECT COUNT(DISTINCT v.userId) n FROM votes v JOIN moments m ON m.id=v.itemId WHERE m.roomId=? AND m.status='approved'").bind(roomId).first<{n:number}>())?.n||0;
   const episodeVideo=(await database.prepare('SELECT videoId FROM rooms WHERE id=?').bind(roomId).first<{videoId:string|null}>())?.videoId;
   const segments=moments.map(m=>{const d=data.distribution.find(v=>v.itemId===m.id),n=d?.total||0,positive=n?Math.round(((d?.tiers.S||0)+(d?.tiers.A||0))/n*100):0,negative=n?Math.round(((d?.tiers.D||0)+(d?.tiers.F||0))/n*100):0;const suggestion=n<5?'Gather more ratings':(d?.polarization||0)>=50?'Test contrasting hooks':positive>=60?'Test as a highlight clip':negative>=50?'Review pacing or format':'Keep and compare next episode';return {...m,watchUrl:m.timestamp!==null&&episodeVideo&&/^[-\w]{11}$/.test(episodeVideo)?'https://www.youtube.com/watch?v='+episodeVideo+'&t='+m.timestamp+'s':null,...d,total:n,positive,negative,coverage:participants?Math.round(n/participants*100):0,reactions:data.momentReactions[m.id]||{total:0,net:0,likes:0},suggestion};});
   const result={participants,publishedCount:data.publishedCount,episode:data.episode,segments};
   if(path==='insights')return reply(result);
   const cell=(v:unknown)=>'"'+String(v??'').replace(/"/g,'""').replace(/^([=+@\-\t\r])/,'\'$1')+'"';
   const rows=[['Segment','Category','Start seconds','Timestamp source','Watch URL','Topic comments','Commenting identities','Rating identities','Small sample (<5)','Coverage %','Mean score','S','A','B','C','D','F','S %','F %','S+A %','D+F %','Polarization %','Up/down net','Likes','Next test'],...segments.map(s=>[s.title,s.category,s.timestamp??'',s.timingSource,s.watchUrl||'',s.comments,s.commenters,s.total,s.total<5?'yes':'no',s.coverage,s.average??'',...TIERS.map(t=>s.tiers?.[t.id]||0),s.sPercent||0,s.fPercent||0,s.positive,s.negative,s.polarization||0,s.reactions.net,s.reactions.likes,s.suggestion])];
   return new Response(rows.map(r=>r.map(cell).join(',')).join('\r\n'),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="tbpn-${roomId.replace(/[^\w-]/g,'')}-insights.csv"`,'Cache-Control':'no-store'}});
  }
  return null;
 }
 if(req.method!=='POST')return null;
 if(path==='reactions'){
  const type=text(b.type,20) as ReactionTarget,id=text(b.id,220),value=text(b.value,12);if(!['moment','live-rank','board','ranking'].includes(type)||!REACTION_VALUES.includes(value)||typeof b.active!=='boolean')throw new ServiceError('Choose a valid reaction.');await validTarget(database,roomId,type,id);await deps.rate('react:'+who.userId,120);
  const statements=[];if(b.active&&['up','down'].includes(value))statements.push(database.prepare("DELETE FROM reactions WHERE roomId=? AND targetType=? AND targetId=? AND userId=? AND value IN ('up','down') AND value!=?").bind(roomId,type,id,who.userId,value));
  statements.push(b.active?database.prepare('INSERT OR IGNORE INTO reactions (roomId,targetType,targetId,userId,value,createdAt) VALUES (?,?,?,?,?,?)').bind(roomId,type,id,who.userId,value,Date.now()):database.prepare('DELETE FROM reactions WHERE roomId=? AND targetType=? AND targetId=? AND userId=? AND value=?').bind(roomId,type,id,who.userId,value));statements.push(touch(database,roomId));await database.batch(statements);return reply(await reactionSummary(database,roomId,type,id,who.userId));
 }
 if(path==='boards/settings'){
  const title=text(b.title,70),byline=text(b.byline,30);if(typeof b.autoPublish!=='boolean')throw new ServiceError('Choose an auto-post setting.');await deps.checkText(title+' '+byline,roomId);
  await database.prepare('INSERT INTO boards (userId,roomId,updatedAt,title,byline,autoPublish,version) VALUES (?,?,?,?,?,?,1) ON CONFLICT(userId,roomId) DO UPDATE SET title=excluded.title,byline=excluded.byline,autoPublish=excluded.autoPublish,version=boards.version+1').bind(who.userId,roomId,Date.now(),title,byline,b.autoPublish?1:0).run();await touch(database,roomId).run();return reply({ok:true});
 }
 if(path==='boards/publish'){
  await deps.rate('publish:'+who.userId,15);
  const board=await database.prepare('SELECT title,byline FROM boards WHERE roomId=? AND userId=?').bind(roomId,who.userId).first<{title:string;byline:string}>();if(!board)throw new ServiceError('Rank a moment on My board first.');
  await deps.checkText(board.title+' '+board.byline,roomId);
  const entries=(await database.prepare("SELECT v.itemId,v.tier,v.score FROM votes v JOIN moments m ON m.id=v.itemId WHERE v.userId=? AND m.roomId=? AND m.status='approved'").bind(who.userId,roomId).all()).results;if(!entries.length)throw new ServiceError('Rank at least one moment before posting.');
  const previous=await database.prepare('SELECT id,status FROM board_posts WHERE roomId=? AND userId=?').bind(roomId,who.userId).first<{id:string;status:string}>();if(previous?.status==='hidden')throw new ServiceError('This board is hidden by a moderator.',403);
  const id=previous?.id||crypto.randomUUID(),time=Date.now();await database.batch([database.prepare("INSERT INTO board_posts (id,roomId,userId,title,byline,entries,createdAt,updatedAt,automatic,status) VALUES (?,?,?,?,?,?,?,?,0,'visible') ON CONFLICT(roomId,userId) DO UPDATE SET title=excluded.title,byline=excluded.byline,entries=excluded.entries,updatedAt=excluded.updatedAt,automatic=0,status='visible'").bind(id,roomId,who.userId,board.title,board.byline,JSON.stringify(entries),time,time),database.prepare('UPDATE boards SET publishedId=? WHERE roomId=? AND userId=?').bind(id,roomId,who.userId),touch(database,roomId)]);return reply({ok:true,id});
 }
 if(path==='boards/unpublish'){
  await database.batch([database.prepare("UPDATE board_posts SET status='withdrawn' WHERE roomId=? AND userId=? AND status!='hidden'").bind(roomId,who.userId),database.prepare('UPDATE boards SET publishedId=NULL,autoPublish=0 WHERE roomId=? AND userId=?').bind(roomId,who.userId),touch(database,roomId)]);return reply({ok:true});
 }
 if(path==='boards/moderate'){
  if(!await managesRoom(who,database,roomId))throw new ServiceError('Host access required.',403);const id=text(b.id,100);await database.batch([database.prepare("UPDATE board_posts SET status=? WHERE id=? AND roomId=?").bind(b.hidden===false?'visible':'hidden',id,roomId),touch(database,roomId)]);await deps.log(who.account?.email||who.userId!,'board:moderate',id);return reply({ok:true});
 }
 if(path==='episode/finish'){
  if(!await managesRoom(who,database,roomId))throw new ServiceError('Host access required.',403);await finishEpisode(database,roomId);await deps.log(who.account?.email||who.userId!,'episode:finish',roomId);return reply({ok:true});
 }
 return null;
}
