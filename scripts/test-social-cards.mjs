import assert from 'node:assert/strict';
import {createHash,randomInt} from 'node:crypto';
import {deflateSync} from 'node:zlib';
import {writeFileSync,readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import ts from 'typescript';
const cache=new Map();function moduleUrl(file){file=resolve(file);if(cache.has(file))return cache.get(file);let js=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;js=js.replace(/from\s+(['"])(\.[^'"]+)\1/g,(_,q,p)=>'from '+q+moduleUrl(resolve(dirname(file),p+'.ts'))+q);const url='data:text/javascript;base64,'+Buffer.from(js).toString('base64');cache.set(file,url);return url;}
const {publishedBoardUrl,personalBoardUrl}=await import(moduleUrl('lib/board-share.ts'));
const {initialRoomTarget}=await import(moduleUrl('lib/episode-navigation.ts'));
const {boardMetadata}=await import(moduleUrl('lib/board-metadata.ts'));
const {boardPreviewMedia}=await import(moduleUrl('lib/board-preview-media.ts'));
let checks=0;const check=(v,label)=>{assert.ok(v,label);checks++;console.log('PASS '+label);};
check(initialRoomTarget(new URLSearchParams('room=tbpn-live&view=mine'))==='tbpn-live','personal boards made from a legacy shared episode stay pinned after reload');
check(personalBoardUrl('','show & one')==='/tier-list?room=show%20%26%20one&view=mine','a personal-board entry link pins the selected episode');
check(publishedBoardUrl('https://example.com','r','p',123).endsWith('&v=123'),'newly shared snapshots carry a version for refreshed link previews');
check(boardMetadata(null).robots.index===false&&!boardMetadata(null).openGraph.images.length,'unavailable boards have no ranking preview metadata');
let reads=0;const external={post:{entries:[{itemId:'external',tier:'S',score:100}]},moments:[{id:'external',image:'https://untrusted.example/private.png'}]};
check(!Object.keys(await boardPreviewMedia({get:async()=>{reads++;}},external)).length&&!reads,'preview rendering never fetches arbitrary external image URLs');
const base='http://127.0.0.1:5173',network=randomInt(20,240);
async function client(part,admin=false){let cookie=admin?'__sites_local_auth=1':'';const call=async(path,body)=>{const r=await fetch(base+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{'cf-connecting-ip':`127.81.${network}.${part}`,...(cookie?{cookie}:{}),...(body===undefined?{}:{origin:base,'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')};};if(!admin){const c=await call('challenge');let n=0;while(!createHash('sha256').update(c.data.id+':'+n).digest('hex').startsWith('0000'))n++;cookie=(await call('verify',{id:c.data.id,nonce:String(n)})).cookie.split(';')[0];}return call;}
function png(){const crc=b=>{let c=-1;for(const n of b){c^=n;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^-1)>>>0;};const chunk=(type,body)=>{const data=Buffer.concat([Buffer.from(type),body]),size=Buffer.alloc(4),sum=Buffer.alloc(4);size.writeUInt32BE(body.length);sum.writeUInt32BE(crc(data));return Buffer.concat([size,data,sum]);};const header=Buffer.alloc(13);header.writeUInt32BE(16);header.writeUInt32BE(16,4);header[8]=8;header[9]=2;const pixels=Buffer.alloc(16*49);for(let y=0;y<16;y++)for(let x=0;x<16;x++){const p=y*49+1+x*3;pixels[p]=242;pixels[p+1]=145;pixels[p+2]=112;}return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',header),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);}
const admin=await client(1,true),a=await client(2),b=await client(3);
const roomId=(await admin('admin',{action:'room',title:'Social preview QA',description:'Disposable local crawler and visitor flow checks',video:''})).data.roomId;assert.ok(roomId);
const names=['Product <launch> & roadmap','Tesla Roadster reveal','YCSE review','Walter Isaacson interview','Eric Glyman / Ramp','Christian Jensen / Dragoneer','Tavarish on cars','Porsche Mission S','ARK’s CoreWeave thesis','Nvidia open models','Airplane window-shade debate','Data-center IPO fallout','Anthropic credit rating','Ben Affleck on movie risk','Cars and houses','Michael Dell on AI','iPhone supply crunch','Market-index fallout','NBA betting limits','The closing take'],ids=[];
for(let i=0;i<names.length;i++){const r=await admin('moments',{roomId,title:names[i],description:'Local QA segment',category:i%3?'Moment':'Guest',...(i===0?{image:'data:image/png;base64,'+png().toString('base64')}:{})});assert.equal(r.status,201);ids.push(r.data.id);}
const tiers=['S','S','S','A','A','A','A','B','B','B','B','C','C','C','D','D','D','F','F','F'];await a('vote',{roomId,changes:ids.map((itemId,i)=>({itemId,tier:tiers[i],score:{S:100,A:80,B:60,C:40,D:20,F:0}[tiers[i]]}))});
await a('boards/settings',{roomId,title:'Newsletter <recap> & rankings',byline:'Guest "One"',autoPublish:false});const id=(await a('boards/publish',{roomId})).data.id;assert.ok(id);
const imagePath='/api/board-preview/'+id,pagePath='/tier-list?room='+roomId+'&board='+id;
async function html(){const r=await fetch(base+pagePath,{headers:{'user-agent':'Twitterbot/1.0'}});assert.equal(r.status,200);return (await r.text()).split('</head>')[0];}
const firstHead=await html();check(firstHead.includes('name="twitter:card" content="summary_large_image"'),'Twitterbot receives a large-image card in server HTML before JavaScript');
check(firstHead.includes('property="og:image"')&&firstHead.includes('name="twitter:image"')&&firstHead.includes('og:image:width" content="1200"'),'Open Graph and X both receive an absolute 1200px ranking-image URL');
check(firstHead.includes('20/20 segments')&&firstHead.includes('Newsletter &lt;recap&gt; &amp; rankings'),'social metadata uses saved rankings and escapes markup in titles');
check(!firstHead.includes('visitor:')&&!firstHead.includes('ipHash')&&!firstHead.includes('@sites.test'),'crawler metadata contains no visitor identities or email addresses');
const image=await fetch(base+imagePath),bytes=Buffer.from(await image.arrayBuffer()),etag=image.headers.get('etag');
check(image.status===200&&image.headers.get('content-type')==='image/png'&&bytes.subarray(0,8).toString('hex')==='89504e470d0a1a0a','an unauthenticated crawler can fetch a real PNG of the published board');
check(bytes.readUInt32BE(16)===1200&&bytes.readUInt32BE(20)===630&&bytes.length<5000000,'ranking cards use the intended dimensions and stay below 5MB');
check(image.headers.get('cache-control').includes('must-revalidate'),'public preview requests revalidate visibility instead of serving immutable stale images');
const again=await fetch(base+imagePath);check(Buffer.compare(bytes,Buffer.from(await again.arrayBuffer()))===0,'a repeat request serves the same cached ranking image');
check((await fetch(base+imagePath,{headers:{'if-none-match':etag}})).status===304,'unchanged visible rankings support conditional image requests');
const head=await fetch(base+imagePath,{method:'HEAD'});check(head.status===200&&head.headers.get('content-type')==='image/png'&&(await head.arrayBuffer()).byteLength===0,'crawler HEAD requests return image metadata without rendering a body');
const before=(await b('posts?room='+roomId+'&id='+id)).data.posts[0];await b('vote',{roomId,changes:[{itemId:ids[1],tier:'F',score:0}]});
check((await b('state?room='+roomId)).data.mine[0].tier==='F'&&(await b('posts?room='+roomId+'&id='+id)).data.posts[0].entries.find(v=>v.itemId===ids[1]).tier==='S','a visitor can start an independent board without changing the shared snapshot');
await b('vote',{roomId,changes:ids.map(itemId=>({itemId,tier:'S',score:100}))});const allS=(await b('boards/publish',{roomId})).data.id,allImage=await fetch(base+'/api/board-preview/'+allS);check(allImage.status===200&&(await allImage.arrayBuffer()).byteLength>10000,'an extreme board with all twenty segments in S still renders a complete PNG');
await a('vote',{roomId,changes:[{itemId:ids[0],tier:'F',score:0}]});check((await fetch(base+imagePath,{method:'HEAD'})).headers.get('etag')===etag,'private draft edits leave the published preview unchanged');
await a('boards/publish',{roomId});const updatedHead=await html(),updated=await fetch(base+imagePath),updatedBytes=Buffer.from(await updated.arrayBuffer());
check(updated.headers.get('etag')!==etag&&updatedHead!==firstHead&&Buffer.compare(bytes,updatedBytes)!==0,'republishing updates the metadata version and ranking image while keeping the post identifier');
await admin('admin',{action:'moderate',id:ids[0],status:'hidden'});const moderated=await fetch(base+imagePath,{method:'HEAD'});check(moderated.headers.get('etag')!==updated.headers.get('etag')&&(await html()).includes('19/19 segments'),'moderated segments are excluded from previews and change the cached image version');
await a('boards/unpublish',{roomId});check((await fetch(base+imagePath,{headers:{'if-none-match':moderated.headers.get('etag')}})).status===404,'a withdrawn board cannot be retrieved from the image cache or receive a 304');
check(!(await html()).includes('name="twitter:image"'),'withdrawn boards stop advertising ranking images to crawlers');
await a('boards/publish',{roomId});await admin('boards/moderate',{roomId,id,hidden:true});check((await fetch(base+imagePath)).status===404&&!(await html()).includes('property="og:image"'),'admin-hidden boards expose neither image bytes nor ranking metadata');
check((await fetch(base+'/api/board-preview/not-a-post')).status===404,'malformed preview identifiers fail safely');
await admin('boards/moderate',{roomId,id,hidden:false});await admin('admin',{action:'moderate',id:ids[0],status:'approved'});
const wrong=await fetch(base+'/tier-list?room=the-warm-up&board='+id,{headers:{'user-agent':'Twitterbot/1.0'}});check(!(await wrong.text()).includes('name="twitter:image"'),'a mismatched episode link cannot advertise another room’s board');
const final=await fetch(base+imagePath);writeFileSync('../outputs/onair-shared-board-card-v18.png',Buffer.from(await final.arrayBuffer()));writeFileSync('.sites-runtime/social-fixture.json',JSON.stringify({roomId,id,ids,pagePath}));
console.log(`${checks} social-card and shared-board entry checks passed. Room: ${roomId}, post: ${id}`);
