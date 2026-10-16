import {env} from 'cloudflare:workers';
import type {ChatGPTUser} from '@/app/chatgpt-auth';
const encoder=new TextEncoder();
export const tokenHash=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value)))).map(n=>n.toString(16).padStart(2,'0')).join('');
export async function trustedGateway(req:Request){
 if(!env.ONAIR_GATEWAY_SECRET)return false;
 const time=req.headers.get('x-onair-time')||'',signature=req.headers.get('x-onair-signature')||'',ip=req.headers.get('x-onair-client-ip')||'';
 if(!/^\d{13}$/.test(time)||Math.abs(Date.now()-Number(time))>60000||!/^[-\da-f:.]{2,64}$/i.test(ip)||!/^[a-f\d]{64}$/.test(signature))return false;
 const url=new URL(req.url),payload=`${time}\n${req.method}\n${url.pathname+url.search}\n${ip}`;
 const key=await crypto.subtle.importKey('raw',encoder.encode(env.ONAIR_GATEWAY_SECRET),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 return crypto.subtle.verify('HMAC',key,Uint8Array.from(signature.match(/../g)!,n=>parseInt(n,16)),encoder.encode(payload));
}
export async function createLoginCode(database:D1Database,account:ChatGPTUser,challenge:string){
 const code=crypto.randomUUID()+crypto.randomUUID();
 await database.batch([database.prepare('INSERT INTO auth_codes (id,challenge,account,expires,used) VALUES (?,?,?,?,0)').bind(await tokenHash(code),challenge,JSON.stringify(account),Date.now()+90000),database.prepare('DELETE FROM auth_codes WHERE expires<?').bind(Date.now())]);
 return code;
}
export async function exchangeLoginCode(database:D1Database,code:string,verifier:string,ipHash:string){
 const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(verifier)));
 const challenge=btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
 const used=await database.prepare('UPDATE auth_codes SET used=1 WHERE id=? AND challenge=? AND expires>? AND used=0 RETURNING account').bind(await tokenHash(code),challenge,Date.now()).first<{account:string}>();
 if(!used)return null;
 const token=crypto.randomUUID();await database.prepare('INSERT INTO sessions (id,ipHash,expires,account) VALUES (?,?,?,?)').bind(await tokenHash(token),ipHash,Date.now()+7*86400000,used.account).run();
 return token;
}
