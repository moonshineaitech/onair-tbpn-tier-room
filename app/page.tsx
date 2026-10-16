import {redirect} from 'next/navigation';
export default async function Home({searchParams}:{searchParams:Promise<{room?:string}>}){const query=await searchParams;redirect('/tier-list'+(query.room?'?room='+encodeURIComponent(query.room):''));}
