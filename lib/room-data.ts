import type {Distribution,PersonalBoard,Episode} from './community-data';
export const TIERS = [
  {id:'S',label:'Hall of fame',value:100,color:'#ff7f7f'},
  {id:'A',label:'Certified banger',value:80,color:'#ffbf7f'},
  {id:'B',label:'Good television',value:60,color:'#ffdf7f'},
  {id:'C',label:'We move',value:40,color:'#ffff7f'},
  {id:'D',label:'On mute',value:20,color:'#bfff7f'},
  {id:'F',label:'Never again',value:0,color:'#7fff7f'},
];
export type Moment = {hasTimestamp?:boolean;timing?:{seconds:number|null;source:string;locked:boolean;version:number;evidence:string;updatedAt:number}|null;imageCredit?:{url:string;label:string;kind:string}|null;id:string;roomId:string;title:string;description:string;category:string;timestamp:number;image:string|null;status:string;createdAt:number;version?:number;score?:number;count?:number;tier?:string;sample?:boolean};
export type Room = {episodePhase?:string|null;episodeStartedAt?:number|null;episodeLastLiveAt?:number|null;episodeEndedAt?:number|null;momentCount?:number;id:string;title:string;description:string;videoId:string|null;status:string;createdAt:number;revision?:number};
export type Placement={itemId:string;tier:string;score:number;position:number;version:number;updatedAt:number};
export type Vote={itemId:string;tier:string;score:number};
export type RoomState={canManage?:boolean;latestEpisode?:Room|null;draftKey?:string|null;distribution:Distribution[];personalBoard:PersonalBoard|null;episode:Episode|null;publishedCount:number;momentReactions:Record<string,{total:number;net:number;likes:number}>;rooms:Room[];room:Room;moments:Moment[];shared:Placement[];revision:number;catalogRevision:number;uploads:{remaining:number;limit:number;resetAt:number};online:number;mine:Vote[];hasBoard:boolean;used:number;limit:number;stats:{votes:number;participants:number};pending:{id:string;title:string;status:string}[];verified:boolean;admin:boolean;canModerate:boolean;account:{email:string;name:string}|null;verification:string;siteKey:string|null};
export const TBPN_CHANNEL='UC-DRzaGnL_vtBUpCFH5M0tg';
export const TBPN_REPLAY='AV2LlJ-yw8k';
export const TBPN_LIVE={id:'tbpn-live',title:'TBPN · Live show',description:'The official TBPN YouTube live channel. Weekdays, 11 AM Pacific / 1 PM Central. The player is available when TBPN is broadcasting.',videoId:'channel:'+TBPN_CHANNEL,status:'open',createdAt:1792166400001};
export function youtubeLink(video:string|null){return video?.startsWith('channel:')?'https://www.youtube.com/@tbpnlive/live':video?'https://www.youtube.com/watch?v='+video:'https://www.youtube.com/@tbpnlive/live';}
export function youtubeEmbed(video:string,start=0){return video.startsWith('channel:')?'https://www.youtube.com/embed/live_stream?channel='+video.slice(8)+'&autoplay=1':'https://www.youtube.com/embed/'+video+'?autoplay=1&start='+start;}
export function initialPlacement(m:Moment,index:number):Placement{const sample=SAMPLE_MOMENTS.find(s=>s.id===m.id);const tier=sample&&!['sample-sponsor','sample-more'].includes(m.id)?sample.tier!:'U';return {itemId:m.id,tier,score:TIERS.find(t=>t.id===tier)?.value??50,position:index*1024,version:0,updatedAt:0};}
export const SAMPLE_ROOM: Room = {id:'the-warm-up',title:'The warm-up room',description:'A practice board for the moments that make the show. Create a live room to rank a real episode.',videoId:null,status:'open',createdAt:1792166400000};
export const SAMPLE_MOMENTS: Moment[] = [
  {id:'sample-open',title:'The opening monologue',description:'The scene-setter. The energy. The opening take. Where does it land?',category:'Hot take',timestamp:0,image:null,tier:'S'},
  {id:'sample-deep',title:'The guest deep dive',description:'When the conversation goes past the headlines and into the details.',category:'Guest',timestamp:0,image:null,tier:'S'},
  {id:'sample-prediction',title:'A very bold prediction',description:'An all-time call, or a take that will age spectacularly?',category:'Hot take',timestamp:0,image:null,tier:'A'},
  {id:'sample-tangent',title:'The unexpected tangent',description:'The conversation nobody saw coming. Sometimes the detour is the destination.',category:'Moment',timestamp:0,image:null,tier:'B'},
  {id:'sample-sponsor',title:'The sponsor segue',description:'The art of bringing it back to the people who make the show possible.',category:'Moment',timestamp:0,image:null,tier:'C'},
  {id:'sample-more',title:'“One more thing…”',description:'The closing thought that turns into a whole new conversation.',category:'Moment',timestamp:0,image:null,tier:'D'},
].map(m=>({...m,roomId:SAMPLE_ROOM.id,status:'approved',createdAt:SAMPLE_ROOM.createdAt,sample:true}));
export const CATEGORIES=['Moment','Hot take','Guest','Product','Meme'];
export function timecode(n:number){return n?`${Math.floor(n/3600)?Math.floor(n/3600)+':':''}${String(Math.floor(n/60)%60).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`:'—';}
export function parseTime(s:string){if(!s.trim())return 0;const p=s.split(':').map(Number);if(p.length>3||p.some(n=>!Number.isFinite(n)||n<0||!Number.isInteger(n))||p.slice(1).some(n=>n>59))throw new Error('Use a timestamp like 12:34 or 1:12:34.');const n=p.reduce((a,b)=>a*60+b,0);if(n>86400)throw new Error('Timestamp must be within 24 hours.');return n;}

export const hasMomentTime=(m:Moment)=>m.hasTimestamp??m.timestamp>0;
