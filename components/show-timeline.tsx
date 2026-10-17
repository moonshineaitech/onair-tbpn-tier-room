'use client';
import {MessageSquare,Play} from 'lucide-react';
import {hasMomentTime,type Moment,type RoomState} from '@/lib/room-data';
import {canSeekStream} from '@/lib/stream-source';
import {stamp} from '@/lib/playback-clock';
export default function ShowTimeline({state,play,discuss}:{state:RoomState;play:(moment:Moment)=>void;discuss:(moment:Moment)=>void}){
 const timed=state.moments.filter(hasMomentTime).sort((a,b)=>a.timestamp-b.timestamp);
 return <><span className="modal-eyebrow">THE SHOW, MOMENT BY MOMENT</span><h2>{canSeekStream(state.room.videoId)?'Jump to the good part.':'The running order.'}</h2><p>{state.room.title} · {timed.length} of {state.moments.length} moments timestamped. {state.episode?'Official chapters sync automatically. Caption and community matches are labeled approximate.':'The host can add or adjust timestamps. Source support determines whether playback can seek.'}</p><div className="show-timeline">{timed.map(m=><div key={m.id}><button onClick={()=>play(m)}><time>{stamp(m.timestamp)}</time>{m.image?<img src={m.image} alt=""/>:null}<span><b>{m.title}</b><small>{m.timing?.source==='chapter'?'Official chapter':m.timing?.source==='captions'||m.timing?.source==='community'?'Approximate match':'Confirmed timestamp'}</small></span><Play size={13}/></button><button aria-label={'Discuss '+m.title} onClick={()=>discuss(m)}><MessageSquare size={14}/></button></div>)}</div>{!timed.length?<p>No confirmed times yet. Add a timestamp manually, or capture player time when supported.</p>:null}<p className="fine-print">Topics without a reliable timing signal stay pending. {state.admin||state.canManage?'Click a card to adjust its start or Mark now.':'Use the ••• on a card for rankings, reactions, and discussion.'}</p></>;
}
