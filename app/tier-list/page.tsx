import TierRoom from '@/components/tier-room';
import {env} from 'cloudflare:workers';
import {publicBoard} from '@/lib/public-board';
import {boardMetadata} from '@/lib/board-metadata';
type PageProps={searchParams:Promise<Record<string,string|string[]|undefined>>};
export const dynamic='force-dynamic';
export async function generateMetadata({searchParams}:PageProps){
 const params=await searchParams,id=typeof params.board==='string'?params.board:'';if(!id)return {};
 const room=typeof params.room==='string'?params.room:'';
 return boardMetadata(env.DB?await publicBoard(env.DB,id,room):null);
}
export default function TierListPage(){return <TierRoom/>;}
