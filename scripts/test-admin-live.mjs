import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const base='http://127.0.0.1:5173';let checks=0;
const check=(v,label)=>{assert.ok(v,label);console.log('PASS '+label);checks++;};
async function client(ip,admin=false){let cookie=admin?'__sites_local_auth=1':'';const call=async(path,body)=>{const r=await fetch(base+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{'cf-connecting-ip':ip,...(cookie?{cookie}:{}),...(body===undefined?{}:{origin:base,'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')};};if(!admin){const c=await call('challenge');let nonce=0;while(!createHash('sha256').update(c.data.id+':'+nonce).digest('hex').startsWith('0000'))nonce++;const r=await call('verify',{id:c.data.id,nonce:String(nonce)});assert.equal(r.status,200);cookie=r.cookie.split(';')[0];}return call;}
async function subscribe(room){const abort=new AbortController(),r=await fetch(base+'/api/events?room='+room,{signal:abort.signal}),reader=r.body.getReader(),decoder=new TextDecoder();let pending='';return {async next(predicate){const end=Date.now()+6500;while(Date.now()<end){let cut;while((cut=pending.indexOf('\n\n'))>=0){const block=pending.slice(0,cut);pending=pending.slice(cut+2);const json=block.match(/data: (.+)/)?.[1];if(json){const data=JSON.parse(json);if(predicate(data))return data;}}const item=await reader.read();if(item.done)break;pending+=decoder.decode(item.value);}throw new Error('No live event arrived.');},async close(){abort.abort();await reader.cancel().catch(()=>{});}};}
const owner=await client('127.6.0.1',true),viewer=await client('127.6.0.2');
let state=(await owner('state')).data;
check(state.admin&&state.room.id==='tbpn-live'&&state.room.videoId==='channel:UC-DRzaGnL_vtBUpCFH5M0tg','official TBPN live channel is the default room');
const catalog=await subscribe('tbpn-live'),before=await catalog.next(()=>true);
const created=await owner('admin',{action:'room',title:'Admin live QA',description:'Local only',video:'https://www.youtube.com/@tbpnlive/live'});const roomId=created.data.roomId;
check(created.status===200,'admin can add ranking tabs');
check((await catalog.next(d=>d.catalogRevision>before.catalogRevision)).catalogRevision>before.catalogRevision,'tab additions broadcast to viewers in other rooms');await catalog.close();
check((await viewer('state')).data.rooms.some(r=>r.id===roomId),'new tab survives a fresh visitor read');
check((await owner('admin',{action:'editRoom',id:roomId,title:'Renamed board',description:'Updated',video:'https://www.youtube.com/watch?v=AV2LlJ-yw8k'})).status===200,'admin can rename tabs and connect a specific real episode');
state=(await viewer('state?room='+roomId)).data;check(state.room.title==='Renamed board'&&state.room.videoId==='AV2LlJ-yw8k','tab and stream edits persist for another viewer');
const stream=await subscribe(roomId);let revision=(await stream.next(()=>true)).revision;
const bytes=readFileSync(new URL('../public/tbpn-studio.png',import.meta.url)),image='data:image/png;base64,'+bytes.toString('base64');
const fields={roomId,title:'Admin published moment',description:'Context',category:'Moment',timestamp:65};
const createdItem=await owner('moments',{...fields,image,tier:'F'});const id=createdItem.data.id;check(createdItem.status===201,'admin uploads and publishes directly to a chosen tier');
revision=(await stream.next(d=>d.revision>revision)).revision;
state=(await viewer('state?room='+roomId)).data;let item=state.moments.find(m=>m.id===id);
check(item&&item.image&&state.shared.find(p=>p.itemId===id).tier==='F','new moment and F placement reach another viewer live');
check(Buffer.compare(Buffer.from(await (await fetch(base+item.image)).arrayBuffer()),bytes)===0,'uploaded image bytes persist in object storage');
const firstImage=item.image;
check((await viewer('admin',{action:'editMoment',id,version:item.version,...fields})).status===403,'visitors cannot edit admin content');
check((await owner('admin',{action:'editMoment',id,version:item.version,...fields,title:'Updated moment',image})).status===200,'admin can edit content and replace an image');
revision=(await stream.next(d=>d.revision>revision)).revision;
state=(await viewer('state?room='+roomId)).data;item=state.moments.find(m=>m.id===id);
check(item.title==='Updated moment'&&item.version===2&&item.image!==firstImage,'edited content and fresh image URL persist for everyone');
check((await fetch(base+firstImage)).status===404,'replaced images are no longer publicly served');
check((await owner('admin',{action:'editMoment',id,version:1,...fields})).status===409,'stale editor cannot overwrite newer content');
check((await owner('admin',{action:'editMoment',id,version:2,...fields,removeImage:true})).status===200,'admin can remove a moment image');
state=(await viewer('state?room='+roomId)).data;check(state.moments.find(m=>m.id===id).image===null,'image removal is persisted');
const oversized=Buffer.from(bytes);oversized.writeUInt32BE(5000,16);
check((await owner('moments',{...fields,image:'data:image/png;base64,'+oversized.toString('base64')})).status===400,'server rejects images beyond dimension limits');
check((await owner('moments',{...fields,image:'data:image/png;base64,'+Buffer.alloc(2000001).toString('base64')})).status===400,'server rejects images beyond 2 MB');
check((await owner('moments',{...fields,image:'data:image/png;base64,YmFkIGltYWdl'})).status===400,'server rejects fake image data');
const pending=await viewer('moments',{...fields,title:'Viewer submission'});check(pending.status===201&&!(await viewer('state?room='+roomId)).data.moments.some(m=>m.id===pending.data.id),'visitor submissions still require moderation');
check((await owner('moments',{...fields,title:'f u c k'})).status===400,'blocked words also apply to direct admin publishing');
// Exercise the exact shared daily boundary with two concurrent uploads; restore local QA quota afterwards.
const day=Math.floor(Date.now()/86400000),quotaKey='images:'+day,used=100-(await owner('state')).data.uploads.remaining;
const sql=command=>execFileSync(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--config','dist/server/wrangler.json','--persist-to','.wrangler/state','--command',command],{stdio:'pipe'});
try{sql(`INSERT INTO rates (key,count,expires) VALUES ('${quotaKey}',99,${(day+1)*86400000}) ON CONFLICT(key) DO UPDATE SET count=99`);const race=await Promise.all([owner('moments',{...fields,title:'Boundary one',image}),owner('moments',{...fields,title:'Boundary two',image})]);check(race.filter(r=>r.status===201).length===1&&race.filter(r=>r.status===429).length===1,'100-per-day image cap is enforced atomically across concurrent uploads');check((await viewer('state')).data.uploads.remaining===0,'daily remaining quota is shared by everyone');check((await owner('moments',{...fields,title:'Text after image cap'})).status===201,'text-only moments work after the image cap is reached');}finally{sql(`UPDATE rates SET count=${used} WHERE key='${quotaKey}'`);}
await stream.close();console.log(`${checks} admin/live/upload checks passed. QA room: ${roomId}`);
