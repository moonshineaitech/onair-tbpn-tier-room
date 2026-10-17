import {decodeText,type NewsletterTopic} from './newsletter';
import {validateImage} from './upload';

const publishers=['tbpn.substack.com','wsj.com','bloomberg.com','ft.com','nytimes.com','espn.com','variety.com','techcrunch.com','theverge.com','wired.com','axios.com','cnbc.com','reuters.com','apnews.com','fortune.com','forbes.com','businessinsider.com','cnn.com','bbc.com','tesla.com','porsche.com','nvidia.com','meta.com','apple.com','anthropic.com','microsoft.com','openai.com','cardesignnews.com','johnnyjet.com'];
const media=['substackcdn.com','substack-post-media.s3.amazonaws.com','upload.wikimedia.org','thumb.wikimedia.org','images.wsj.net','images.dowjones.com','assets.bwbx.io','bloomberg.com','ftcdn.net','ft.com','nyt.com','espncdn.com','pmc.com','vox-cdn.com','voxmedia.com','reuters.com','cnbcfm.com','techcrunch.com','tesla.com','porsche.com','apple.com','nvidia.com','ytimg.com','gstatic.com','google.com'];
const under=(host:string,domains:string[])=>domains.some(d=>host===d||host.endsWith('.'+d));
export function allowedSource(value:string,kind:'article'|'image'|'api'){
 try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&u.href.length<=2500&&(kind==='api'?u.hostname==='en.wikipedia.org':under(u.hostname,kind==='article'?publishers:[...publishers,...media]));}catch{return false;}
}
export async function sourceBytes(url:string,kind:'article'|'image'|'api',signal:AbortSignal,max:number):Promise<{bytes:Uint8Array;url:string;type:string}>{
 for(let hops=0;hops<4;hops++){
  if(!allowedSource(url,kind))throw new Error('Unsupported source');
  const response=await fetch(url,{redirect:'manual',signal,headers:{Accept:kind==='image'?'image/jpeg,image/png,image/webp':kind==='api'?'application/json':'text/html,application/rss+xml','User-Agent':'OnAir/1.0 (TBPN newsletter board; public sources)'}});
  if(response.status>=300&&response.status<400){const location=response.headers.get('Location');await response.body?.cancel();if(!location)throw new Error('Missing redirect');url=new URL(location,url).href;continue;}
  if(!response.ok||!response.body)throw new Error('Source unavailable');
  const reader=response.body.getReader(),chunks:Uint8Array[]=[];let length=0;
  try{if(Number(response.headers.get('Content-Length'))>max)throw new Error('Source too large');while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>max)throw new Error('Source too large');chunks.push(value);}}catch(e){await reader.cancel();throw e;}finally{reader.releaseLock();}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return {bytes,url,type:(response.headers.get('Content-Type')||'').split(';')[0].trim()};
 }
 throw new Error('Too many redirects');
}
const attributes=(tag:string)=>Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)].map(m=>[m[1].toLowerCase(),decodeText(m[2])]));
export function articleImage(html:string,base:string){for(const tag of html.match(/<meta\b[^>]*>/gi)||[]){const a=attributes(tag);if(['og:image','twitter:image','twitter:image:src'].includes(a.property||a.name)){try{const url=new URL(a.content,base).href;if(allowedSource(url,'image'))return url;}catch{}}}return null;}
const brands:[RegExp,string,string][]=[[/tesla|roadster/i,'Tesla, Inc.','tesla.com'],[/porsche/i,'Porsche','porsche.com'],[/nvidia/i,'Nvidia','nvidia.com'],[/\bmeta\b|facebook/i,'Meta Platforms','meta.com'],[/apple|iphone/i,'Apple Inc.','apple.com'],[/anthropic|claude/i,'Anthropic','anthropic.com'],[/openai|chatgpt/i,'OpenAI','openai.com'],[/microsoft/i,'Microsoft','microsoft.com'],[/google|gemini|deepmind/i,'Google','google.com'],[/\bnba\b/i,'National Basketball Association','nba.com'],[/coreweave/i,'CoreWeave','coreweave.com'],[/\bdell\b/i,'Dell','dell.com'],[/\bdelta\b/i,'Delta Air Lines','delta.com'],[/\bramp\b/i,'Ramp (company)','ramp.com'],[/amazon/i,'Amazon (company)','amazon.com'],[/spacex/i,'SpaceX','spacex.com']];
export type AcquiredImage={bytes:Uint8Array;contentType:string;sourceUrl:string;credit:string;kind:string};
export async function topicImage(topic:NewsletterTopic,videoId:string,deadline:number):Promise<AcquiredImage|null>{
 const overall=AbortSignal.timeout(Math.max(1,deadline-Date.now())),requestSignal=()=>AbortSignal.any([overall,AbortSignal.timeout(1800)]);
 const image=async(url:string,sourceUrl:string,credit:string,kind:string)=>{const r=await sourceBytes(url,'image',requestSignal(),2000000);return {...validateImage(r.bytes,r.type),sourceUrl,credit,kind};};
 if(topic.imageUrl){try{let url=topic.imageUrl;if(new URL(url).hostname==='substackcdn.com')url=url.replace(/\/image\/fetch\/([^/]+)\//,'/image/fetch/w_480,c_limit,f_jpg,q_80/');return await image(url,topic.sourceUrl||topic.imageUrl,'TBPN newsletter image','newsletter');}catch{}}
 if(topic.sourceUrl&&allowedSource(topic.sourceUrl,'article')){try{const article=await sourceBytes(topic.sourceUrl,'article',requestSignal(),600000),url=articleImage(new TextDecoder().decode(article.bytes),article.url);if(url)return await image(url,article.url,'Image from '+new URL(article.url).hostname,'article');}catch{}}
 const brand=brands.find(([pattern])=>pattern.test(topic.original)),entity=topic.entity||brand?.[1];
 if(entity&&entity.length<=100){try{
  const url='https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&pilicense=free&pithumbsize=400&redirects=1&titles='+encodeURIComponent(entity);
  const r=await sourceBytes(url,'api',requestSignal(),150000),page=Object.values(JSON.parse(new TextDecoder().decode(r.bytes)).query.pages)[0] as {thumbnail?:{source:string};pageimage?:string};
  if(page.thumbnail?.source&&page.pageimage){const info=await sourceBytes('https://en.wikipedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=extmetadata%7Curl&titles='+encodeURIComponent('File:'+page.pageimage),'api',requestSignal(),150000),entry=(Object.values(JSON.parse(new TextDecoder().decode(info.bytes)).query.pages)[0] as any)?.imageinfo?.[0];
   if(entry?.descriptionurl&&entry.extmetadata?.LicenseShortName?.value){const text=(v:string)=>decodeText(v.replace(/<[^>]*>/g,'')).slice(0,150);return await image(page.thumbnail.source,entry.descriptionurl,text(entry.extmetadata.Artist?.value||'Wikimedia Commons')+' · '+text(entry.extmetadata.LicenseShortName.value),'illustration');}
  }
 }catch{}}
 if(brand){try{return await image('https://www.google.com/s2/favicons?domain='+brand[2]+'&sz=128','https://'+brand[2],brand[1]+' brand icon','brand');}catch{}}
 // A verified episode thumbnail is preferable to a guessed person or event.
 try{return await image('https://i.ytimg.com/vi/'+videoId+'/hqdefault.jpg','https://www.youtube.com/watch?v='+videoId,'TBPN episode thumbnail','episode');}catch{return null;}
}
