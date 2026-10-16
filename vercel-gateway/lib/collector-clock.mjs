const clock=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
export function nextCollectorTick(after=Date.now()){
 let time=Math.ceil(after/120000)*120000;
 for(let i=0;i<5040;i++,time+=120000){const parts=Object.fromEntries(clock.formatToParts(new Date(time)).map(p=>[p.type,p.value])),minute=Number(parts.hour)*60+Number(parts.minute);if(['Mon','Tue','Wed','Thu','Fri'].includes(parts.weekday)&&minute>=12*60+50&&minute<=20*60)return time;}
 throw new Error('No weekday collector window found.');
}
