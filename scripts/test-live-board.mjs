import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const base='http://127.0.0.1:5173';let passed=0;
const check=(condition,label)=>{assert.ok(condition,label);console.log('PASS '+label);passed++;};
async function client(ip,admin=false){let cookie=admin?'__sites_local_auth=1':'';async function call(path,body){const r=await fetch(base+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{'cf-connecting-ip':ip,...(cookie?{cookie}:{}),...(body===undefined?{}:{origin:base,'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});const text=await r.text();let data;try{data=JSON.parse(text);}catch{data={error:text};}return {status:r.status,data,cookie:r.headers.get('set-cookie')};}if(!admin){const c=await call('challenge');let n=0;while(!createHash('sha256').update(c.data.id+':'+n).digest('hex').startsWith('0000'))n++;const verified=await call('verify',{id:c.data.id,nonce:String(n)});assert.equal(verified.status,200);cookie=verified.cookie.split(';')[0];}return call;}
const owner=await client('127.0.2.9',true),a=await client('127.0.2.1'),b=await client('127.0.2.2');
const create=await owner('admin',{action:'room',title:'Live board QA',description:'Disposable local synchronization test',video:''});const roomId=create.data.roomId;assert.ok(roomId);
const items=[];for(const title of ['Moment alpha','Moment beta']){const result=await a('moments',{roomId,title,description:'A test moment',category:'Moment',timestamp:0});assert.equal(result.status,201);items.push(result.data.id);await owner('admin',{action:'moderate',id:result.data.id,status:'approved'});}
let state=(await a('state?room='+roomId)).data;
check(state.shared.length===2&&state.shared.every(p=>p.tier==='U'),'approved moments start in Unranked');
check(!('actor' in state.shared[0])&&!('userId' in state.shared[0]),'live board omits editor identifiers');
const abort=new AbortController();const stream=await fetch(base+'/api/events?room='+roomId,{signal:abort.signal});check(stream.headers.get('content-type')==='text/event-stream','real-time server event stream connects');const reader=stream.body.getReader(),decoder=new TextDecoder();
async function readRevision(after=-1){const until=Date.now()+6000;let content='';while(Date.now()<until){const chunk=await reader.read();if(chunk.done)throw new Error('Stream closed before update');content+=decoder.decode(chunk.value);for(const match of content.matchAll(/data: (\{[^\n]+\})/g)){const data=JSON.parse(match[1]);if(data.revision>after)return data.revision;}}throw new Error('No real-time event');}
const initial=await readRevision();check(initial===state.revision,'stream begins at persisted room revision');
const start=Date.now(),move=await a('move',{roomId,itemId:items[0],tier:'F',score:0,version:0});check(move.status===200,'F tier accepts zero score');
const revision=await readRevision(initial);check(revision>initial&&Date.now()-start<4000,'second viewer receives a live change without refreshing');console.log('Realtime delivery '+(Date.now()-start)+'ms');
state=(await b('state?room='+roomId)).data;check(state.shared.find(p=>p.itemId===items[0]).tier==='F','independent visitors share the same board');
check((await b('move',{roomId,itemId:items[0],tier:'S',score:100,version:0})).status===409,'stale edits cannot overwrite a concurrent move');
const version=state.shared.find(p=>p.itemId===items[0]).version;check((await b('move',{roomId,itemId:items[0],tier:'U',score:50,version,beforeId:items[1]})).status===200,'moments can return to Unranked and be sorted');
state=(await a('state?room='+roomId)).data;check(state.shared.find(p=>p.itemId===items[0]).position<state.shared.find(p=>p.itemId===items[1]).position,'drop order persists');
const moves=await Promise.all(items.map((itemId,i)=>a('move',{roomId,itemId,tier:i?'A':'S',score:i?80:100,version:state.shared.find(p=>p.itemId===itemId).version})));check(moves.every(r=>r.status===200),'concurrent moves of different moments are preserved');
await a('presence',{roomId});await b('presence',{roomId});state=(await a('state?room='+roomId)).data;check(state.online===2,'presence counts actual verified visitors');
check((await a('move',{roomId,itemId:items[0],tier:'Z',score:90,version:3})).status===400,'invalid tiers rejected');
check((await a('vote',{roomId,votes:[{itemId:items[1],tier:'F',score:0}]})).status===200,'personal boards support F tier');
state=(await a('state?room='+roomId)).data;check(state.mine[0].tier==='F'&&state.shared.find(p=>p.itemId===items[1]).tier==='A','personal rankings remain separate from shared placements');
await owner('admin',{action:'roomStatus',id:roomId,status:'closed'});check((await a('move',{roomId,itemId:items[0],tier:'B',score:60,version:3})).status===403,'closed rooms reject shared moves');
abort.abort();await reader.cancel().catch(()=>{});
const legacy=await fetch(base+'/?room=the-warm-up',{redirect:'manual'});check(legacy.status>=300&&legacy.status<400&&legacy.headers.get('location')==='/tier-list?room=the-warm-up','legacy shared links retain their room');
check((await fetch(base+'/tier-list?room=the-warm-up')).status===200,'dedicated tier-list page serves successfully');
console.log(`${passed} live-board checks passed.`);
