export class RequestError extends Error{constructor(message:string,public status:number){super(message);}}
type Options={body?:unknown;signal?:AbortSignal;timeoutMs?:number;attempts?:number};
// Only reads retry automatically. A failed write may already have reached the server.
export async function requestJSON<T>(url:string,{body,signal,timeoutMs=12000,attempts=2}:Options={}):Promise<T>{
 const writing=body!==undefined,tries=writing?1:Math.max(1,Math.min(attempts,3));
 for(let attempt=0;attempt<tries;attempt++){
  if(signal?.aborted)throw new DOMException('Request cancelled.','AbortError');
  try{
   const timeout=AbortSignal.timeout(timeoutMs),response=await fetch(url,{method:writing?'POST':'GET',cache:'no-store',signal:signal?AbortSignal.any([signal,timeout]):timeout,...(writing?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
   const text=await response.text();let data:T&{error?:string};try{data=JSON.parse(text);}catch{throw new RequestError(response.ok?'The server returned an incomplete response. Please retry.':'The server is temporarily unavailable. Please retry.',response.ok?502:response.status);}
   if(!response.ok)throw new RequestError(data&&typeof data.error==='string'?data.error:'This request could not be completed. Please retry.',response.status);return data;
  }catch(e){
   if(signal?.aborted)throw new DOMException('Request cancelled.','AbortError');
   const transient=!(e instanceof RequestError)||e.status>=500||e.status===408||e.status===429;
   if(attempt+1<tries&&transient){await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>{signal?.removeEventListener('abort',cancel);resolve();},300*(attempt+1));const cancel=()=>{clearTimeout(timer);reject(new DOMException('Request cancelled.','AbortError'));};signal?.addEventListener('abort',cancel,{once:true});});continue;}
   if(e instanceof RequestError)throw e;
   const offline=typeof navigator!=='undefined'&&navigator.onLine===false;throw new RequestError(offline?'You’re offline. Reconnect, then retry. Your saved drafts stay on this device.':writing?'The connection was interrupted. Check whether your change saved before retrying.':'The connection was interrupted. Please retry loading the room.',0);
  }
 }
 throw new RequestError('Please retry loading the room.',0);
}
