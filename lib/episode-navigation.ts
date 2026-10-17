import type {Room} from './room-data';
export const isVerifiedLive=(room:Room,time=Date.now())=>Number(room.streamCheckedAt||0)>Number(room.episodeLastLiveAt||0)?room.streamLiveStatus==='live'&&Number(room.streamStatusCheckedAt||0)>=time-180000:room.episodePhase==='live'&&Number.isFinite(room.episodeLastLiveAt)&&Number(room.episodeLastLiveAt)>=time-180000;
export function episodeLabel(room:Room,time=Date.now()){
 if(room.id==='the-warm-up')return 'Practice · sample moments';
 if(isVerifiedLive(room,time))return room.status==='closed'?'Live show · ranking closed':'Live show · rank now';
 if(Number(room.streamCheckedAt||0)>Number(room.episodeLastLiveAt||0)){
  if(room.streamLiveStatus==='replay')return room.status==='closed'?'Replay · shared board closed':'Replay · open for ranking';
  if(room.streamLiveStatus==='upcoming')return 'Upcoming stream · build your board';
  if(room.streamLiveStatus==='offline')return room.status==='closed'?'Stream offline · ranking closed':'Stream offline · board open';
 }
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
