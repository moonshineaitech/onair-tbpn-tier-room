import {spawn} from 'node:child_process';
import {mkdirSync,readdirSync,writeFileSync} from 'node:fs';
// HTTP suites intentionally run sequentially: some modify global local-QA settings.
const suites=readdirSync('scripts').filter(f=>/^test-.+\.mjs$/.test(f)&&f!=='test-release.mjs').sort();
mkdirSync('.sites-runtime/release-qa',{recursive:true});
const results=[];
for(const suite of suites){
 const start=Date.now();let output='';
 const code=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['scripts/'+suite],{stdio:['ignore','pipe','pipe']});child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);child.on('error',reject);child.on('close',resolve);});
 writeFileSync('.sites-runtime/release-qa/'+suite+'.log',output);
 const checks=[...output.matchAll(/^(\d+) [^\n]*checks passed/gm)].at(-1)?.[1];results.push({suite,code,checks:Number(checks||0),seconds:Math.round((Date.now()-start)/100)/10});
 writeFileSync('.sites-runtime/release-qa/results.json',JSON.stringify({updatedAt:new Date().toISOString(),results},null,2));
 console.log(`${code===0?'PASS':'FAIL'} ${suite}: ${checks||'?'} checks (${results.at(-1).seconds}s)`);
 if(code!==0){console.error(output.slice(-6000));process.exitCode=1;break;}
}
if(results.length===suites.length&&results.every(r=>r.code===0))console.log(`${results.reduce((n,r)=>n+r.checks,0)} checks passed across ${results.length} release suites.`);
