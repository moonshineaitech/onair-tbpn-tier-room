import assert from 'node:assert/strict';
import {createHash,createHmac,randomBytes} from 'node:crypto';
const base='http://127.0.0.1:5173',secret='local-gateway-test-secret';let checks=0;
const check=(v,label)=>{assert.ok(v,label);checks++;console.log('PASS '+label);};
const verifier=randomBytes(32).toString('base64url'),challenge=createHash('sha256').update(verifier).digest('base64url'),state=randomBytes(24).toString('base64url');
const path='/auth/connect?challenge='+challenge+'&state='+state;
let r=await fetch(base+path,{redirect:'manual'});check(r.status===302&&r.headers.get('location').includes('/signin-with-chatgpt'),'gateway sign-in uses the existing managed ChatGPT sign-in');
r=await fetch(base+path,{redirect:'manual',headers:{cookie:'__sites_local_auth=1'}});const callback=new URL(r.headers.get('location'));check(callback.origin==='https://gateway.example'&&callback.pathname==='/auth/callback'&&callback.searchParams.get('state')===state,'verified account returns only to the configured gateway callback');
const code=callback.searchParams.get('code');assert.ok(code);
function headers(t=Date.now(),signature=true){const ip='127.22.0.1',time=String(t);return {origin:base,'Content-Type':'application/json','x-onair-client-ip':ip,'x-onair-time':time,'x-onair-signature':signature?createHmac('sha256',secret).update(`${time}\nPOST\n/api/gateway/exchange\n${ip}`).digest('hex'):'0'.repeat(64)};}
async function exchange(v=verifier,h=headers()){const r=await fetch(base+'/api/gateway/exchange',{method:'POST',headers:h,body:JSON.stringify({code,verifier:v,email:'attacker@example.com'})});return {r,data:await r.json()};}
check((await exchange(verifier,headers(Date.now(),false))).r.status===403,'unsigned gateway requests cannot exchange sign-in codes');
check((await exchange('wrong-verifier')).r.status===403,'PKCE verifier must match the original challenge');
check((await exchange(verifier,headers(Date.now()-120000))).r.status===403,'expired gateway signatures are rejected');
const valid=await exchange();check(valid.r.status===200&&valid.r.headers.get('set-cookie').includes('HttpOnly')&&valid.r.headers.get('set-cookie').includes('Secure'),'valid exchange issues a protected session cookie');
const cookie=valid.r.headers.get('set-cookie').split(';')[0],account=await(await fetch(base+'/api/state',{headers:{cookie}})).json();
check(account.admin&&account.account.email==='seedy@sites.test','gateway session retains the verified admin identity and ignores claimed emails');
check((await exchange()).r.status===403,'sign-in codes can only be exchanged once');
r=await fetch(base+'/api/logout',{method:'POST',headers:{origin:base,'Content-Type':'application/json',cookie},body:'{}'});check(r.status===200&&!(await(await fetch(base+'/api/state',{headers:{cookie}})).json()).verified,'logout revokes the server-side gateway session');
console.log(`${checks} gateway authentication checks passed.`);
