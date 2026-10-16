import {TIERS} from '@/lib/room-data';
import type {Distribution} from '@/lib/community-data';
export default function TierDistribution({data,compact=false}:{data?:Distribution;compact?:boolean}){
 if(!data?.total)return <span className="distribution-empty">No personal rankings yet.</span>;
 return <div className={'tier-distribution '+(compact?'compact':'')}><div className="distribution-bar" role="img" aria-label={TIERS.map(t=>`${t.id}: ${data.tiers[t.id]||0} viewers (${Math.round((data.tiers[t.id]||0)/data.total*100)}%)`).join(', ')}>{TIERS.map(t=><span key={t.id} style={{width:((data.tiers[t.id]||0)/data.total*100)+'%',background:t.color}} title={`${t.id}: ${data.tiers[t.id]||0} · ${Math.round((data.tiers[t.id]||0)/data.total*100)}%`}/>)}</div>{!compact?<div className="distribution-legend">{TIERS.map(t=><span key={t.id}><i style={{background:t.color}}/><b>{t.id}</b>{data.tiers[t.id]||0}<small>{Math.round((data.tiers[t.id]||0)/data.total*100)}%</small></span>)}</div>:null}<p>{data.total} ranked viewer{data.total===1?'':'s'}<span>·</span><b>{data.sPercent}% S</b><span>·</span><b>{data.fPercent}% F</b>{!compact?<><span>·</span>Mean {data.average}/100</>:null}</p></div>;
}
