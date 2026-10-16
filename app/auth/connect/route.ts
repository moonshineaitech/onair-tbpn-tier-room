import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {createLoginCode} from '@/lib/gateway-auth';
export const dynamic='force-dynamic';
export async function GET(req:Request){
 const url=new URL(req.url),challenge=url.searchParams.get('challenge')||'',state=url.searchParams.get('state')||'';
 if(!env.DB||!env.ONAIR_GATEWAY_ORIGIN||!/^[-\w]{43}$/.test(challenge)||!/^[-\w]{32,64}$/.test(state))return new Response('This sign-in request is unavailable or expired.',{status:400});
 const user=await getChatGPTUser();
 if(!user){const signin=new URL('/signin-with-chatgpt',url.origin);signin.searchParams.set('return_to',url.pathname+url.search);return Response.redirect(signin,302);}
 const destination=new URL('/auth/callback',env.ONAIR_GATEWAY_ORIGIN);
 if(destination.protocol!=='https:')return new Response('Sign-in is not configured.',{status:503});
 destination.searchParams.set('code',await createLoginCode(env.DB,user,challenge));destination.searchParams.set('state',state);
 return new Response(null,{status:302,headers:{Location:destination.href,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
}
