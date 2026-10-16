export const SHOW_SCHEDULE='Weekdays · 11 AM Pacific / 1 PM Central';
export function inShowWindow(time=Date.now()){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(time);
 const values=Object.fromEntries(parts.map(p=>[p.type,p.value]));
 const minutes=Number(values.hour)*60+Number(values.minute);
 return ['Mon','Tue','Wed','Thu','Fri'].includes(values.weekday)&&minutes>=10*60+55&&minutes<=14*60+15;
}
