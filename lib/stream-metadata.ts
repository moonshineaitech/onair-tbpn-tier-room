import {streamSource} from './stream-source';

export type LiveStatus='live'|'upcoming'|'replay'|'offline'|'unknown';
export type StreamMetadata={source:string;playbackId:string|null;title:string|null;thumbnail:string|null;liveStatus:LiveStatus;checkedAt:number;nextCheckAt:number;statusCheckedAt:number};
const headers={'User-Agent':'Twitterbot/1.0','Accept-Language':'en-US,en;q=0.9'};
function clean(value:unknown,max=240){return typeof value==='string'?value.replace(/[\u0000-\u001f]/g,' ').trim().slice(0,max):'';}
function image(value:unknown){try{const u=new URL(String(value));return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&['i.ytimg.com','img.youtube.com','yt3.googleusercontent.com','yt3.ggpht.com','static-cdn.jtvnw.net','live.staticflickr.com','i.vimeocdn.com','secure-b.vimeocdn.com'].includes(u.hostname)?u.href:null;}catch{return null;}}
function decode(value:string){return value.replace(/&(?:amp|quot|apos|lt|gt|#39|#(\d+)|#x([0-9a-f]+));/gi,(m,n,h)=>n||h?String.fromCodePoint(Math.min(0x10ffff,parseInt(n||h,h?16:10))):({'&amp;':'&','&quot;':'"','&apos;':"'",'&#39;':"'",'&lt;':'<','&gt;':'>'}[m.toLowerCase()]||m));}
function meta(html:string,key:string){for(const tag of html.matchAll(/<meta\s[^>]*>/gi)){const attrs:Record<string,string>={};for(const a of tag[0].matchAll(/([\w:-]+)\s*=\s*(["'])([\s\S]*?)\2/g))attrs[a[1].toLowerCase()]=decode(a[3]);if(attrs.property===key||attrs.name===key)return attrs.content||'';}return '';}
function scriptObject(html:string,name:string){const at=html.search(new RegExp('(?:var\\s+)?'+name+'\\s*='));if(at<0)return null;const start=html.indexOf('{',at);let depth=0,quoted=false,escape=false;for(let i=start;i>=0&&i<html.length;i++){const c=html[i];if(quoted){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')quoted=false;}else if(c==='"')quoted=true;else if(c==='{')depth++;else if(c==='}'&&--depth===0){try{return JSON.parse(html.slice(start,i+1));}catch{return null;}}}return null;}

// A historical broadcast flag is not evidence that a video is live now.
export function youtubeMetadata(html:string,source:string){
 const d=scriptObject(html,'ytInitialPlayerResponse'),s=streamSource(source),v=d?.videoDetails;
 const valid=v&&/^[\w-]{11}$/.test(v.videoId)&&(s.channel||v.videoId===s.id)&&(!s.channel||!source.startsWith('channel:')||v.channelId===s.id);
 if(v&&!valid)return {playbackId:null,title:null,thumbnail:null,liveStatus:'unknown' as LiveStatus};
 if(valid){const b=d.microformat?.playerMicroformatRenderer?.liveBroadcastDetails,status:LiveStatus=d.playabilityStatus?.status==='LIVE_STREAM_OFFLINE'||v.isUpcoming===true?'upcoming':d.playabilityStatus?.status!=='OK'?'unknown':b?.endTimestamp||v.isPostLiveDvr===true?'replay':b?.isLiveNow===true||v.isLive===true||v.isLiveContent===true&&d.playabilityStatus?.liveStreamability?.liveStreamabilityRenderer?.videoId===v.videoId?'live':b?.isLiveNow===false||!v.isLiveContent?'replay':'unknown';return {playbackId:v.videoId as string,title:clean(v.title)||null,thumbnail:image(v.thumbnail?.thumbnails?.at(-1)?.url)||'https://i.ytimg.com/vi/'+v.videoId+'/hqdefault.jpg',liveStatus:status};}
 const title=clean(meta(html,'og:title'));return {playbackId:null,title:title&&title!=='YouTube'?title:null,thumbnail:image(meta(html,'og:image')),liveStatus:'unknown' as LiveStatus};
}
export function twitchMetadata(html:string,source:string,time=Date.now()){
 const s=streamSource(source);let match:any=null;
 for(const script of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{const data=JSON.parse(script[1]),walk=(v:any)=>{if(!v||typeof v!=='object')return;if(v['@type']==='VideoObject'&&v.url&&(s.channel?String(v.url).replace(/\/$/,'')===s.url:String(v.url).endsWith('/videos/'+s.id)))match=v;for(const x of Object.values(v))if(typeof x==='object')Array.isArray(x)?x.forEach(walk):walk(x);};walk(data);}catch{}}
 const event=Array.isArray(match?.publication)?match.publication.find((p:any)=>p['@type']==='BroadcastEvent'):match?.publication,start=Date.parse(event?.startDate||''),end=Date.parse(event?.endDate||'');
 const liveStatus:LiveStatus=!s.channel&&match?'replay':event?.isLiveBroadcast===true&&Number.isFinite(start)&&start<=time&&(!Number.isFinite(end)||end>time)?'live':event&&Number.isFinite(start)&&start>time?'upcoming':event&&Number.isFinite(end)&&end<=time?'offline':'unknown';
 const title=clean(match?.name||meta(html,'og:title'));return {title:title&&title!=='Twitch'?title:null,thumbnail:image((Array.isArray(match?.thumbnailUrl)?match.thumbnailUrl.at(-1):match?.thumbnailUrl)||meta(html,'og:image')),liveStatus};
}
async function read(url:string){
 const signal=AbortSignal.timeout(4500),origin=new URL(url),youtube=origin.hostname.includes('youtube.com');let response:Response;
 for(let i=0;;i++){
  response=await fetch(url,{headers:youtube?{...headers,'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'}:headers,redirect:'manual',signal});
  if(response.status<300||response.status>=400)break;
  await response.body?.cancel();const next=new URL(response.headers.get('location')||'',url),hosts=youtube?['www.youtube.com','youtube.com','m.youtube.com']:[origin.hostname];
  if(i>=2||!response.headers.get('location')||next.protocol!=='https:'||next.username||next.password||next.port||!hosts.includes(next.hostname))throw new Error('Provider redirect unavailable');url=next.href;
 }
 if(!response.ok||Number(response.headers.get('content-length'))>4000000){await response.body?.cancel();throw new Error('Provider response unavailable');}
 const reader=response.body?.getReader();if(!reader)throw new Error('Empty provider response');let bytes=0;const chunks:Uint8Array[]=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>4000000)throw new Error('Provider response too large');chunks.push(value);}}finally{await reader.cancel();}
 const joined=new Uint8Array(bytes);let at=0;for(const chunk of chunks){joined.set(chunk,at);at+=chunk.length;}return new TextDecoder().decode(joined);
}
export async function fetchStreamMetadata(source:string):Promise<Omit<StreamMetadata,'checkedAt'|'nextCheckAt'|'statusCheckedAt'>>{
 const s=streamSource(source),empty={source,playbackId:null,title:null,thumbnail:null,liveStatus:'unknown' as LiveStatus};
 if(s.provider==='youtube'||source.startsWith('youtube-handle:')){try{return {source,...youtubeMetadata(await read(s.url+(s.url.includes('?')?'&':'?')+'hl=en'),source)};}catch{}if(s.provider==='youtube'&&!s.channel){try{const o=JSON.parse(await read('https://www.youtube.com/oembed?url='+encodeURIComponent(s.url)+'&format=json'));return {...empty,title:clean(o.title)||null,thumbnail:image(o.thumbnail_url)};}catch{}}return empty;}
 if(s.provider==='twitch'){try{return {source,playbackId:null,...twitchMetadata(await read(s.url),source)};}catch{return empty;}}
 if(s.provider==='vimeo'){try{const o=JSON.parse(await read('https://vimeo.com/api/oembed.json?url='+encodeURIComponent(s.url)));return {...empty,title:clean(o.title)||null,thumbnail:image(o.thumbnail_url),liveStatus:'replay'};}catch{return empty;}}
 // Never fetch arbitrary user-provided hosts, redirects, or direct media files.
 return empty;
}

export async function cachedStreamMetadata(db:D1Database,source:string,time=Date.now()):Promise<StreamMetadata>{
 const cached=await db.prepare('SELECT * FROM stream_metadata WHERE source=?').bind(source).first<StreamMetadata>();
 if(cached&&cached.nextCheckAt>time)return cached;
 const lease=await db.prepare("INSERT INTO stream_metadata (source,nextCheckAt) VALUES (?,?) ON CONFLICT(source) DO UPDATE SET nextCheckAt=excluded.nextCheckAt WHERE stream_metadata.nextCheckAt<=? RETURNING source").bind(source,time+20000,time).first();
 if(!lease)return cached||{source,playbackId:null,title:null,thumbnail:null,liveStatus:'unknown',checkedAt:0,statusCheckedAt:0,nextCheckAt:time+20000};
 const result=await fetchStreamMetadata(source),checkedAt=Date.now(),supported=['youtube','twitch','vimeo'].includes(streamSource(source).provider)||source.startsWith('youtube-handle:');
 const value:StreamMetadata={...result,title:result.title||cached?.title||null,thumbnail:result.thumbnail||cached?.thumbnail||null,checkedAt,statusCheckedAt:result.liveStatus==='unknown'?0:checkedAt,nextCheckAt:checkedAt+(supported?result.liveStatus==='live'||result.liveStatus==='upcoming'?30000:60000:86400000)};
 await db.prepare('UPDATE stream_metadata SET playbackId=?,title=?,thumbnail=?,liveStatus=?,checkedAt=?,statusCheckedAt=?,nextCheckAt=? WHERE source=? AND nextCheckAt=?').bind(value.playbackId,value.title,value.thumbnail,value.liveStatus,value.checkedAt,value.statusCheckedAt,value.nextCheckAt,source,time+20000).run();return value;
}
export async function refreshDirectoryMetadata(db:D1Database){
 const time=Date.now(),lease=await db.prepare("INSERT INTO settings (key,value) VALUES ('streamDirectoryRefresh',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(value AS INTEGER)<=? RETURNING value").bind(String(time+20000),time).first();if(!lease)return;
 const rows=await db.prepare('SELECT DISTINCT r.videoId source FROM rooms r LEFT JOIN stream_metadata m ON m.source=r.videoId WHERE r.videoId IS NOT NULL AND COALESCE(m.nextCheckAt,0)<=? ORDER BY COALESCE(m.nextCheckAt,0),r.videoId LIMIT 6').bind(time).all<{source:string}>();
 await Promise.all(rows.results.map(row=>cachedStreamMetadata(db,row.source,time)));
}
