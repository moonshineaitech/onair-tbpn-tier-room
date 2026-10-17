import {TIERS,roomQuery,type Moment,type Vote} from './room-data';
import type {Distribution} from './community-data';

export type Consensus={tiers:string[];total:number;leading:number};
export type ComparisonRow={moment:Moment;left:string|null;right:string|null;consensus:Consensus;gap:number|null;boardGap:number|null};
const tierIndex=new Map(TIERS.map((t,i)=>[t.id,i]));
export function tierGap(a:string|null,b:string|null){return a!==null&&b!==null&&tierIndex.has(a)&&tierIndex.has(b)?Math.abs(tierIndex.get(a)!-tierIndex.get(b)!):null;}
export function consensusTier(d?:Distribution):Consensus{
 const leading=Math.max(0,...TIERS.map(t=>d?.tiers[t.id]||0));
 return {tiers:leading?TIERS.filter(t=>d?.tiers[t.id]===leading).map(t=>t.id):[],total:d?.total||0,leading};
}
export function comparisonRows(moments:Moment[],left:Vote[],right:Vote[],distribution:Distribution[]):ComparisonRow[]{
 const a=new Map(left.filter(v=>tierIndex.has(v.tier)).map(v=>[v.itemId,v.tier])),b=new Map(right.filter(v=>tierIndex.has(v.tier)).map(v=>[v.itemId,v.tier])),counts=new Map(distribution.map(d=>[d.itemId,d]));
 return moments.map(moment=>{const l=a.get(moment.id)||null,r=b.get(moment.id)||null,consensus=consensusTier(counts.get(moment.id)),c=consensus.tiers.length===1?consensus.tiers[0]:null,boardGap=tierGap(l,r),gaps=[boardGap,tierGap(l,c),tierGap(r,c)].filter((n):n is number=>n!==null);return {moment,left:l,right:r,consensus,boardGap,gap:gaps.length?Math.max(...gaps):null};});
}
export function comparisonSummary(rows:ComparisonRow[]){const paired=rows.filter(r=>r.boardGap!==null),agreed=paired.filter(r=>r.boardGap===0).length;return {paired:paired.length,agreed,agreement:paired.length?Math.round(agreed/paired.length*100):null,biggest:rows.filter(r=>(r.gap??0)>0).sort((a,b)=>(b.gap??0)-(a.gap??0)||a.moment.title.localeCompare(b.moment.title))};}
export function comparisonUrl(origin:string,roomId:string,left:string,right:string,version?:string){return `${origin}${roomQuery(roomId)}view=compare&board=${encodeURIComponent(right)}&against=${encodeURIComponent(left)}${version?'&v='+encodeURIComponent(version):''}`;}
export function comparisonApi(roomId:string,left:string,right:string,preview=false){return `/api/${preview?'comparison-preview':'comparison'}?room=${encodeURIComponent(roomId)}&left=${encodeURIComponent(left)}&right=${encodeURIComponent(right)}`;}
