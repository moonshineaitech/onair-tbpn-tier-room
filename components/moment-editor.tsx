'use client';
import {useState,useRef} from 'react';
import {ImagePlus,LoaderCircle,Check,Trash2} from 'lucide-react';
import {CATEGORIES,type Moment,type RoomState} from '@/lib/room-data';
type Props={moment:Moment;state:RoomState;save:(body:unknown)=>Promise<unknown>;done:()=>Promise<void>;details:()=>void;timing?:React.ReactNode};
export default function MomentEditor({moment,state,save,done,details,timing}:Props){
  const [image,setImage]=useState<string|null>(null),[removed,setRemoved]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false),[reading,setReading]=useState(false);
  const sequence=useRef(0);
  async function file(file?:File){
    if(!file)return;const request=++sequence.current;setError('');
    if(file.size>2000000||!['image/png','image/jpeg','image/webp'].includes(file.type)){setError('Choose a PNG, JPEG or WebP under 2 MB.');return;}
    setReading(true);
    try{const bitmap=await createImageBitmap(file);const valid=bitmap.width<=4096&&bitmap.height<=4096&&bitmap.width*bitmap.height<=16000000;bitmap.close();if(!valid)throw new Error('Use an image up to 4096 × 4096 pixels and 16 megapixels.');const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('This image could not be read.'));reader.readAsDataURL(file);});if(request===sequence.current){setImage(data);setRemoved(false);}}catch(e){setError((e as Error).message);}finally{if(request===sequence.current)setReading(false);}
  }
  async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);setBusy(true);setError('');try{await save({action:'editMoment',id:moment.id,version:moment.version,title:f.get('title'),description:f.get('description'),category:f.get('category'),image,removeImage:removed});await done();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  const preview=image||(removed?null:moment.image);
  return <><span className="modal-eyebrow">ADMIN · LIVE EDITOR</span><h2>Edit this moment.</h2><p>Saved edits appear on everyone’s board immediately.</p>{error?<div className="alert" role="alert">{error}</div>:null}{timing}<form onSubmit={submit}>
    <label>Moment title<input autoFocus name="title" defaultValue={moment.title} required maxLength={70}/></label>
    <div className="form-row"><label>Category<select name="category" defaultValue={moment.category}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></label></div>
    <label>Context<textarea name="description" defaultValue={moment.description} maxLength={400} rows={3}/></label>
    <div className="editor-image-row">{preview?<img src={preview} alt="Moment image preview"/>:<span className="editor-image-placeholder"><ImagePlus size={27}/></span>}<div><label className="editor-upload"><ImagePlus size={15}/>{reading?'Reading image…':preview?'Replace image':'Upload image'}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy||reading||state.uploads.remaining===0} onChange={e=>void file(e.target.files?.[0])}/></label>{preview?<button type="button" className="text-button" onClick={()=>{sequence.current++;setImage(null);setRemoved(true);setReading(false);}}><Trash2 size={13}/>Remove image</button>:null}</div></div>
    <p className="fine-print">PNG, JPEG or WebP · 2 MB max · 4096 px max per side · 16 MP max. {state.uploads.remaining}/100 site uploads left today. Resets at midnight UTC.</p>
    <div className="editor-actions"><button className="dark-button" disabled={busy||reading}>{busy?<LoaderCircle size={15} className="spin"/>:<Check size={15}/>}Save to live board</button><button type="button" className="text-button" onClick={details}>Scores & details</button></div>
  </form></>;
}
