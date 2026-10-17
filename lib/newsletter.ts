export type NewsletterTopic={title:string;category:string;original:string;sourceUrl?:string;imageUrl?:string;entity?:string};
export type Newsletter={title:string;url:string;publishedAt:string;topics:NewsletterTopic[];videoIds?:string[]};
const entities:Record<string,string>={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};
export function decodeText(s:string){return s.replace(/&#(x[\da-f]+|\d+);|&(amp|lt|gt|quot|apos|nbsp);/gi,(_,code,named)=>{if(named)return entities[named.toLowerCase()];const n=code[0].toLowerCase()==='x'?parseInt(code.slice(1),16):Number(code);return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';});}
const clean=(s:string)=>decodeText(s.replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
function add(topics:NewsletterTopic[],line:string,category='Moment',imageUrl?:string){
 const original=clean(line).replace(/^[\s•\-*\d.)]+/,'').trim();
 if(original.length<4||original.length>400||/^(?:subscribe|unsubscribe|share this|thanks for|happy (?:monday|tuesday|wednesday|thursday|friday))/i.test(original))return;
 const anchor=line.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
 const sourceUrl=anchor?safeNewsletterLink(anchor[1]):undefined;
 imageUrl=safeNewsletterLink(line.match(/<img\b[^>]*src=["']([^"']+)["']/i)?.[1]||imageUrl||'');
 if(!topics.some(t=>t.original.toLowerCase()===original.toLowerCase()))topics.push({title:original.slice(0,70),original,category,...(sourceUrl?{sourceUrl}:{}),...(imageUrl?{imageUrl}:{}),...(category==='Guest'&&anchor?{entity:clean(anchor[2])}:{})});
}
function safeNewsletterLink(value:string){try{const u=new URL(decodeText(value));if(!['http:','https:'].includes(u.protocol)||u.username||u.password)return;u.protocol='https:';return u.href.length<=2000?u.href:undefined;}catch{return;}}
export function pasteTopics(input:string){
 const topics:NewsletterTopic[]=[];let category='Moment',section=false;
 for(const line of input.split(/\r?\n/)){const text=clean(line);if(/^(?:today.s lineup|guests|headlines|topics|run of show)\s*:?$/i.test(text)){category=/lineup|guests/i.test(text)?'Guest':'Moment';section=true;continue;}if(/^(?:posts of the day|subscribe|unsubscribe)/i.test(text))break;if(section||/^\s*(?:[-*•]|\d+[.)])\s+/.test(line))add(topics,line,category);}
 if(!topics.length)for(const line of input.split(/\r?\n/)){if(clean(line).length<=160)add(topics,line);}
 return topics.slice(0,30);
}
function parseIssue(item:string):Newsletter|null{
 const field=(name:string)=>item.match(new RegExp('<'+name+'[^>]*>([\\s\\S]*?)<\\/'+name+'>'))?.[1].replace(/^<!\[CDATA\[|\]\]>$/g,'')||'';
 const title=clean(field('title')),url=decodeText(field('link')).trim(),publishedAt=field('pubDate');
 if(!url.startsWith('https://tbpn.substack.com/p/'))return null;
 const html=field('content:encoded'),topics:NewsletterTopic[]=[];let run=false,runImage:string|undefined;
 for(const match of html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>([\s\S]*?)(?=<h[1-3][\s>]|$)/g)){
   const heading=clean(match[1]);
   if(/^run of show$/i.test(heading)){run=true;runImage=match[2].match(/<img\b[^>]*src=["']([^"']+)["']/i)?.[1];continue;}
   if(/^(?:headlines|today.s lineup)$/i.test(heading)){
     run=false;const category=/lineup/i.test(heading)?'Guest':'Moment';const chunks=[...match[2].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)];
     const paragraphs=chunks.length?chunks:[...match[2].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)];for(const part of paragraphs)add(topics,part[1],category);
   }else if(run&&!/spotlight|posts of the day/i.test(heading)){add(topics,match[1],'Moment',runImage);run=false;}
 }
 const videoIds=[...new Set([...html.matchAll(/https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|live\/|embed\/)|youtu\.be\/)([\w-]{11})/g)].map(m=>m[1]))];
 return {title,url,publishedAt,topics:topics.slice(0,30),videoIds};
}
export function parseNewsletterIssues(xml:string){return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0,40).map(m=>parseIssue(m[1])).filter((n):n is Newsletter=>!!n);}
export function parseNewsletterFeed(xml:string):Newsletter|null{return parseNewsletterIssues(xml)[0]||null;}
const airDate=(time:number)=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(time);
export function newsletterForEpisode(issues:Newsletter[],videoId:string,startedAt:number){
 const exact=issues.filter(n=>n.topics.length&&n.videoIds?.includes(videoId));if(exact.length)return exact[0];
 // Date fallback is permitted only for issues with no video link at all. A link to
 // another show always wins over coincidental publication on the same date.
 const dated=issues.filter(n=>{const published=Date.parse(n.publishedAt);return n.topics.length&&!n.videoIds?.length&&Number.isFinite(published)&&airDate(published)===airDate(startedAt)&&published>=startedAt-7200000&&published<=startedAt+21600000;});
 return dated.length===1?dated[0]:null;
}
