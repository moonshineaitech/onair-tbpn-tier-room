export const defaultWords=['fuck','shit','bitch','cunt','asshole','nigger','faggot','kike','retard','porn','rape','kill yourself'];
const normalize=(s:string)=>s.normalize('NFKD').replace(/[\u0300-\u036f\u200b-\u200d\ufeff]/g,'').toLowerCase().replace(/[@4]/g,'a').replace(/[13!]/g,m=>m==='3'?'e':'i').replace(/0/g,'o').replace(/\$/g,'s');
export async function assertAllowedText(db:D1Database,text:string,roomId?:string){
 const row=await db.prepare("SELECT value FROM settings WHERE key='blockedWords'").first<{value:string}>();const words=JSON.parse(row?.value||JSON.stringify(defaultWords)) as string[];if(roomId){const local=await db.prepare('SELECT blockedWords FROM room_hosts WHERE roomId=?').bind(roomId).first<{blockedWords:string}>();if(local)words.push(...JSON.parse(local.blockedWords));}const clean=normalize(text);
 if(words.some(w=>{const letters=normalize(w).replace(/[^a-z0-9]/g,'');return !!letters&&new RegExp('(?:^|[^a-z0-9])'+letters.split('').join('[^a-z0-9]*')+'(?:$|[^a-z0-9])').test(clean);}))throw new Error('Please rephrase this. It contains a word blocked by this room.');
}
