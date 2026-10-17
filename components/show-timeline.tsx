'use client';
import {MessageSquare,Play} from 'lucide-react';
import {hasMomentTime,type Moment,type RoomState} from '@/lib/room-data';
import {stamp} from '@/lib/playback-clock';
export default function ShowTimeline({state,play,discuss}:{state:RoomState;play:(moment:Moment)=>void;discuss:(moment:Moment)=>void}){
 const timed=state.moments.filter(hasMomentTime).sort((a,b)=>a.timestamp-b.timestamp);
 return <><span className="modal-eyebrow">THE SHOW, MOMENT BY MOMENT</span><h2>Jump to the good part.</h2><p>{state.room.title} · {timed.length} of {state.moments.length} moments timestamped. Official chapters sync automatically. Caption and community matches are labeled approximate.</p><div className="show-timeline">{timed.map(m=><div key={m.id}><button onClick={()=>play(m)}><time>{stamp(m.timestamp)}</time>{m.image?<img src={m.image} alt=""/>:null}<span><b>{m.title}</b><small>{m.timing?.source==='chapter'?'Official chapter':m.timing?.source==='captions'||m.timing?.source==='community'?'Approximate match':'Confirmed timestamp'}</small></span><Play size={13}/></button><button aria-label={'Discuss '+m.title} onClick={()=>discuss(m)}><MessageSquare size={14}/></button></div>)}</div>{!timed.length?<p>No confirmed times yet. New moments capture the player position; published chapters fill in automatically.</p>:null}<p className="fine-print">Topics without a reliable timing signal stay pending. {state.admin?'Click a card to adjust its start or Mark now.':'Use the ••• on a card for rankings, reactions, and discussion.'}</p></>;
}
