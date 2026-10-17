import {publicBoard} from './public-board';
import {summarizeDistribution,type BoardPost,type Distribution} from './community-data';
import {comparisonApi,comparisonRows,comparisonSummary,comparisonUrl} from './board-comparison';
import {SITE_ORIGIN} from './board-share';
import type {Moment} from './room-data';
import type {Metadata} from 'next';

export type PublicComparison={left:BoardPost;right:BoardPost;room:{id:string;title:string};moments:Moment[];distribution:Distribution[];version:string};
export async function publicComparison(database:D1Database,roomId:string,leftId:string,rightId:string):Promise<PublicComparison|null>{
 if(!roomId||roomId.length>100||leftId===rightId)return null;
 const [left,right]=await Promise.all([publicBoard(database,leftId,roomId),publicBoard(database,rightId,roomId)]);if(!left||!right)return null;
 const rows=await database.prepare("SELECT v.itemId,v.tier,COUNT(*) count,AVG(v.score) average FROM votes v JOIN moments m ON m.id=v.itemId WHERE m.roomId=? AND m.status='approved' GROUP BY v.itemId,v.tier ORDER BY v.itemId,v.tier").bind(roomId).all<{itemId:string;tier:string;count:number;average:number}>();
 const distribution=summarizeDistribution(rows.results),fingerprint=JSON.stringify(['comparison-v1',left.version,right.version,distribution]);
 const version=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(fingerprint)))).map(n=>n.toString(16).padStart(2,'0')).join('').slice(0,24);
 return {left:left.post,right:right.post,room:left.room,moments:left.moments,distribution,version};
}
export function comparisonMetadata(data:PublicComparison|null):Metadata{
 if(!data)return {title:'Comparison unavailable · ON AIR',robots:{index:false,follow:false},openGraph:{images:[]},twitter:{images:[]}};
 const summary=comparisonSummary(comparisonRows(data.moments,data.left.entries,data.right.entries,data.distribution)),title=`${data.left.byline} vs ${data.right.byline} · TBPN tiers`,description=`${summary.paired} segments ranked by both · ${summary.agreement===null?'No overlap yet':summary.agreement+'% same-tier agreement'}. Compare both published boards with the live community consensus for ${data.room.title}.`,url=comparisonUrl(SITE_ORIGIN,data.room.id,data.left.id,data.right.id),image=SITE_ORIGIN+comparisonApi(data.room.id,data.left.id,data.right.id,true)+'&v='+data.version;
 return {title,description,alternates:{canonical:url},openGraph:{title,description,url:comparisonUrl(SITE_ORIGIN,data.room.id,data.left.id,data.right.id,data.version),images:[{url:image,width:1200,height:630,alt:'Side-by-side published tiers and the community’s most picked tiers'}]},twitter:{card:'summary_large_image',title,description,images:[image]}};
}
