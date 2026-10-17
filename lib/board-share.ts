import {TIERS,type Moment} from './room-data';
import type {BoardPost} from './community-data';
export function publishedBoardUrl(origin:string,roomId:string,id:string){return `${origin}/tier-list?room=${encodeURIComponent(roomId)}&board=${encodeURIComponent(id)}`;}
export function shareRows(post:BoardPost,moments:Moment[]){const approved=new Map(moments.map(m=>[m.id,m]));return TIERS.map(t=>({...t,moments:post.entries.filter(e=>e.tier===t.id&&approved.has(e.itemId)).map(e=>approved.get(e.itemId)!)}));}
export function boardCaption(post:BoardPost,moments:Moment[],episode:string){const rows=shareRows(post,moments),top=rows[0].moments.map(m=>m.title),bottom=rows.at(-1)!.moments.map(m=>m.title);return [`My TBPN tiers · ${episode}`,top.length?`S tier: ${top.slice(0,3).join(' · ')}`:'',bottom.length?`F tier: ${bottom.slice(0,3).join(' · ')}`:'',`${rows.reduce((n,r)=>n+r.moments.length,0)}/${moments.length} segments ranked. What would you change?`].filter(Boolean).join('\n');}
