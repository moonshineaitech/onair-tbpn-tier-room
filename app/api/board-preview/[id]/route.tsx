import {ImageResponse} from 'next/og';
import {env} from 'cloudflare:workers';
import {publicBoard} from '@/lib/public-board';
import {boardPreviewMedia} from '@/lib/board-preview-media';
import BoardSocialImage from '@/components/board-social-image';
export const dynamic='force-dynamic';
type Context={params:Promise<{id:string}>};
const unavailable=()=>new Response('Published board unavailable.',{status:404,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
async function preview(request:Request,context:Context,head=false){
 if(!env.DB)return new Response('Preview temporarily unavailable.',{status:503,headers:{'Cache-Control':'no-store'}});
 const {id}=await context.params,board=await publicBoard(env.DB,id);if(!board)return unavailable();
 const headers={'Content-Type':'image/png','Cache-Control':'public, max-age=0, must-revalidate','X-Content-Type-Options':'nosniff',ETag:`"${board.version}"`};
 if(request.headers.get('if-none-match')===headers.ETag)return new Response(null,{status:304,headers});
 if(head)return new Response(null,{headers});
 const key='board-previews/'+board.post.id+'.png';
 try{const cached=await env.BUCKET?.get(key);if(cached?.customMetadata?.version===board.version)return new Response(cached.body,{headers});}catch{}
 const images=await boardPreviewMedia(env.BUCKET,board);let png:ArrayBuffer;
 try{png=await new ImageResponse(<BoardSocialImage board={board} images={images}/>,{width:1200,height:630}).arrayBuffer();}catch{png=await new ImageResponse(<BoardSocialImage board={board} images={{}}/>,{width:1200,height:630}).arrayBuffer();}
 try{await env.BUCKET?.put(key,png,{httpMetadata:{contentType:'image/png'},customMetadata:{version:board.version}});}catch{}
 return new Response(png,{headers});
}
export const GET=(request:Request,context:Context)=>preview(request,context);
export const HEAD=(request:Request,context:Context)=>preview(request,context,true);
