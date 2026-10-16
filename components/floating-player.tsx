'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {ChevronDown,ChevronUp,ExternalLink,Maximize2,Minimize2,Pause,Play,Radio,Volume2,VolumeX,X,RotateCcw} from 'lucide-react';
import {inShowWindow,SHOW_SCHEDULE} from '@/lib/show-schedule';
import {FALLBACK_REPLAY,type Broadcast,type BroadcastVideo} from '@/lib/tbpn-stream';

export type PlaybackRequest={id:number;videoId:string|null;start:number;title:string};
type Player={playVideo:()=>void;pauseVideo:()=>void;mute:()=>void;unMute:()=>void;setVolume:(n:number)=>void;loadVideoById:(v:{videoId:string;startSeconds:number})=>void;destroy:()=>void};
type Youtube={Player:new(element:HTMLElement,options:unknown)=>Player};
type YoutubeWindow=Window&{YT?:Youtube;onYouTubeIframeAPIReady?:()=>void};
let youtubeReady:Promise<Youtube>|null=null;
function youtube(){
 const w=window as YoutubeWindow;if(w.YT?.Player)return Promise.resolve(w.YT);
 if(!youtubeReady)youtubeReady=new Promise<Youtube>((resolve,reject)=>{
   const previous=w.onYouTubeIframeAPIReady;
   const timer=setTimeout(()=>{youtubeReady=null;reject(new Error('The YouTube player is taking longer than expected.'));},12000);
   w.onYouTubeIframeAPIReady=()=>{previous?.();clearTimeout(timer);if(w.YT)resolve(w.YT);};
   let script=document.querySelector<HTMLScriptElement>('#youtube-iframe-api');
   if(!script){script=document.createElement('script');script.id='youtube-iframe-api';script.src='https://www.youtube.com/iframe_api';script.async=true;script.onerror=()=>{clearTimeout(timer);youtubeReady=null;script?.remove();reject(new Error('YouTube could not be loaded.'));};document.head.appendChild(script);}
 });return youtubeReady;
}
type Mode='mini'|'expanded'|'collapsed';
type Props={open:boolean;reveal:number;onOpen:()=>void;onClose:()=>void;request:PlaybackRequest|null};
export default function FloatingPlayer({open,reveal,onOpen,onClose,request}:Props){
 const [broadcast,setBroadcast]=useState<Broadcast|null>(null),[mode,setMode]=useState<Mode>('mini'),[manual,setManual]=useState<(BroadcastVideo&{start:number;requestId:number})|null>(null),[volume,setVolume]=useState(70),[volumeOpen,setVolumeOpen]=useState(false),[muted,setMuted]=useState(true),[playing,setPlaying]=useState(false),[ready,setReady]=useState(false),[blocked,setBlocked]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const lastCheck=useRef(0),volumeRoot=useRef<HTMLDivElement>(null),volumeRef=useRef(70),host=useRef<HTMLDivElement>(null),player=useRef<Player|null>(null),playerReady=useRef(false),mutedRef=useRef(true),modeBeforeCollapse=useRef<Mode>('mini');
 const active=manual||broadcast?.selected,activeRef=useRef(active);activeRef.current=active;
 const start=manual?.start||0,startRef=useRef(start);startRef.current=start;
 const refresh=useCallback(async(signal?:AbortSignal)=>{lastCheck.current=Date.now();try{const r=await fetch('/api/stream',{cache:'no-store',signal});if(!r.ok)throw new Error();const result=await r.json() as Broadcast;if(!/^[-\w]{11}$/.test(result.selected?.videoId))throw new Error();setBroadcast(result);window.dispatchEvent(new CustomEvent('onair:broadcast',{detail:result}));}catch(e){if((e as Error).name==='AbortError')return;setBroadcast(previous=>previous?{...previous,stale:true}:{selected:FALLBACK_REPLAY,replay:FALLBACK_REPLAY,checkedAt:0,nextCheckAt:0,stale:true});}},[]);
 useEffect(()=>{const controller=new AbortController();void refresh(controller.signal);const tick=()=>{if(document.visibilityState==='visible'&&Date.now()-lastCheck.current>=(inShowWindow()?14000:59000))void refresh(controller.signal);};const interval=setInterval(tick,15000);document.addEventListener('visibilitychange',tick);return()=>{controller.abort();clearInterval(interval);document.removeEventListener('visibilitychange',tick);};},[refresh]);
 useEffect(()=>{if(!reveal)return;setMode('mini');},[reveal]);
 useEffect(()=>{if(!request)return;const explicit=request.videoId&&/^[-\w]{11}$/.test(request.videoId)?request.videoId:null;const current=activeRef.current;if(!explicit&&!current)return;setManual({videoId:explicit||current!.videoId,title:request.title,isLive:false,durationSeconds:0,start:request.start,requestId:request.id});setMode('mini');},[request]);
 useEffect(()=>{
   if(!open||!host.current||!activeRef.current)return;
   let cancelled=false;setError('');setReady(false);playerReady.current=false;
   youtube().then(api=>{if(cancelled||!host.current)return;const element=document.createElement('div');host.current.appendChild(element);
     player.current=new api.Player(element,{width:'100%',height:'100%',videoId:activeRef.current!.videoId,playerVars:{autoplay:1,mute:1,playsinline:1,rel:0,origin:location.origin,start:startRef.current},events:{
       onReady:(event:{target:Player})=>{if(cancelled)return;playerReady.current=true;setReady(true);if(mutedRef.current)event.target.mute();else{event.target.unMute();event.target.setVolume(volumeRef.current);}event.target.loadVideoById({videoId:activeRef.current!.videoId,startSeconds:startRef.current});},
       onStateChange:(event:{data:number})=>{if(cancelled)return;setPlaying(event.data===1);if(event.data===1)setBlocked(false);},
       onAutoplayBlocked:()=>{if(!cancelled)setBlocked(true);},
       onError:()=>{if(!cancelled)setError('This video cannot play here. Open it on YouTube or retry.');}
     }});
   }).catch(e=>{if(!cancelled)setError((e as Error).message);});
   return()=>{cancelled=true;playerReady.current=false;player.current?.destroy();player.current=null;};
 },[open,!!active,retry]);
 useEffect(()=>{if(playerReady.current&&active){setError('');setBlocked(false);player.current?.loadVideoById({videoId:active.videoId,startSeconds:start});}},[active?.videoId,manual?.requestId,start]);
 useEffect(()=>{if(!volumeOpen)return;const outside=(e:PointerEvent)=>{if(!volumeRoot.current?.contains(e.target as Node))setVolumeOpen(false);};const key=(e:KeyboardEvent)=>{if(e.key==='Escape')setVolumeOpen(false);};document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key);};},[volumeOpen]);
 function sound(){if(!player.current||!ready)return;const next=!muted;mutedRef.current=next;setMuted(next);if(next)player.current.mute();else{if(!volumeRef.current){volumeRef.current=70;setVolume(70);}player.current.unMute();player.current.setVolume(volumeRef.current);player.current.playVideo();}}
 function adjustVolume(value:number){volumeRef.current=value;setVolume(value);mutedRef.current=value===0;setMuted(value===0);player.current?.setVolume(value);if(value)player.current?.unMute();else player.current?.mute();}
 function playback(){if(!player.current||!ready)return;if(playing)player.current.pauseVideo();else player.current.playVideo();}
 function collapse(){setVolumeOpen(false);if(mode==='collapsed')setMode(modeBeforeCollapse.current);else{modeBeforeCollapse.current=mode;setMode('collapsed');}}
 const live=!!active?.isLive&&!broadcast?.stale&&!manual,label=!active?'CONNECTING':manual?'EPISODE':live?'LIVE NOW':broadcast?.stale?'TBPN REPLAY':'LATEST FULL SHOW';
 const url='https://www.youtube.com/watch?v='+(active?.videoId||FALLBACK_REPLAY.videoId);
 if(!open)return <button className="floating-reopen" onClick={onOpen}><Radio size={14}/><span>Watch TBPN</span><ChevronUp size={14}/></button>;
 return <aside id="stream-panel" className={`floating-player player-${mode}`} aria-label="TBPN floating video player">
   <header className="floating-player-header"><button className="floating-player-brand" onClick={()=>{if(mode==='collapsed')collapse();}} aria-label={mode==='collapsed'?'Restore TBPN player':'TBPN player'}><span className="floating-tbpn" title={SHOW_SCHEDULE}>TBPN</span><span className={'floating-badge '+(live?'is-live':'')}>{live?<i/>:null}{label}</span></button><div className="floating-window-controls">
     <button onClick={collapse} aria-label={mode==='collapsed'?'Restore video player':'Minimize video player'} title={mode==='collapsed'?'Restore':'Minimize'}>{mode==='collapsed'?<ChevronUp size={15}/>:<ChevronDown size={15}/>}</button>
     {mode!=='collapsed'?<button onClick={()=>setMode(mode==='expanded'?'mini':'expanded')} aria-label={mode==='expanded'?'Shrink video player':'Expand video player'} title={mode==='expanded'?'Shrink':'Expand'}>{mode==='expanded'?<Minimize2 size={14}/>:<Maximize2 size={14}/>}</button>:null}
     <button onClick={()=>{setVolumeOpen(false);onClose();}} aria-label="Close video player" title="Close"><X size={15}/></button>
   </div></header>
   <div className="floating-player-content" aria-hidden={mode==='collapsed'} inert={mode==='collapsed'}>
     <div className="floating-video-stage"><div ref={host} className="floating-video-host"/>{!active?<div className="floating-loading"><Radio size={20}/><span>Finding the current TBPN show…</span></div>:null}{error?<div className="floating-error" role="status"><p>{error}</p><a href={url} target="_blank" rel="noreferrer">Watch on YouTube<ExternalLink size={12}/></a><button onClick={()=>{setError('');if(playerReady.current)player.current?.loadVideoById({videoId:active!.videoId,startSeconds:start});else setRetry(n=>n+1);}}>Retry<RotateCcw size={12}/></button></div>:null}</div>
     <div className="floating-video-caption"><p title={active?.title}>{active?.title||'Technology’s daily show.'}</p><div className="floating-playback-controls"><button onClick={playback} disabled={!ready} aria-label={playing?'Pause TBPN video':'Play TBPN video'}>{playing?<Pause size={13}/>:<Play size={13}/>}</button><div className="floating-volume-control" ref={volumeRoot}><button className="floating-sound" onClick={sound} disabled={!ready} aria-label={muted?'Unmute TBPN video':'Mute TBPN video'}>{muted?<VolumeX size={14}/>:<Volume2 size={14}/>}<span>{blocked?'Tap to play':muted?'Sound off':'Sound on'}</span></button><button className="volume-dropdown-toggle" aria-label="Adjust volume" aria-expanded={volumeOpen} disabled={!ready} onClick={()=>setVolumeOpen(v=>!v)}><ChevronDown size={11}/></button>{volumeOpen?<div className="floating-volume-popover"><label htmlFor="tbpn-volume">Volume <b>{muted?0:volume}%</b></label><input id="tbpn-volume" aria-label="TBPN volume" type="range" min={0} max={100} step={1} value={muted?0:volume} onChange={e=>adjustVolume(Number(e.target.value))}/></div>:null}</div>{manual?<button className="floating-follow-live" onClick={()=>{setManual(null);void refresh();}}>Back to {broadcast?.selected.isLive?'live':'latest'}</button>:null}<a href={url} target="_blank" rel="noreferrer" aria-label="Open current TBPN video on YouTube"><ExternalLink size={13}/></a></div></div>
   </div>
   {mode==='collapsed'?<div className="floating-collapsed-controls"><button onClick={playback} disabled={!ready} aria-label={playing?'Pause TBPN video':'Play TBPN video'}>{playing?<Pause size={13}/>:<Play size={13}/>}</button><button onClick={sound} disabled={!ready} aria-label={muted?'Unmute TBPN video':'Mute TBPN video'}>{muted?<VolumeX size={14}/>:<Volume2 size={14}/>}</button></div>:null}
 </aside>;
}
