import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import ts from 'typescript';
const modules=new Map();function moduleUrl(file){file=resolve(file);if(modules.has(file))return modules.get(file);let js=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;js=js.replace(/from\s+(['"])(\.[^'"]+)\1/g,(_,q,p)=>'from '+q+moduleUrl(resolve(dirname(file),p+'.ts'))+q);const url='data:text/javascript;base64,'+Buffer.from(js).toString('base64');modules.set(file,url);return url;}
const {ensureThielPredictions,THIEL_ROOM_ID,THIEL_PICKS}=await import(moduleUrl('lib/thiel-predictions.ts'));
const {tiersForRoom,TIERS,roomPath}=await import(moduleUrl('lib/room-data.ts'));
const {publishedBoardUrl,personalBoardUrl,shareRows}=await import(moduleUrl('lib/board-share.ts'));
const {comparisonUrl}=await import(moduleUrl('lib/board-comparison.ts'));
const {boardMetadata}=await import(moduleUrl('lib/board-metadata.ts'));
const sqlite=new DatabaseSync(':memory:');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync('drizzle/'+f,'utf8'));
function statement(sql,args=[]){return {bind:(...a)=>statement(sql,a),first:async()=>sqlite.prepare(sql).get(...args)||null,run:async()=>sqlite.prepare(sql).run(...args)};}
const db={prepare:sql=>statement(sql),batch:async statements=>{sqlite.exec('BEGIN');try{const result=await Promise.all(statements.map(s=>s.run()));sqlite.exec('COMMIT');return result;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
let checks=0;function check(value,label){assert.ok(value,label);checks++;console.log('PASS '+label);}
try{
 await ensureThielPredictions(db,1000);
 const room=sqlite.prepare('SELECT * FROM rooms WHERE id=?').get(THIEL_ROOM_ID),moments=sqlite.prepare('SELECT * FROM moments WHERE roomId=? ORDER BY createdAt').all(THIEL_ROOM_ID);
 check(room.status==='open'&&!room.videoId,'the prediction room opens without inventing a lecture livestream');
 check(/predictions/i.test(room.description)&&/not confirmed/i.test(room.description),'persistent room context clearly separates predictions from reported remarks');
 check(moments.length===16&&new Set(moments.map(m=>m.id)).size===16,'all sixteen starter picks are saved with distinct stable IDs');
 check(moments.every(m=>m.status==='approved'&&m.timestamp===0),'starter picks can be ranked immediately without fabricated timestamps');
 check(moments.filter(m=>m.category==='Guest').length===12&&moments.filter(m=>m.category==='Moment').length===4,'public-figure picks and alternative outcomes are included');
 check(THIEL_PICKS.some(p=>p.name==='No individual named')&&THIEL_PICKS.some(p=>p.name==='Someone else'),'the catalog does not presume that a listed person will be named');
 for(const table of ['votes','placements','boards','board_posts','reactions'])check(sqlite.prepare('SELECT COUNT(*) n FROM '+table).get().n===0,'seeding never manufactures '+table);
 check(moments.every(m=>readFileSync('public'+m.image,'utf8').includes('<svg')),'every pick has a local illustrated monogram');
 await ensureThielPredictions(db,5000);check(sqlite.prepare('SELECT COUNT(*) n FROM moments').get().n===16,'repeat visits do not duplicate the catalog');
 sqlite.prepare("UPDATE moments SET title='Admin revised option',status='hidden' WHERE id=?").run(moments[0].id);sqlite.prepare("UPDATE rooms SET title='Admin revised board' WHERE id=?").run(THIEL_ROOM_ID);
 await ensureThielPredictions(db,9000);check(sqlite.prepare('SELECT title FROM rooms WHERE id=?').get(THIEL_ROOM_ID).title==='Admin revised board'&&sqlite.prepare('SELECT status FROM moments WHERE id=?').get(moments[0].id).status==='hidden','later reads preserve admin edits and moderation');
 const predictionTiers=tiersForRoom(THIEL_ROOM_ID);check(predictionTiers[0].label==='Most likely'&&predictionTiers.at(-1).label==='Least likely','prediction tiers explain likelihood instead of show enjoyment');
 check(tiersForRoom('show-example')===TIERS&&TIERS[0].label==='Hall of fame','ordinary stream tier labels stay unchanged');
 const origin='https://example.com',id='0123456789abcdef0123456789abcdef',post={id,roomId:THIEL_ROOM_ID,title:'My Nashville predictions',byline:'Viewer',entries:[{itemId:moments[1].id,tier:'S',score:100}],updatedAt:123};
 const shared=new URL(publishedBoardUrl(origin,THIEL_ROOM_ID,id,123));check(shared.pathname==='/thiel-nashville-2026'&&shared.searchParams.get('board')===id&&shared.searchParams.get('v')==='123','published prediction links retain the dedicated page and snapshot');
 check(personalBoardUrl(origin,THIEL_ROOM_ID).endsWith('/thiel-nashville-2026?view=mine'),'a personal prediction board opens directly in My board');
 const comparison=new URL(comparisonUrl(origin,THIEL_ROOM_ID,'left','right','v1'));check(comparison.pathname==='/thiel-nashville-2026'&&comparison.searchParams.get('against')==='left'&&comparison.searchParams.get('board')==='right','comparison links stay on the dedicated prediction page');
 check(roomPath('room & other')==='/tier-list?room=room%20%26%20other','ordinary room URLs remain encoded and compatible');
 check(shareRows(post,moments)[0].label==='Most likely'&&shareRows(post,moments)[0].moments[0].id===moments[1].id,'shared rankings use prediction labels and the actual saved entries');
 const metadata=boardMetadata({post,room:{id:THIEL_ROOM_ID,title:room.title},moments,version:'v1'},origin);check(metadata.description.includes('speculative picks')&&metadata.alternates.canonical.includes('/thiel-nashville-2026?board='),'crawler metadata identifies speculation and the correct canonical page');
}finally{sqlite.close();}
console.log(`${checks} prediction-board checks passed.`);
