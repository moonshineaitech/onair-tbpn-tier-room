// Parse raster headers before storing uploads. SVG and animated formats are excluded.
export function decodeUpload(value:unknown){
  if(typeof value!=='string'||value.length>2800000)throw new Error('Images must be under 2 MB.');
  const match=value.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if(!match)throw new Error('Choose a PNG, JPEG or WebP image.');
  let bytes:Uint8Array;try{bytes=Uint8Array.from(atob(match[2]),c=>c.charCodeAt(0));}catch{throw new Error('This image could not be read.');}
  return validateImage(bytes,match[1]);
}
export function validateImage(bytes:Uint8Array,contentType:string){
  if(bytes.length>2000000)throw new Error('Images must be under 2 MB.');
  const data=new DataView(bytes.buffer),ascii=(a:number,b:number)=>String.fromCharCode(...bytes.slice(a,b));
  let width=0,height=0;
  if(contentType==='image/png'&&bytes.length>32&&ascii(1,4)==='PNG'&&bytes[0]===137&&ascii(12,16)==='IHDR'){
    width=data.getUint32(16);height=data.getUint32(20);
  }else if(contentType==='image/jpeg'&&bytes[0]===255&&bytes[1]===216){
    let p=2;while(p+9<bytes.length){if(bytes[p++]!==255)break;while(bytes[p]===255)p++;const marker=bytes[p++];if(marker===217||marker===218)break;const length=data.getUint16(p);if(length<2||p+length>bytes.length)break;if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)){height=data.getUint16(p+3);width=data.getUint16(p+5);break;}p+=length;}
  }else if(contentType==='image/webp'&&bytes.length>=30&&ascii(0,4)==='RIFF'&&ascii(8,12)==='WEBP'){
    const kind=ascii(12,16);
    if(kind==='VP8X'){if(bytes[20]&2)throw new Error('Use a still image, without animation.');width=1+bytes[24]+bytes[25]*256+bytes[26]*65536;height=1+bytes[27]+bytes[28]*256+bytes[29]*65536;}
    else if(kind==='VP8 '&&ascii(23,26)==='\x9d\x01\x2a'){width=data.getUint16(26,true)&16383;height=data.getUint16(28,true)&16383;}
    else if(kind==='VP8L'&&bytes[20]===47){const bits=data.getUint32(21,true);width=(bits&16383)+1;height=((bits>>>14)&16383)+1;}
  }
  if(!width||!height)throw new Error('This image could not be read. Please export it as PNG, JPEG or WebP.');
  if(width>4096||height>4096||width*height>16000000)throw new Error('Images must be at most 4096 × 4096 pixels and 16 megapixels.');
  return {bytes,contentType};
}
