'use client';
import {useEffect,useRef,useState} from 'react';
import {ChevronDown,ChevronUp,ExternalLink,Maximize2,Minimize2,Play,Radio,X} from 'lucide-react';
import {streamSource,streamEmbedUrl,streamWatchUrl,followsTbpn} from '@/lib/stream-source';
import type {Room} from '@/lib/room-data';
import type {PlaybackClock} from '@/lib/playback-clock';
import YoutubePlayer,{type PlaybackRequest} from './floating-youtube';
export type {PlaybackRequest} from './floating-youtube';
type Props={room:Room;open:boolean;reveal:number;onOpen:()=>void;onClose:()=>void;request:PlaybackRequest|null;onClock?:(clock:PlaybackClock|null)=>void};
export default function FloatingPlayer(props:Props){
 const source=streamSource(props.room.videoId);if(source.provider==='none')return null;
 return source.provider==='youtube'&&(!source.channel||followsTbpn(props.room))?<YoutubePlayer key={props.room.id+props.room.videoId} {...props}/>:<LinkedPlayer key={props.room.id+props.room.videoId} {...props}/>;
}
function LinkedPlayer({room,open,reveal,onOpen,onClose,request,onClock}:Props){
 const source=streamSource(room.videoId),[mode,setMode]=useState('mini'),[small,setSmall]=useState(false),[failed,setFailed]=useState(false),[retry,setRetry]=useState(0),media=useRef<HTMLVideoElement>(null),callback=useRef(onClock);callback.current=onClock;
 const start=request?.videoId===room.videoId?request.start:0,url=streamWatchUrl(room.videoId,start),embed=streamEmbedUrl(room.videoId,typeof location==='undefined'?'':location.hostname,start);
 useEffect(()=>{const q=matchMedia('(max-width:440px)'),change=()=>setSmall(q.matches);change();q.addEventListener('change',change);return()=>q.removeEventListener('change',change);},[]);
 useEffect(()=>{if(reveal||request)setMode('mini');},[reveal,request]);
 useEffect(()=>{setFailed(false);if(media.current&&Number.isFinite(start))media.current.currentTime=start;},[request?.id,start]);
 useEffect(()=>{return()=>callback.current?.(null);},[]);
 useEffect(()=>{if(!open)callback.current?.(null);},[open]);
 useEffect(()=>{if(!open||source.provider!=='file')return;const timer=setInterval(()=>{const v=media.current;if(v&&room.videoId)callback.current?.({videoId:room.videoId,seconds:v.currentTime,duration:Number.isFinite(v.duration)?v.duration:0,playing:!v.paused,live:!Number.isFinite(v.duration),sampledAt:Date.now()});},1000);return()=>clearInterval(timer);},[open,room.videoId,source.provider]);
 function clock(){const v=media.current;if(v&&room.videoId)callback.current?.({videoId:room.videoId,seconds:v.currentTime,duration:Number.isFinite(v.duration)?v.duration:0,playing:!v.paused,live:!Number.isFinite(v.duration),sampledAt:Date.now()});}
 if(!open)return <button className="floating-reopen" onClick={onOpen}><Play size={14}/><span>Watch stream</span><ChevronUp size={14}/></button>;
 const linked=source.provider==='link'||source.provider==='twitch'&&small;
 return <aside id="stream-panel" className={`floating-player player-${mode} player-${source.provider}`} aria-label="Floating video player"><header className="floating-player-header"><button className="floating-player-brand" onClick={()=>setMode(mode==='collapsed'?'mini':'collapsed')}><span className="floating-tbpn" title={room.title}>{room.title}</span><span className="floating-badge">{source.label}</span></button><div className="floating-window-controls"><button aria-label={mode==='collapsed'?'Restore video player':'Minimize video player'} onClick={()=>setMode(mode==='collapsed'?'mini':'collapsed')}>{mode==='collapsed'?<ChevronUp size={15}/>:<ChevronDown size={15}/>}</button><button aria-label={mode==='expanded'?'Shrink video player':'Expand video player'} onClick={()=>setMode(mode==='expanded'?'mini':'expanded')}>{mode==='expanded'?<Minimize2 size={14}/>:<Maximize2 size={14}/>}</button><button aria-label="Close video player" onClick={onClose}><X size={15}/></button></div></header><div className="floating-player-content" aria-hidden={mode==='collapsed'} inert={mode==='collapsed'}><div className="floating-video-stage">
 {linked||failed?<div className="linked-stream-fallback"><Radio size={24}/><b>{failed?'This player could not load.':source.provider==='twitch'?'Watch Twitch alongside the room.':'Your stream. Your room.'}</b><p>{linked?'Open the stream in another tab and keep ranking and chatting here.':'The broadcaster may limit embedded playback. Open the source to keep watching.'}</p><a href={url} target="_blank" rel="noopener noreferrer">Open {source.label}<ExternalLink size={13}/></a>{failed?<button onClick={()=>{setFailed(false);setRetry(n=>n+1);}}>Retry player</button>:null}</div>:source.provider==='file'?<video key={retry} ref={media} src={source.url} autoPlay muted playsInline controls onTimeUpdate={clock} onPlay={clock} onPause={clock} onLoadedMetadata={()=>{if(media.current)media.current.currentTime=start;clock();}} onError={()=>setFailed(true)}/>:embed?<iframe key={retry+':'+request?.id} src={embed} title={room.title+' · '+source.label} allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowFullScreen onError={()=>setFailed(true)}/>:null}
 </div><div className="floating-video-caption"><p>{request?.videoId===room.videoId?request.title:room.title}</p><div className="floating-playback-controls"><span className="linked-player-note">{source.provider==='file'?'Use the video controls':linked?'Room chat stays here':'Playback controls are inside the player'}</span><a href={url} target="_blank" rel="noopener noreferrer" aria-label="Open stream source"><ExternalLink size={13}/></a></div></div></div></aside>;
}
