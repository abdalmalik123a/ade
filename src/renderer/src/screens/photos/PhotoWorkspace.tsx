/** إطار ثابت للصور: أدوات يسار وخطوات يمين والإخراج في أسفل المساحة. */
import type { ReactNode, RefObject } from 'react';
export default function PhotoWorkspace({tools,header,options,steps,size,output,viewportRef,children}:{tools:ReactNode;header:ReactNode;options:ReactNode;steps:ReactNode;size:ReactNode;output:ReactNode;viewportRef:RefObject<HTMLDivElement>;children:ReactNode}) {
 return <div className="flex h-[calc(100vh-4rem)] min-h-0" dir="ltr" data-photo-workspace>
  {tools}
  <section className="flex-1 min-w-0 min-h-0 flex flex-col" dir="rtl">
   <header className="shrink-0 px-space-md py-space-xs border-b border-outline-variant bg-surface-container-lowest" data-photo-header>{header}</header>
   {options}
   <div ref={viewportRef} className="flex flex-1 min-h-0 min-w-0 overflow-hidden" data-photo-viewport>{children}</div>
   {output}
  </section>
  <aside className="w-[360px] shrink-0 min-h-0 flex flex-col border-l border-outline-variant bg-surface-container-low" data-photo-sidebar dir="rtl">
   <div className="flex-1 min-h-0 overflow-auto p-space-md space-y-space-sm" aria-label="الصورة والخلفية والإضاءة والقاط" data-photo-adjustments>{steps}</div>
   <div className="shrink-0 p-space-md space-y-space-xs border-t border-outline-variant bg-surface-container-lowest [&_button[data-size-key]]:h-8 [&_button[data-paper]]:h-8" data-photo-size-output>{size}</div>
  </aside>
 </div>;
}
