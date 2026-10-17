import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const base='http://127.0.0.1:5173',prefix='archive-qa-'+crypto.randomUUID();let checks=0,createdRoom='';
const check=(v,label)=>{assert.ok(v,label);checks++;console.log('PASS '+label);};
const sql=command=>execFileSync(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--config','dist/server/wrangler.json','--persist-to','.wrangler/state','--command',command],{stdio:'pipe'});
const get=async path=>{const response=await fetch(base+'/api/'+path);return {status:response.status,data:await response.json()};};
try{
 const time=Date.now();sql(Array.from({length:105},(_,i)=>`INSERT INTO rooms (id,title,description,status,createdAt) VALUES ('${prefix}-${i}','Archive fixture ${i}','${prefix}','open',${i?time+i:1})`).join(';'));
 const old=await get('state?room='+prefix+'-0');
 check(old.status===200&&old.data.room.id===prefix+'-0','HTTP state resolves a board older than the newest 100 rooms');
 check(old.data.rooms.some(r=>r.id===prefix+'-0'),'the selected old board is retained in the navigation catalog');
 const first=(await get('rooms?q='+prefix)).data,last=(await get('rooms?q='+prefix+'&offset=90')).data;
 check(first.total===105&&first.rooms.length===30&&last.rooms.length===15,'HTTP archive searches and paginates every matching board');
 check(!first.rooms.some(r=>last.rooms.some(s=>s.id===r.id)),'distant archive pages do not duplicate results');
 const pinned=(await get('state?room=tbpn-live')).data;
 check(pinned.room.id==='tbpn-live'&&pinned.latestEpisode?.id!==pinned.room.id,'the API preserves explicit legacy data while exposing the current episode for navigation');
 const current=(await get('state')).data;
 check(current.room.id===current.latestEpisode?.id&&current.room.episodePhase,'default navigation selects the current episode instead of a newer custom board');
 const replays=(await get('rooms?kind=replays')).data;
 check(replays.rooms.every(r=>r.episodePhase==='ended'),'HTTP replay filters use real persisted episode metadata');
 const custom=(await get('rooms?q='+prefix+'&kind=custom')).data;
 check(custom.total===105&&custom.rooms.every(r=>!r.episodePhase),'custom boards remain distinguishable from official episodes');
 check((await get('rooms?q='+encodeURIComponent("' OR 1=1 --"))).data.total===0,'HTTP search rejects SQL-injection semantics');
 check(!JSON.stringify(first).includes('ipHash')&&!JSON.stringify(first).includes('createdBy'),'public archive results expose no visitor identifiers');
 sql(Array.from({length:105},(_,i)=>`INSERT INTO episodes (videoId,roomId,title,startedAt,lastLiveAt,phase) VALUES ('${prefix}-video-${i}','${prefix}-${i}','Local archive fixture',1,0,'ended')`).join(';'));
 const added=await fetch(base+'/api/admin',{method:'POST',headers:{cookie:'__sites_local_auth=1',origin:base,'Content-Type':'application/json'},body:JSON.stringify({action:'room',title:'Archive capacity QA',description:prefix,video:''})});const addedData=await added.json();createdRoom=addedData.roomId||'';
 check(added.status===200&&createdRoom,'more than 100 official episodes do not consume the custom-board allowance');
}finally{sql(`DELETE FROM episodes WHERE roomId LIKE '${prefix}-%'; DELETE FROM rooms WHERE id LIKE '${prefix}-%'${createdRoom?` OR id='${createdRoom}'`:''}`);}
console.log(`${checks} archive API checks passed; disposable fixtures removed.`);
