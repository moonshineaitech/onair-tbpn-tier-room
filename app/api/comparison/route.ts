import {env} from 'cloudflare:workers';
import {publicComparison} from '@/lib/public-comparison';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 if(!env.DB)return Response.json({error:'Comparison temporarily unavailable.'},{status:503,headers:{'Cache-Control':'no-store'}});
 const q=new URL(request.url).searchParams,data=await publicComparison(env.DB,q.get('room')||'',q.get('left')||'',q.get('right')||'');
 return Response.json(data||{error:'One of these boards is unavailable. Choose two published boards from the same show.'},{status:data?200:404,headers:{'Cache-Control':'no-store'}});
}
