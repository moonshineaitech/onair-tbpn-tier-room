import {redirect} from 'next/navigation';
export default async function Home({searchParams}:{searchParams:Promise<{room?:string}>}){const query=await searchParams;redirect(query.room?'/tier-list?room='+encodeURIComponent(query.room):'/streams');}
