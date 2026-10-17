import {TBPN_CHANNEL,type Room} from './room-data';
export type StreamSource={provider:'youtube'|'twitch'|'vimeo'|'file'|'link'|'none';id:string;channel:boolean;url:string;label:string};
const videoId=/^[\w-]{11}$/;
const channelId=/^UC[\w-]{22}$/;
export function parseStreamSource(value:string):string|null{
 const s=value.trim();if(!s)return null;if(s.length>1500)throw new Error('Use a stream link under 1,500 characters.');
 if(videoId.test(s))return s;if(s==='tbpn-live')return 'channel:'+TBPN_CHANNEL;if(s.startsWith('channel:')&&channelId.test(s.slice(8)))return s;
 let u:URL;try{u=new URL(s);}catch{throw new Error('Paste a complete HTTPS stream or video link.');}
 if(u.protocol!=='https:'||u.username||u.password||u.port||u.hostname==='localhost'||!u.hostname.includes('.')||/^(?:127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(u.hostname)||/^172\.(?:1[6-9]|2\d|3[01])\./.test(u.hostname)||/^100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(u.hostname)||['.local','.internal','.localhost','.lan'].some(t=>u.hostname.endsWith(t)))throw new Error('Use a public HTTPS stream link.');
 const host=u.hostname.toLowerCase().replace(/^www\./,''),path=u.pathname.replace(/\/$/,'');
 if(['youtube.com','m.youtube.com','youtu.be','youtube-nocookie.com'].includes(host)){
  const id=host==='youtu.be'?path.split('/')[1]:u.searchParams.get('v')||path.match(/^\/(?:live|embed|shorts)\/([\w-]{11})$/)?.[1];if(id&&videoId.test(id))return id;
  const channel=path.match(/^\/channel\/(UC[\w-]{22})(?:\/live)?$/)?.[1];if(channel)return 'channel:'+channel;
  const handle=path.match(/^\/@([\w.-]{3,50})(?:\/live)?$/)?.[1];if(handle)return handle.toLowerCase()==='tbpnlive'?'channel:'+TBPN_CHANNEL:'youtube-handle:'+handle;
  throw new Error('Use a YouTube watch, live, channel, or @handle link.');
 }
 if(['twitch.tv','m.twitch.tv'].includes(host)){
  const vod=path.match(/^\/videos\/(\d{1,20})$/)?.[1];if(vod)return 'twitch-video:'+vod;
  const channel=path.match(/^\/([a-zA-Z0-9_]{3,25})$/)?.[1];if(channel&&!['directory','downloads','settings','login','signup'].includes(channel.toLowerCase()))return 'twitch:'+channel.toLowerCase();
  throw new Error('Use a Twitch channel or full broadcast link.');
 }
 if(['vimeo.com','player.vimeo.com'].includes(host)){const id=path.match(/^\/(?:video\/)?(\d{1,20})$/)?.[1];if(id)return 'vimeo:'+id;}
 if(/\.(?:mp4|webm)$/i.test(u.pathname)){u.hash='';return 'file:'+u.toString();}return 'link:'+u.toString();
}
export function streamSource(value:string|null|undefined):StreamSource{
 const s=value||'';if(videoId.test(s))return {provider:'youtube',id:s,channel:false,url:'https://www.youtube.com/watch?v='+s,label:'YouTube'};
 if(s.startsWith('channel:')&&channelId.test(s.slice(8)))return {provider:'youtube',id:s.slice(8),channel:true,url:'https://www.youtube.com/channel/'+s.slice(8)+'/live',label:'YouTube'};
 if(/^twitch:[a-z0-9_]{3,25}$/.test(s))return {provider:'twitch',id:s.slice(7),channel:true,url:'https://www.twitch.tv/'+s.slice(7),label:'Twitch'};
 if(/^twitch-video:\d{1,20}$/.test(s))return {provider:'twitch',id:s.slice(13),channel:false,url:'https://www.twitch.tv/videos/'+s.slice(13),label:'Twitch'};
 if(/^vimeo:\d{1,20}$/.test(s))return {provider:'vimeo',id:s.slice(6),channel:false,url:'https://vimeo.com/'+s.slice(6),label:'Vimeo'};
 if(/^youtube-handle:[\w.-]{3,50}$/.test(s))return {provider:'link',id:s,channel:true,url:'https://www.youtube.com/@'+s.slice(15)+'/live',label:'YouTube'};
 if(/^(?:file|link):https:\/\//.test(s)){try{const u=new URL(s.slice(5));if(u.protocol==='https:'&&!u.username&&!u.password)return {provider:s.startsWith('file:')?'file':'link',id:s,channel:false,url:u.toString(),label:s.startsWith('file:')?'Video':u.hostname.replace(/^www\./,'')};}catch{}}
 return {provider:'none',id:'',channel:false,url:'',label:'No stream'};
}
export function streamWatchUrl(value:string|null|undefined,start=0){const s=streamSource(value),seconds=Math.max(0,Math.floor(start));if(!seconds||s.channel||s.provider==='link')return s.url;if(s.provider==='youtube')return s.url+'&t='+seconds+'s';if(s.provider==='twitch')return s.url+'?t='+Math.floor(seconds/3600)+'h'+Math.floor(seconds/60)%60+'m'+seconds%60+'s';return s.url+'#t='+seconds+'s';}
export function streamEmbedUrl(value:string|null|undefined,parent:string,start=0){const s=streamSource(value),seconds=Math.max(0,Math.floor(start));if(s.provider==='youtube')return s.channel?'https://www.youtube.com/embed/live_stream?channel='+s.id+'&autoplay=1&mute=1':'https://www.youtube.com/embed/'+s.id+'?autoplay=1&mute=1&start='+seconds;if(s.provider==='twitch')return 'https://player.twitch.tv/?'+new URLSearchParams({[s.channel?'channel':'video']:s.channel?s.id:'v'+s.id,parent,autoplay:'true',muted:'true',...(!s.channel&&seconds?{time:Math.floor(seconds/3600)+'h'+Math.floor(seconds/60)%60+'m'+seconds%60+'s'}:{})});if(s.provider==='vimeo')return 'https://player.vimeo.com/video/'+s.id+'?autoplay=1&muted=1#t='+seconds+'s';return null;}
export const followsTbpn=(room:Pick<Room,'videoId'>)=>room.videoId==='channel:'+TBPN_CHANNEL;
export const isTbpnRoom=(room:Room)=>followsTbpn(room)||room.id==='tbpn-live'||room.id==='show-'+room.videoId&&!!room.episodePhase;
export function canSeekStream(value:string|null|undefined){const s=streamSource(value);return s.provider==='file'||s.provider==='vimeo'||(s.provider==='youtube'||s.provider==='twitch')&&!s.channel;}
