import {TIERS,type Vote} from './room-data';

export type PendingVote=Vote&{changeId:string};
export const draftStorageKey=(owner:string,room:string)=>'onair:draft:v1:'+owner+':'+room;
export function mergePersonalVotes(saved:Vote[],changes:PendingVote[]):Vote[]{
 const result=new Map(saved.map(v=>[v.itemId,v]));
 for(const {itemId,tier,score} of changes){if(tier==='U')result.delete(itemId);else result.set(itemId,{itemId,tier,score});}
 return [...result.values()];
}
export function readPersonalDraft(raw:string|null,time=Date.now()):PendingVote[]{
 try{
  const data=JSON.parse(raw||'null');if(data?.version!==1||!Number.isFinite(data.updatedAt)||time-data.updatedAt>7*86400000||data.updatedAt>time+60000||!Array.isArray(data.changes)||data.changes.length>300)return [];
  const changes=new Map<string,PendingVote>();
  for(const v of data.changes){if(typeof v?.itemId!=='string'||v.itemId.length>100||!v.itemId||typeof v.changeId!=='string'||v.changeId.length>100||![...TIERS.map(t=>t.id),'U'].includes(v.tier)||!Number.isInteger(v.score)||v.score<0||v.score>100)return [];changes.set(v.itemId,{itemId:v.itemId,tier:v.tier,score:v.score,changeId:v.changeId});}
  return [...changes.values()];
 }catch{return [];}
}
export const acknowledgeDraft=(pending:PendingVote[],sent:PendingVote[])=>pending.filter(v=>!sent.some(s=>s.itemId===v.itemId&&s.changeId===v.changeId));
