import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
const base='http://127.0.0.1:5173';
let cookie='';
const admin={cookie:'__sites_local_auth=1'};
let passed=0;
function check(condition,label){assert.ok(condition,label);passed++;console.log('PASS '+label);}
async function call(path,body,headers={}){const r=await fetch(base+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{'cf-connecting-ip':'127.0.1.1',...(body===undefined?{}:{'Content-Type':'application/json',origin:base}),...(cookie?{cookie}:{}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});const text=await r.text();let data;try{data=JSON.parse(text);}catch{data={error:text};}return {status:r.status,data,cookie:r.headers.get('set-cookie')};}
const state=await call('state?room=the-warm-up');check(state.status===200&&state.data.moments.length===6,'public read and sample data');
check((await call('vote',{roomId:'the-warm-up',votes:[]})).status===401,'unverified writes rejected');
check((await call('admin')).status===403,'moderation requires an admin');
check((await call('verify',{}, {origin:'https://other.example'})).status===403,'cross-origin writes rejected');
const challenge=await call('challenge');const started=Date.now();let nonce=0;while(!createHash('sha256').update(challenge.data.id+':'+nonce).digest('hex').startsWith('0000'))nonce++;
const verified=await call('verify',{id:challenge.data.id,nonce:String(nonce)});check(verified.status===200,'browser verification creates a session');cookie=verified.cookie.split(';')[0];console.log('Proof computation '+(Date.now()-started)+' ms');
check((await call('verify',{id:challenge.data.id,nonce:String(nonce)})).status===403,'verification proof cannot be replayed');
check((await call('state')).data.verified,'verified session persists');
const created=await call('admin',{action:'room',title:'QA episode',description:'Local test only',video:'https://youtube.com/watch?v=dQw4w9WgXcQ'},admin);check(created.status===200,'admin creates episode rooms');const roomId=created.data.roomId;
const body={roomId,title:'A thoughtful test moment',description:'Useful context',category:'Moment',timestamp:65};
const image='data:image/png;base64,'+readFileSync(new URL('../public/tbpn-studio.png',import.meta.url)).toString('base64');
const submitted=await call('moments',{...body,image});check(submitted.status===201,'image submission persists for moderation');const itemId=submitted.data.id;
check((await call('state?room='+roomId)).data.moments.length===0,'pending content stays private');
const queue=await call('admin',undefined,admin);check(queue.data.queue.some(m=>m.id===itemId),'admin sees pending submissions');
const imagePath=queue.data.queue.find(m=>m.id===itemId).image;
const imgPending=await fetch(base+imagePath,{headers:{cookie}});check(imgPending.status===404,'pending images are not public');
check((await call('admin',{action:'moderate',id:itemId,status:'approved'},admin)).status===200,'admin approval publishes a moment');
check((await fetch(base+imagePath)).status===200,'approved image is served');
check((await call('vote',{roomId,votes:[{itemId,tier:'A',score:83}]})).status===200,'save board');
let updated=(await call('state?room='+roomId)).data;check(updated.hasBoard&&updated.mine[0].score===83&&updated.moments[0].score===83,'board and aggregate survive reload');
await call('vote',{roomId,votes:[{itemId,tier:'S',score:96}]});updated=(await call('state?room='+roomId)).data;check(updated.stats.votes===1&&updated.moments[0].score===96,'new scores replace previous votes');
await call('vote',{roomId,votes:[]});updated=(await call('state?room='+roomId)).data;check(updated.hasBoard&&updated.mine.length===0&&updated.stats.votes===0,'empty boards persist and remove prior votes');
check((await call('moments',{...body,title:'f u c k this'})).status===400,'obfuscated blocked words rejected');
check((await call('moments',{...body,title:'grapes are good'})).status===201,'harmless substrings allowed');
const attempts=await Promise.all([call('moments',{...body,title:'Third test'}),call('moments',{...body,title:'Fourth test'})]);check(attempts.filter(r=>r.status===201).length===1&&attempts.some(r=>r.status===429),'submission quota enforced atomically');
check((await call('report',{itemId,reason:'Please review this example.'})).status===200,'viewer reports reach moderation');
check((await call('admin',{action:'moderate',id:itemId,status:'hidden'},admin)).status===200,'admin can hide published content');
check((await call('state?room='+roomId)).data.moments.length===0,'hidden content disappears from public board');
await call('admin',{action:'roomStatus',id:roomId,status:'closed'},admin);check((await call('vote',{roomId,votes:[]})).status===403,'closed rooms reject votes');
check((await call('admin',{action:'room',title:'Unauthorized room',description:'',video:''})).status===403,'visitors cannot invoke admin mutations');
console.log(`${passed} checks passed. Local QA room: ${roomId}`);



