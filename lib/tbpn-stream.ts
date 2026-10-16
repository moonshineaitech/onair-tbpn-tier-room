import {TBPN_CHANNEL,TBPN_REPLAY} from './room-data';
import {inShowWindow} from './show-schedule';

export type BroadcastVideo={videoId:string;title:string;isLive:boolean;durationSeconds:number};
export type Broadcast={selected:BroadcastVideo;replay:BroadcastVideo;checkedAt:number;nextCheckAt:number;stale:boolean};
export const FALLBACK_REPLAY:BroadcastVideo={videoId:TBPN_REPLAY,title:'SELL EVERYTHING (Including Your Dollars), PPI God Candle, Lee Jae Myung Says "We Must Live"',isLive:false,durationSeconds:7653};
type ObjectData=Record<string,any>;
function walk(value:unknown,visit:(key:string,value:ObjectData)=>void|boolean){
  if(!value||typeof value!=='object')return;
  for(const [key,item]of Object.entries(value)){if(item&&typeof item==='object'&&visit(key,item as ObjectData)!==false)walk(item,visit);}
}
function duration(text:string){return /^\d+(?::\d{2}){1,2}$/.test(text)?text.split(':').reduce((a,b)=>a*60+Number(b),0):0;}
function text(value:any):string{return typeof value?.content==='string'?value.content:typeof value?.simpleText==='string'?value.simpleText:Array.isArray(value?.runs)?value.runs.map((r:any)=>r.text||'').join(''):'';}

// YouTube serves both legacy renderers and current lockup view models. Only the
// selected Streams tab is considered; Shorts, upcoming shows, and clips are skipped.
export function selectBroadcast(data:unknown):{selected:BroadcastVideo;replay:BroadcastVideo}|null{
  const root=data as ObjectData;
  if(root?.metadata?.channelMetadataRenderer?.externalId!==TBPN_CHANNEL)return null;
  const tabs=root.contents?.twoColumnBrowseResultsRenderer?.tabs||root.contents?.singleColumnBrowseResultsRenderer?.tabs||[];
  const selected=tabs.find((t:any)=>t.tabRenderer?.selected)?.tabRenderer?.content;
  if(!selected)return null;
  const videos:BroadcastVideo[]=[];
  walk(selected,(key,value)=>{
    if(!['videoRenderer','gridVideoRenderer','lockupViewModel'].includes(key))return;
    const modern=key==='lockupViewModel';
    if(modern&&value.contentType!=='LOCKUP_CONTENT_TYPE_VIDEO')return false;
    const videoId=modern?value.contentId:value.videoId;
    if(typeof videoId!=='string'||!/^[-\w]{11}$/.test(videoId)||videos.some(v=>v.videoId===videoId))return false;
    let isLive=false,upcoming=!!value.upcomingEventData,seconds=duration(text(value.lengthText));
    const overlays=modern?value.contentImage?.thumbnailViewModel?.overlays:value.thumbnailOverlays;
    walk({overlays,badges:value.badges},(name,badge)=>{
      if(!['thumbnailBadgeViewModel','thumbnailOverlayTimeStatusRenderer','metadataBadgeRenderer'].includes(name))return;
      const label=typeof badge.text==='string'?badge.text:text(badge.text),style=String(badge.badgeStyle||badge.style||'');
      if(label==='LIVE'||/(?:_LIVE_NOW|_LIVE)$/.test(style)||style==='LIVE')isLive=true;
      if(label==='UPCOMING'||/UPCOMING/.test(style))upcoming=true;
      seconds=Math.max(seconds,duration(label));
    });
    if(upcoming||(!isLive&&seconds<20*60))return false;
    const title=modern?text(value.metadata?.lockupMetadataViewModel?.title):text(value.title);
    if(!title.trim())return false;
    videos.push({videoId,title:title.slice(0,240),isLive,durationSeconds:seconds});
    return false;
  });
  const replay=videos.find(v=>!v.isLive),live=videos.find(v=>v.isLive);
  if(!live&&!replay)return null;
  return {selected:live||replay!,replay:replay||FALLBACK_REPLAY};
}

export function parseBroadcastPage(html:string){
  const match=html.match(/(?:var ytInitialData\s*=\s*|window\["ytInitialData"\]\s*=\s*)([\s\S]*?);\s*<\/script>/);
  if(!match)return null;
  try{return selectBroadcast(JSON.parse(match[1]));}catch{return null;}
}
function validCache(value:unknown):value is Broadcast{
  const v=value as Broadcast;
  return !!v&&/^[-\w]{11}$/.test(v.selected?.videoId)&&/^[-\w]{11}$/.test(v.replay?.videoId)&&typeof v.selected.title==='string'&&typeof v.replay.title==='string'&&typeof v.selected.isLive==='boolean'&&Number.isFinite(v.checkedAt)&&Number.isFinite(v.nextCheckAt);
}
export async function currentBroadcast(database:D1Database):Promise<Broadcast>{
  const time=Date.now();let cached:Broadcast|null=null;
  const row=await database.prepare("SELECT value FROM settings WHERE key='tbpnBroadcast'").first<{value:string}>();
  try{const value=JSON.parse(row?.value||'null');if(validCache(value))cached=value;}catch{}
  const fallback=cached||{selected:FALLBACK_REPLAY,replay:FALLBACK_REPLAY,checkedAt:0,nextCheckAt:0,stale:true};
  if(cached&&cached.nextCheckAt>time)return {...cached,stale:cached.stale||time-cached.checkedAt>120000};
  // One refresh per site, with a short lease so concurrent viewers share the result.
  const lease=await database.prepare("INSERT INTO settings (key,value) VALUES ('tbpnBroadcastLock',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(value AS INTEGER)<? RETURNING value").bind(String(time+15000),time).first();
  if(!lease)return {...fallback,stale:time-fallback.checkedAt>120000};
  try{
    const response=await fetch('https://www.youtube.com/@TBPNLive/streams?hl=en',{headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36','Accept-Language':'en-US,en;q=0.9'},signal:AbortSignal.timeout(8000)});
    if(!response.ok)throw new Error('YouTube channel unavailable');
    const html=await response.text();if(html.length>4000000)throw new Error('YouTube response too large');
    const videos=parseBroadcastPage(html);if(!videos)throw new Error('YouTube stream listing unavailable');
    const result={...videos,checkedAt:Date.now(),nextCheckAt:Date.now()+(inShowWindow()?15000:60000),stale:false};
    await database.prepare("INSERT INTO settings (key,value) VALUES ('tbpnBroadcast',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(JSON.stringify(result)).run();
    return result;
  }catch(error){
    console.warn('TBPN stream refresh unavailable:',error instanceof Error?error.message:'Unknown upstream error');
    const result={...fallback,stale:true,nextCheckAt:Date.now()+30000};
    await database.prepare("INSERT INTO settings (key,value) VALUES ('tbpnBroadcast',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(JSON.stringify(result)).run();
    return result;
  }finally{await database.prepare("UPDATE settings SET value='0' WHERE key='tbpnBroadcastLock' AND value=?").bind(String(time+15000)).run();}
}
