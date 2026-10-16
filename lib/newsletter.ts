export type NewsletterTopic={title:string;category:string;original:string};
export type Newsletter={title:string;url:string;publishedAt:string;topics:NewsletterTopic[]};
const entities:Record<string,string>={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};
export function decodeText(s:string){return s.replace(/&#(x[\da-f]+|\d+);|&(amp|lt|gt|quot|apos|nbsp);/gi,(_,code,named)=>{if(named)return entities[named.toLowerCase()];const n=code[0].toLowerCase()==='x'?parseInt(code.slice(1),16):Number(code);return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';});}
const clean=(s:string)=>decodeText(s.replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
function add(topics:NewsletterTopic[],line:string,category='Moment'){
 const original=clean(line).replace(/^[\s•\-*\d.)]+/,'').trim();
 if(original.length<4||original.length>400||/^(?:subscribe|unsubscribe|share this|thanks for|happy (?:monday|tuesday|wednesday|thursday|friday))/i.test(original))return;
 if(!topics.some(t=>t.original.toLowerCase()===original.toLowerCase()))topics.push({title:original.slice(0,70),original,category});
}
export function pasteTopics(input:string){
 const topics:NewsletterTopic[]=[];let category='Moment',section=false;
 for(const line of input.split(/\r?\n/)){const text=clean(line);if(/^(?:today.s lineup|guests|headlines|topics|run of show)\s*:?$/i.test(text)){category=/lineup|guests/i.test(text)?'Guest':'Moment';section=true;continue;}if(/^(?:posts of the day|subscribe|unsubscribe)/i.test(text))break;if(section||/^\s*(?:[-*•]|\d+[.)])\s+/.test(line))add(topics,line,category);}
 if(!topics.length)for(const line of input.split(/\r?\n/)){if(clean(line).length<=160)add(topics,line);}
 return topics.slice(0,30);
}
export function parseNewsletterFeed(xml:string):Newsletter|null{
 const item=xml.match(/<item>([\s\S]*?)<\/item>/)?.[1];if(!item)return null;
 const field=(name:string)=>item.match(new RegExp('<'+name+'[^>]*>([\\s\\S]*?)<\\/'+name+'>'))?.[1].replace(/^<!\[CDATA\[|\]\]>$/g,'')||'';
 const title=clean(field('title')),url=decodeText(field('link')).trim(),publishedAt=field('pubDate');
 if(!url.startsWith('https://tbpn.substack.com/p/'))return null;
 const html=field('content:encoded'),topics:NewsletterTopic[]=[];let run=false;
 for(const match of html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>([\s\S]*?)(?=<h[1-3][\s>]|$)/g)){
   const heading=clean(match[1]);
   if(/^run of show$/i.test(heading)){run=true;continue;}
   if(/^(?:headlines|today.s lineup)$/i.test(heading)){
     run=false;const category=/lineup/i.test(heading)?'Guest':'Moment';const chunks=[...match[2].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)];
     const paragraphs=chunks.length?chunks:[...match[2].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)];for(const part of paragraphs)add(topics,part[1],category);
   }else if(run&&!/spotlight|posts of the day/i.test(heading)){add(topics,heading);run=false;}
 }
 return {title,url,publishedAt,topics:topics.slice(0,30)};
}
