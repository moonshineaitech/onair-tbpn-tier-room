import {ImageResponse} from 'next/og';
import {env} from 'cloudflare:workers';
import {publicComparison} from '@/lib/public-comparison';
import ComparisonSocialImage from '@/components/comparison-social-image';
export const dynamic='force-dynamic';
async function preview(request:Request,head=false){
 if(!env.DB)return new Response('Preview temporarily unavailable.',{status:503,headers:{'Cache-Control':'no-store'}});
 const q=new URL(request.url).searchParams,data=await publicComparison(env.DB,q.get('room')||'',q.get('left')||'',q.get('right')||'');
 if(!data)return new Response('Comparison unavailable.',{status:404,headers:{'Cache-Control':'no-store'}});
 const headers={'Content-Type':'image/png','Cache-Control':'public, max-age=0, must-revalidate',ETag:`"${data.version}"`,'X-Content-Type-Options':'nosniff'};
 if(request.headers.get('if-none-match')===headers.ETag)return new Response(null,{status:304,headers});if(head)return new Response(null,{headers});
 // Pair counts grow quadratically; do not retain an unbounded image for every pair.
 return new ImageResponse(<ComparisonSocialImage data={data}/>,{width:1200,height:630,headers});
}
export const GET=(request:Request)=>preview(request);
export const HEAD=(request:Request)=>preview(request,true);
