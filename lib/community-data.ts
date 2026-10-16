import type {Vote} from './room-data';
export const EMOJI_REACTIONS=[{value:'like',emoji:'♥',label:'Like'},{value:'fire',emoji:'🔥',label:'Fire'},{value:'laugh',emoji:'😂',label:'Funny'},{value:'wow',emoji:'🤯',label:'Mind blown'},{value:'clap',emoji:'👏',label:'Applause'}] as const;
export const REACTION_VALUES=['up','down',...EMOJI_REACTIONS.map(r=>r.value)];
export type ReactionTarget='moment'|'live-rank'|'board'|'ranking';
export type ReactionSummary={counts:Record<string,number>;mine:string[];net:number};
export type Distribution={itemId:string;total:number;average:number;tiers:Record<string,number>;sPercent:number;fPercent:number;polarization:number};
export type PersonalBoard={title:string;byline:string;autoPublish:boolean;publishedId:string|null;updatedAt:number;version:number};
export type Episode={videoId:string;roomId:string;title:string;phase:string;startedAt:number;endedAt:number|null};
export type BoardPost={id:string;roomId:string;title:string;byline:string;entries:Vote[];createdAt:number;updatedAt:number;automatic:boolean;own:boolean;reactions:ReactionSummary};
export const emptyReaction=():ReactionSummary=>({counts:{},mine:[],net:0});
export function summarizeDistribution(rows:{itemId:string;tier:string;count:number;average:number}[]):Distribution[]{
 const items=new Map<string,Distribution>();
 for(const row of rows){let d=items.get(row.itemId);if(!d){d={itemId:row.itemId,total:0,average:0,tiers:{S:0,A:0,B:0,C:0,D:0,F:0},sPercent:0,fPercent:0,polarization:0};items.set(row.itemId,d);}d.tiers[row.tier]=Number(row.count);d.total+=Number(row.count);d.average+=Number(row.average)*Number(row.count);}
 return [...items.values()].map(d=>({...d,average:Math.round(d.average/d.total*10)/10,sPercent:Math.round(d.tiers.S/d.total*100),fPercent:Math.round(d.tiers.F/d.total*100),polarization:Math.round(Math.min(d.tiers.S+d.tiers.A,d.tiers.D+d.tiers.F)/d.total*200)}));
}
