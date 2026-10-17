import {Buffer} from 'node:buffer';
import {validateImage} from './upload';
import {shareRows} from './board-share';
import type {PublicBoard} from './public-board';
export async function boardPreviewMedia(bucket:R2Bucket|undefined,board:PublicBoard){
 const images:Record<string,string>={};if(!bucket)return images;
 const all=shareRows(board.post,board.moments),total=all.reduce((n,r)=>n+r.moments.length,0),moments=all.flatMap(r=>total<=24?r.moments:r.moments.slice(0,4));
 await Promise.all(moments.map(async m=>{
  const key=m.image?.match(/^\/api\/image\/([a-f0-9-]{36})$/)?.[1];if(!key)return;
  try{const image=await bucket.get(key);if(!image||image.size>80000||!['image/png','image/jpeg'].includes(image.httpMetadata?.contentType||''))return;
   const buffer=await image.arrayBuffer(),type=image.httpMetadata!.contentType!,{width,height}=validateImage(new Uint8Array(buffer),type);if(width>512||height>512)return;
   images[m.id]=`data:${type};base64,${Buffer.from(buffer).toString('base64')}`;
  }catch{}
 }));return images;
}
