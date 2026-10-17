import type {Room} from './room-data';
export const isVerifiedLive=(room:Room,time=Date.now())=>room.episodePhase==='live'&&Number.isFinite(room.episodeLastLiveAt)&&Number(room.episodeLastLiveAt)>=time-300000;
export function episodeLabel(room:Room,time=Date.now()){
 if(room.id==='the-warm-up')return 'Practice · sample moments';
 if(room.episodePhase==='live'&&!isVerifiedLive(room,time))return 'Live status pending';
 if(room.episodePhase==='live')return room.status==='closed'?'Live show · ranking closed':'Live show · rank now';
 if(room.episodePhase==='ended')return room.status==='closed'?'Replay · shared board closed':'Replay · open for ranking';
 if(room.id==='tbpn-live')return 'Official channel';
 return room.status==='closed'?'Board · closed':'Board · open for ranking';
}
export function initialRoomTarget(params:URLSearchParams){
 const room=params.get('room')||'';
 return room==='tbpn-live'&&!params.has('moment')&&!params.has('board')&&!['mine','compare'].includes(params.get('view')||'')?'':room;
}
export function visibleRoomTabs(rooms:Room[],selected:Room){
 const result=rooms.slice(0,8);if(!result.some(r=>r.id===selected.id))result.push(selected);return result;
}
