import {createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {Readable} from 'node:stream';
import {enqueueCollector} from '../lib/collector.mjs';
const backend=()=>new URL(process.env.ONAIR_BACKEND_ORIGIN||'https://onair-tbpn-rankings.goldrockai.chatgpt.site');
const safeReturn=value=>{try{if(!value?.startsWith('/')||value.startsWith('//'))return '/tier-list';const u=new URL(value,'https://local.invalid');return u.origin==='https://local.invalid'&&!u.pathname.startsWith('/auth')?u.pathname+u.search:'/tier-list';}catch{return '/tier-list';}};
const hash=value=>createHash('sha256').update(value).digest('base64url');
function headersFor(req,url,method=req.method){
 const headers=new Headers();
 for(const [name,value]of Object.entries(req.headers)){if(value&&!/^(?:host|cookie|content-length|connection|transfer-encoding|accept-encoding|origin|authorization|oai-|cf-|x-forwarded-|x-vercel-|x-real-ip|x-onair-)/i.test(name))headers.set(name,Array.isArray(value)?value.join(','):value);}
 const cookie=req.headers.cookie?.match(/(?:^|;\s*)onair_session=([a-f0-9-]{36})/)?.[1];if(cookie)headers.set('cookie','onair_session='+cookie);
 const time=String(Date.now()),ip=String(req.headers['x-vercel-forwarded-for']||req.headers['x-forwarded-for']||req.socket?.remoteAddress||'127.0.0.1').split(',')[0].trim();
 headers.set('x-onair-time',time);headers.set('x-onair-client-ip',ip);
 headers.set('x-onair-signature',createHmac('sha256',process.env.ONAIR_GATEWAY_SECRET||'').update(`${time}\n${method}\n${url.pathname+url.search}\n${ip}`).digest('hex'));
 if(!['GET','HEAD'].includes(method))headers.set('origin',url.origin);
 return headers;
}
function redirect(res,url,cookie){res.statusCode=302;res.setHeader('Cache-Control','no-store');res.setHeader('Location',url);if(cookie)res.setHeader('Set-Cookie',cookie);res.end();}
function error(res,status,message){res.statusCode=status;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify({error:message}));}
async function bodyFor(req){if(['GET','HEAD'].includes(req.method))return undefined;if(req.body!==undefined){const value=Buffer.isBuffer(req.body)?req.body:Buffer.from(typeof req.body==='string'?req.body:JSON.stringify(req.body));if(value.length>3000000)throw new Error('large');return value;}const chunks=[];let length=0;for await(const chunk of req){length+=chunk.length;if(length>3000000)throw new Error('large');chunks.push(chunk);}return Buffer.concat(chunks);}
export default async function handler(req,res){
 const incoming=new URL(req.url,'https://'+req.headers.host),path=incoming.searchParams.get('__onair_path')||incoming.pathname;incoming.searchParams.delete('__onair_path');
 const origin='https://'+req.headers.host;
 if(!process.env.ONAIR_GATEWAY_SECRET)return error(res,503,'App connection is being configured.');
 if(!['GET','HEAD'].includes(req.method)&&req.headers.origin!==origin)return error(res,403,'Please submit from this website.');
 try{
   if(path==='/api/collector-start'){
     const expected='Bearer '+process.env.ONAIR_GATEWAY_SECRET,provided=String(req.headers.authorization||'');
     if(req.method!=='GET'||provided.length!==expected.length||!timingSafeEqual(Buffer.from(provided),Buffer.from(expected)))return error(res,403,'Operator access required.');
     const result=await enqueueCollector(Date.now(),true);res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify({ok:true,...result}));return;
   }
   if(path==='/signin-with-chatgpt'){
     const publicOrigin=process.env.ONAIR_PUBLIC_ORIGIN;
     if(publicOrigin&&publicOrigin!==origin)return redirect(res,publicOrigin+'/signin-with-chatgpt?return_to='+encodeURIComponent(safeReturn(incoming.searchParams.get('return_to'))));
     const verifier=randomBytes(32).toString('base64url'),state=randomBytes(24).toString('base64url'),returnTo=safeReturn(incoming.searchParams.get('return_to'));
     const cookie=Buffer.from(JSON.stringify({verifier,state,returnTo,expires:Date.now()+600000})).toString('base64url');
     const next=new URL('/auth/connect',backend());next.searchParams.set('challenge',hash(verifier));next.searchParams.set('state',state);
     return redirect(res,next.href,`onair_login=${cookie}; Path=/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
   }
   if(path==='/auth/callback'){
     const token=req.headers.cookie?.match(/(?:^|;\s*)onair_login=([-\w]+)/)?.[1],code=incoming.searchParams.get('code'),state=incoming.searchParams.get('state');
     let login;try{login=JSON.parse(Buffer.from(token||'','base64url').toString());}catch{}
     if(!login||login.expires<Date.now()||typeof state!=='string'||state.length!==login.state.length||!timingSafeEqual(Buffer.from(state),Buffer.from(login.state))||!code)return error(res,403,'Sign-in expired. Start sign-in again.');
     const url=new URL('/api/gateway/exchange',backend()),headers=headersFor(req,url,'POST');headers.set('Content-Type','application/json');
     const response=await fetch(url,{method:'POST',headers,body:JSON.stringify({code,verifier:login.verifier}),redirect:'manual'});
     if(!response.ok)return error(res,403,'Sign-in expired. Start sign-in again.');
     const session=response.headers.getSetCookie().filter(v=>v.startsWith('onair_session='));
     return redirect(res,login.returnTo,[...session,'onair_login=; Path=/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=0']);
   }
   if(path==='/signout-with-chatgpt'){
     const url=new URL('/api/logout',backend()),headers=headersFor(req,url,'POST');headers.set('Content-Type','application/json');await fetch(url,{method:'POST',headers,body:'{}'}).catch(()=>{});
     return redirect(res,safeReturn(incoming.searchParams.get('return_to')),'onair_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
   }
   const target=backend();target.pathname=path.startsWith('/')?path:'/'+path;target.search=incoming.search;
   const controller=new AbortController();res.on('close',()=>controller.abort());
   const response=await fetch(target,{method:req.method,headers:headersFor(req,target),body:await bodyFor(req),redirect:'manual',signal:controller.signal});
   res.statusCode=response.status;
   for(const [name,value]of response.headers){if(!/^(?:content-encoding|content-length|transfer-encoding|connection|set-cookie)$/i.test(name))res.setHeader(name,value);}
   const cookies=response.headers.getSetCookie().filter(v=>v.startsWith('onair_session='));if(cookies.length)res.setHeader('Set-Cookie',cookies);
   const location=response.headers.get('location');if(location?.startsWith(backend().origin)&&!location.includes('/signin-with-chatgpt'))res.setHeader('Location',location.replace(backend().origin,origin));
   if(response.body){res.flushHeaders?.();await new Promise(resolve=>{const stream=Readable.fromWeb(response.body);stream.on('error',()=>{if(!res.writableEnded)res.end();resolve();});res.on('finish',resolve);res.on('close',resolve);stream.pipe(res);});}else res.end();
 }catch(e){if(!res.headersSent)error(res,e.message==='large'?413:502,e.message==='large'?'Request too large.':'The app connection could not be reached. Please retry.');else if(!res.writableEnded)res.end();console.error('ON AIR gateway request failed',e.name);}
}
