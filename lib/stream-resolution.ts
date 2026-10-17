import {parseStreamSource} from './stream-source';
export async function resolveStreamSource(input:string){
 const source=parseStreamSource(input);if(!source?.startsWith('youtube-handle:'))return source;
 try{const r=await fetch('https://www.youtube.com/@'+source.slice(15),{headers:{Accept:'text/html'},signal:AbortSignal.timeout(5000)});if(!r.ok)return source;const text=await r.text();if(text.length>2000000)return source;const id=text.match(/"channelMetadataRenderer"\s*:\s*\{[\s\S]{0,3000}?"externalId"\s*:\s*"(UC[\w-]{22})"/)?.[1];return id?'channel:'+id:source;}catch{return source;}
}
