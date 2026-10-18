export type ChatMessage={id:string;author:string;role:string;body:string;createdAt:number;own:boolean;videoSeconds:number|null;videoId:string|null;momentId:string|null};
export type ChatState={messages:ChatMessage[];muteUntil:number;canModerate:boolean;suggestedName:string;revision:number};
export type ChatSubmission={roomId:string;body:string;author:string;clientId:string;videoSeconds?:number;videoId?:string;momentId:string|null};
export type ChatDelivery={message:ChatMessage;payload:ChatSubmission;status:'sending'|'failed';error?:string};
export function appendChatMessage(messages:ChatMessage[],message:ChatMessage){
 return [...messages.filter(m=>m.id!==message.id),message].sort((a,b)=>a.createdAt-b.createdAt||a.id.localeCompare(b.id)).slice(-100);
}
export function chatDraftKey(owner:string,room:string){return owner?`onair.chat.draft.v1:${owner}:${encodeURIComponent(room)}`:'';}
export function unreadChatCount(previous:ChatMessage[],next:ChatMessage[]){const ids=new Set(previous.map(m=>m.id));return next.filter(m=>!m.own&&!ids.has(m.id)).length;}
export const chatOutboxKey=(owner:string,room:string)=>owner?`onair.chat.outbox.v1:${owner}:${encodeURIComponent(room)}`:'';
export function serializeChatOutbox(deliveries:ChatDelivery[],time=Date.now()){
 return JSON.stringify({version:1,updatedAt:time,entries:deliveries.slice(-10).map(d=>({payload:d.payload,createdAt:d.message.createdAt}))});
}
export function readChatOutbox(raw:string|null,roomId:string,time=Date.now()):ChatDelivery[]{
 try{
  if(!raw||raw.length>40000)return [];const data=JSON.parse(raw);
  if(data?.version!==1||!Number.isFinite(data.updatedAt)||time-data.updatedAt>7*86400000||data.updatedAt>time+60000||!Array.isArray(data.entries)||data.entries.length>10)return [];
  const restored=new Map<string,ChatDelivery>();
  for(const entry of data.entries){
   const p=entry?.payload;
   if(p?.roomId!==roomId||typeof p.clientId!=='string'||!/^[a-f0-9-]{36}$/.test(p.clientId)||typeof p.body!=='string'||!p.body.trim()||p.body.length>500||typeof p.author!=='string'||!p.author.trim()||p.author.length>30||!(p.momentId===null||typeof p.momentId==='string'&&p.momentId.length>0&&p.momentId.length<=100)||!Number.isFinite(entry.createdAt)||entry.createdAt>time+60000||time-entry.createdAt>7*86400000)return [];
   const timed=p.videoSeconds!==undefined;
   if(timed&&(!Number.isInteger(p.videoSeconds)||p.videoSeconds<0||p.videoSeconds>86400||typeof p.videoId!=='string'||p.videoId.length>1500||!/^[-\w]{11}$/.test(p.videoId)&&!p.videoId.startsWith('file:https://')))return [];
   const payload:ChatSubmission={roomId,clientId:p.clientId,body:p.body,author:p.author,momentId:p.momentId,...(timed?{videoSeconds:p.videoSeconds,videoId:p.videoId}:{})};
   restored.set(p.clientId,{payload,message:{id:p.clientId,body:p.body,author:p.author,role:'member',own:true,createdAt:entry.createdAt,videoSeconds:payload.videoSeconds??null,videoId:payload.videoId??null,momentId:p.momentId},status:'failed',error:'Send not confirmed. Retry keeps the original message ID.'});
  }
  return [...restored.values()];
 }catch{return [];}
}
export function acknowledgeChatOutbox(deliveries:ChatDelivery[],messages:ChatMessage[]){
 const confirmed=new Set(messages.filter(m=>m.own).map(m=>m.id));return deliveries.filter(d=>!confirmed.has(d.message.id));
}
