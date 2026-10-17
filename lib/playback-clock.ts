export type PlaybackClock={videoId:string;seconds:number;duration:number;live:boolean;playing:boolean;sampledAt:number};
export const stamp=(seconds:number)=>{const n=Math.max(0,Math.floor(seconds));return `${n>=3600?Math.floor(n/3600)+':':''}${String(Math.floor(n/60)%60).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;};
export function usableClock(clock:PlaybackClock|null,videoId:string|null){return clock&&clock.videoId===videoId&&Date.now()-clock.sampledAt<5000&&Number.isFinite(clock.seconds)&&clock.seconds>=0?clock:null;}
