import TierRoom from '@/components/tier-room';
import {env} from 'cloudflare:workers';
import {publicBoard} from '@/lib/public-board';
import {boardMetadata} from '@/lib/board-metadata';
import {publicComparison,comparisonMetadata} from '@/lib/public-comparison';
import {THIEL_ROOM_ID,THIEL_PATH,THIEL_DESCRIPTION} from '@/lib/thiel-predictions';
import {SITE_ORIGIN} from '@/lib/board-share';
export const dynamic='force-dynamic';
export async function generateMetadata({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const params=await searchParams,id=typeof params.board==='string'?params.board:'';
 if(id){if(params.view==='compare'&&typeof params.against==='string')return comparisonMetadata(env.DB?await publicComparison(env.DB,THIEL_ROOM_ID,params.against,id):null);return boardMetadata(env.DB?await publicBoard(env.DB,id,THIEL_ROOM_ID):null);}
 return {title:'Who will Peter Thiel name? · Nashville 2026 Antichrist tier list',description:THIEL_DESCRIPTION,alternates:{canonical:SITE_ORIGIN+THIEL_PATH},openGraph:{type:'website',title:'Who will Thiel name? · Nashville 2026',description:THIEL_DESCRIPTION,url:SITE_ORIGIN+THIEL_PATH},twitter:{card:'summary',title:'Who will Thiel name? · Nashville 2026',description:THIEL_DESCRIPTION}};
}
export default function ThielPredictionsPage(){return <TierRoom initialRoomId={THIEL_ROOM_ID}/>;}
