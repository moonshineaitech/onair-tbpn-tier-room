import assert from 'node:assert/strict';
import {createHash,randomInt,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import ts from 'typescript';
const cache=new Map();function moduleUrl(file){file=resolve(file);if(cache.has(file))return cache.get(file);let js=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;js=js.replace(/from\s+(['"])(\.[^'"]+)\1/g,(_,q,p)=>'from '+q+moduleUrl(resolve(dirname(file),p+'.ts'))+q);const url='data:text/javascript;base64,'+Buffer.from(js).toString('base64');cache.set(file,url);return url;}
const {chatOutboxKey,serializeChatOutbox,readChatOutbox,acknowledgeChatOutbox}=await import(moduleUrl('lib/chat-data.ts'));
let checks=0;function check(value,label){assert.ok(value,label);console.log('PASS '+label);checks++;}
const time=Date.now(),id=randomUUID(),payload={roomId:'room',clientId:id,body:'My take',author:'Viewer',momentId:null},delivery={payload,message:{id,body:payload.body,author:'Viewer',role:'admin',own:true,createdAt:time,videoSeconds:null,videoId:null,momentId:null},status:'sending'},raw=serializeChatOutbox([delivery],time),restored=readChatOutbox(raw,'room',time);
check(restored.length===1&&restored[0].payload.clientId===id&&restored[0].status==='failed','an interrupted send restores with its original ID and requires an explicit retry');
check(restored[0].message.role==='member'&&!raw.includes('"role"'),'browser outbox records cannot forge a saved moderator role');
check(chatOutboxKey('a','room')!==chatOutboxKey('b','room')&&chatOutboxKey('a','room')!==chatOutboxKey('a','other')&&!chatOutboxKey('','room'),'outbox storage is isolated by opaque identity and room');
check(!readChatOutbox(raw,'other',time).length,'messages from another room cannot restore into the current chat');
check(!readChatOutbox(raw,'room',time+8*86400000).length&&!readChatOutbox(raw,'room',time-120000).length,'expired and future-dated outboxes are discarded');
check(!readChatOutbox('{broken','room').length&&!readChatOutbox('x'.repeat(40001),'room').length,'corrupt and oversized storage is ignored safely');
const mutate=fn=>{const data=JSON.parse(raw);fn(data.entries[0].payload);return JSON.stringify(data);};
check(!readChatOutbox(mutate(p=>p.body='x'.repeat(501)),'room').length&&!readChatOutbox(mutate(p=>p.clientId='fake'),'room').length,'recovery rejects invalid text and message IDs');
check(!readChatOutbox(mutate(p=>p.momentId={id:'fake'}),'room').length,'recovery rejects malformed topic IDs');
const timed=readChatOutbox(mutate(p=>{p.videoSeconds=0;p.videoId='abcdefghijk';}),'room');
check(timed[0]?.payload.videoSeconds===0&&timed[0]?.message.videoSeconds===0,'an exact zero timestamp survives storage and reload');
check(!readChatOutbox(mutate(p=>{p.videoSeconds=-1;p.videoId='abcdefghijk';}),'room').length,'invalid playback timestamps cannot enter a retry');
check(acknowledgeChatOutbox(restored,[{...restored[0].message,own:true}]).length===0,'a saved own-message echo acknowledges an uncertain send');
check(acknowledgeChatOutbox(restored,[{...restored[0].message,own:false}]).length===1,'another viewer cannot acknowledge the current identity’s outbox');
check(acknowledgeChatOutbox(restored,[]).length===1,'a filtered or unavailable feed cannot silently discard unconfirmed sends');
const many=Array.from({length:12},()=>{const clientId=randomUUID();return {...delivery,payload:{...payload,clientId},message:{...delivery.message,id:clientId}};});
check(readChatOutbox(serializeChatOutbox(many),'room').length===10,'the durable outbox remains bounded to ten messages');
const base='http://127.0.0.1:5173',network=randomInt(20,240);let cookie='';
async function call(path,body,admin=false){const r=await fetch(base+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{'cf-connecting-ip':`127.84.${network}.1`,cookie:admin?'__sites_local_auth=1':cookie,...(body===undefined?{}:{origin:base,'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')};}
const c=await call('challenge');let nonce=0;while(!createHash('sha256').update(c.data.id+':'+nonce).digest('hex').startsWith('0000'))nonce++;cookie=(await call('verify',{id:c.data.id,nonce:String(nonce)})).cookie.split(';')[0];
const roomId=(await call('admin',{action:'room',title:'Chat recovery QA',description:'Disposable local failure recovery checks',video:''},true)).data.roomId;assert.ok(roomId);
const retryPayload={...payload,roomId,clientId:randomUUID()},sent=await call('chat',retryPayload);assert.equal(sent.status,201);
const disk=serializeChatOutbox([{...delivery,payload:retryPayload,message:{...delivery.message,id:retryPayload.clientId}}]);
const retried=await call('chat',readChatOutbox(disk,roomId)[0].payload),feed=(await call('chat?room='+roomId)).data;
check(retried.status===200&&retried.data.message.createdAt===sent.data.message.createdAt&&feed.messages.length===1,'after a lost acknowledgement, a reloaded retry returns the original D1 message without duplicating it');
check(!JSON.stringify(feed).includes('ipHash')&&!JSON.stringify(feed).includes('userId'),'recovered public messages do not expose account or network identifiers');
await call('chat/moderate',{action:'hide',id:retryPayload.clientId},true);
check((await call('chat',retryPayload)).status===409&&!(await call('chat?room='+roomId)).data.messages.length,'a durable retry cannot restore a moderator-hidden message');
console.log(`${checks} chat recovery checks passed. Room: ${roomId}`);
