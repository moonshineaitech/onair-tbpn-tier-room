import {shareRows} from '@/lib/board-share';
import type {PublicBoard} from '@/lib/public-board';
export default function BoardSocialImage({board,images}:{board:PublicBoard;images:Record<string,string>}){
 const rows=shareRows(board.post,board.moments),total=rows.reduce((n,r)=>n+r.moments.length,0),shown=rows.map(r=>({...r,shown:total<=24?r.moments:r.moments.slice(0,4)}));
 const raw=shown.map(r=>Math.max(44,6+Math.ceil(r.shown.length/4)*38)),sum=raw.reduce((n,h)=>n+h,0),space=396,scale=Math.min(1,space/sum),extra=Math.max(0,(space-sum)/6);
 return <div style={{width:1200,height:630,display:'flex',position:'relative',background:'#151515',color:'#f5ece4',fontFamily:'sans-serif'}}>
  <div style={{position:'absolute',top:24,left:32,display:'flex',fontSize:17,fontWeight:700,letterSpacing:2,color:'#ff9c9c'}}>ON AIR / THE LIVE TIER ROOM</div>
  <div style={{position:'absolute',top:25,right:32,display:'flex',fontSize:12,letterSpacing:1,color:'#c4b2a5'}}>PUBLISHED SNAPSHOT</div>
  <div style={{position:'absolute',top:53,left:32,width:1136,height:40,display:'flex',fontSize:30,fontWeight:700,overflow:'hidden'}}>{board.post.title}</div>
  <div style={{position:'absolute',top:99,left:32,width:1136,display:'flex',fontSize:17,color:'#c2b3a6'}}>{board.room.title+' · By '+board.post.byline}</div>
  <div style={{position:'absolute',top:136,left:32,width:1136,height:416,display:'flex',flexDirection:'column',gap:4}}>
   {shown.map((row,i)=><div key={row.id} style={{height:raw[i]*scale+extra,width:1136,display:'flex',background:'#252222',borderRadius:4,overflow:'hidden'}}>
    <div style={{width:48,height:'100%',display:'flex',alignItems:'center',justifyContent:'center',background:row.color,color:'#252020',fontSize:25,fontWeight:700}}>{row.id}</div>
    <div style={{width:1036,padding:'6px 10px',display:'flex',flexWrap:'wrap',alignItems:'center',alignContent:'center',gap:6}}>
     {row.shown.length?row.shown.map(m=><div key={m.id} style={{width:244,height:32*scale,display:'flex',alignItems:'center',gap:7,background:'#36302d',borderRadius:3,overflow:'hidden'}}>
      {images[m.id]?<img src={images[m.id]} width={32*scale} height={32*scale} style={{objectFit:'cover'}}/>:<div style={{width:32*scale,height:32*scale,display:'flex',alignItems:'center',justifyContent:'center',background:'#4e4039',color:row.color,fontSize:16,fontWeight:700}}>{m.title.charAt(0).toUpperCase()}</div>}
      <div style={{width:200,height:30*scale,display:'flex',alignItems:'center',fontSize:14*scale,lineHeight:1.2,fontWeight:700,overflow:'hidden'}}>{m.title.length>43?m.title.slice(0,42)+'…':m.title}</div>
     </div>):<div style={{display:'flex',color:'#9b8c81',fontSize:14}}>No segments in this tier</div>}
    </div>
    <div style={{width:52,height:'100%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:row.moments.length>row.shown.length?12:15,color:'#c2afa1'}}>{row.moments.length>row.shown.length?'+'+(row.moments.length-row.shown.length):String(row.moments.length)}</div>
   </div>)}
  </div>
  <div style={{position:'absolute',top:577,left:32,display:'flex',fontSize:16,color:'#c2b3a6'}}>{`${total}/${board.moments.length} segments ranked · ${board.moments.length-total} unranked`}</div>
  <div style={{position:'absolute',top:574,right:32,display:'flex',background:'#ff9c9c',color:'#292020',padding:'7px 13px',borderRadius:4,fontSize:15,fontWeight:700}}>Your turn. Rank this show →</div>
 </div>;
}
