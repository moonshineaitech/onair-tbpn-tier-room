import type {Metadata} from 'next';
import type {PublicBoard} from './public-board';
import {SITE_ORIGIN,publishedBoardUrl,boardPreviewUrl,shareRows} from './board-share';
export function boardMetadata(board:PublicBoard|null,origin=SITE_ORIGIN):Metadata{
 if(!board)return {title:'Board unavailable · ON AIR',description:'This published board is unavailable. Explore the live tier room and make your own rankings.',robots:{index:false,follow:true},openGraph:{title:'Board unavailable · ON AIR',description:'Explore the live tier room.',images:[]},twitter:{card:'summary',title:'Board unavailable · ON AIR',images:[]}};
 const {post,room,moments,version}=board,canonical=publishedBoardUrl(origin,room.id,post.id),url=publishedBoardUrl(origin,room.id,post.id,post.updatedAt),image=boardPreviewUrl(origin,post.id,version),ranked=shareRows(post,moments).reduce((n,r)=>n+r.moments.length,0);
 const title=`${post.title} · ${post.byline} | ON AIR`,description=room.id==='thiel-nashville-2026'?`${post.byline} ranked ${ranked}/${moments.length} speculative picks for Peter Thiel’s Nashville lectures. Predictions about his remarks, not claims about the people listed.`:`${post.byline} ranked ${ranked}/${moments.length} segments from ${room.title}. See their tiers and make your own board for this show.`,alt=`${post.byline}'s S, A, B, C, D and F tier rankings for ${room.title}. ${ranked} of ${moments.length} segments ranked.`;
 return {title,description,alternates:{canonical},openGraph:{type:'website',siteName:'ON AIR · The Live Tier Room',title,description,url,images:[{url:image,width:1200,height:630,type:'image/png',alt}]},twitter:{card:'summary_large_image',title,description,images:[{url:image,alt}]}};
}
