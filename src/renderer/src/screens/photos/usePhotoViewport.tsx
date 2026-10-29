/** يحد حجم معاينة الشاشة فقط؛ مقاسات الملف والصورة والقص لا تتغير. */
import { useEffect, useRef, useState } from 'react';
import type { Size } from '@shared/photoSheet';
export function usePhotoViewport(base: Size) {
 const ref=useRef<HTMLDivElement>(null);
 const [room,setRoom]=useState({w:700,h:500});
 useEffect(()=>{
  const measure=()=>{const el=ref.current;if(!el)return;const next={w:el.clientWidth,h:el.clientHeight};setRoom(old=>old.w===next.w&&old.h===next.h?old:next);};
  measure();const observer=new ResizeObserver(measure);if(ref.current)observer.observe(ref.current);return ()=>observer.disconnect();
 },[]);
 const scale=Math.min(1,Math.max(.1,(room.w-32)/base.w),Math.max(.1,(room.h-64)/base.h));
 return {viewportRef:ref,frame:{w:base.w*scale,h:base.h*scale}};
}
