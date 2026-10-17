export type ChatMessage={id:string;author:string;role:string;body:string;createdAt:number;own:boolean;videoSeconds:number|null;videoId:string|null;momentId:string|null};
export type ChatState={messages:ChatMessage[];muteUntil:number;canModerate:boolean;suggestedName:string;revision:number};
export type ChatSubmission={roomId:string;body:string;author:string;clientId:string;videoSeconds?:number;videoId?:string;momentId:string|null};
export type ChatDelivery={message:ChatMessage;payload:ChatSubmission;status:'sending'|'failed';error?:string};
export function appendChatMessage(messages:ChatMessage[],message:ChatMessage){
 return [...messages.filter(m=>m.id!==message.id),message].sort((a,b)=>a.createdAt-b.createdAt||a.id.localeCompare(b.id)).slice(-100);
}
export function chatDraftKey(owner:string,room:string){return owner?`onair.chat.draft.v1:${owner}:${encodeURIComponent(room)}`:'';}
export function unreadChatCount(previous:ChatMessage[],next:ChatMessage[]){const ids=new Set(previous.map(m=>m.id));return next.filter(m=>!m.own&&!ids.has(m.id)).length;}
