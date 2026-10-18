import {TIERS,type Moment,type Vote} from './room-data';
import type {Distribution} from './community-data';

const tierIds=TIERS.map(t=>t.id);
export function predictionVotes(moments:Moment[],votes:Vote[]){
 const approved=new Set(moments.map(m=>m.id)),result=new Map<string,string>();
 for(const vote of votes){if(!approved.has(vote.itemId))continue;if(tierIds.includes(vote.tier))result.set(vote.itemId,vote.tier);else if(vote.tier==='U')result.delete(vote.itemId);}
 return result;
}
export function nextPrediction(moments:Moment[],votes:Vote[],current:string|null,visited:ReadonlySet<string>,unrankedOnly=true){
 const mine=predictionVotes(moments,votes),start=moments.findIndex(m=>m.id===current);
 for(let step=1;step<=moments.length;step++){const m=moments[(start+step)%moments.length];if(!visited.has(m.id)&&(!unrankedOnly||!mine.has(m.id)))return m.id;}
 return null;
}
export type PredictionRow={moment:Moment;counts:number[];total:number;leaders:string[];leaderPercent:number;support:number;split:number;mine:string|null;gap:number|null};
export function predictionRows(moments:Moment[],distribution:Distribution[],votes:Vote[]):PredictionRow[]{
 const data=new Map(distribution.map(d=>[d.itemId,d])),mine=predictionVotes(moments,votes);
 return moments.map(moment=>{
  const d=data.get(moment.id),counts=tierIds.map(t=>Number.isSafeInteger(d?.tiers[t])&&Number(d?.tiers[t])>0?Number(d?.tiers[t]):0),total=counts.reduce((a,b)=>a+b,0),leading=Math.max(0,...counts),leaders=leading?tierIds.filter((_,i)=>counts[i]===leading):[];
  let distance=0;for(let i=0;i<counts.length;i++)for(let j=i+1;j<counts.length;j++)distance+=counts[i]*counts[j]*(j-i);
  const own=mine.get(moment.id)||null,gap=own&&leaders.length===1?Math.abs(tierIds.indexOf(own)-tierIds.indexOf(leaders[0])):null;
  return {moment,counts,total,leaders,leaderPercent:total?Math.round(leading/total*100):0,support:total?Math.round((counts[0]+counts[1])/total*100):0,split:total?Math.min(100,Math.round(4*distance/(5*total*total)*100)):0,mine:own,gap};
 });
}
export function sortPredictions(rows:PredictionRow[],sort:'support'|'split'|'mine'){
 return [...rows].sort((a,b)=>sort==='mine'?(b.gap??-1)-(a.gap??-1)||b.total-a.total||a.moment.title.localeCompare(b.moment.title):Number(b.total>0)-Number(a.total>0)||(sort==='split'?b.split-a.split:b.support-a.support)||b.total-a.total||a.moment.title.localeCompare(b.moment.title));
}
