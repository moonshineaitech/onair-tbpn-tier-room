import {QueueClient} from '@vercel/queue';
import {nextCollectorTick} from './collector-clock.mjs';
export const queue=new QueueClient({region:'iad1'});
const topic='onair-episode-lifecycle';
export async function enqueueCollector(time=Date.now(),immediate=false){
 const scheduledAt=immediate?Math.floor(time/120000)*120000:nextCollectorTick(time),delaySeconds=immediate?0:Math.max(1,Math.ceil((scheduledAt-Date.now())/1000));
 const result=await queue.send(topic,{scheduledAt},{delaySeconds,retentionSeconds:604800,idempotencyKey:'episode-tick:'+scheduledAt});
 return {messageId:result.messageId,scheduledAt};
}
export async function collectEpisode(message){
 if(!Number.isSafeInteger(message?.scheduledAt))return;
 try{
  const backend=new URL('/api/lifecycle',process.env.ONAIR_BACKEND_ORIGIN),response=await fetch(backend,{signal:AbortSignal.timeout(20000),headers:{Accept:'application/json'}}),result=await response.json();
  if(!response.ok||!result.ok)throw new Error('Lifecycle check failed');
  console.log('ON AIR background collection',JSON.stringify({scheduledAt:message.scheduledAt,checkedAt:result.checkedAt,stale:result.stale,created:result.created,ended:result.ended}));
 }catch(error){console.error('ON AIR background collection failed',error.message);}
 // A delayed durable message continues after this function exits. Weekend
 // delays are below the seven-day retention. Retries deduplicate the next tick.
 await enqueueCollector(Date.now()+120000);
}
