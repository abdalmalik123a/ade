/** الأداة المستمرة منفصلة عن التحديد؛ لا يضاف عنصر قبل انتهاء النقر أو السحب. */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CanvasElement, Box } from '@shared/canvas';
import { placementBox, type DesignTool, type Point } from '@shared/design/toolPlacement';
import { elementForTool, TOOL_DEFAULTS } from './toolElements';
export function useDesignTools({ add, pointAt, zoom, geometry, activeSide, view }: {
  add: (el: CanvasElement) => void; pointAt: (e: { clientX: number; clientY: number }) => Point;
  zoom: number; geometry: { pxW: number; pxH: number }; activeSide: string; view: string;
}) {
  const [tool, setTool] = useState<DesignTool>('select');
  const [toolDefaults, setToolDefaults] = useState(TOOL_DEFAULTS);
  const [placement, setPlacement] = useState<Box | null>(null);
  const from = useRef<Point | null>(null);
  const cancelPlacement = useCallback(() => { from.current = null; setPlacement(null); }, []);
  const chooseTool = useCallback((next: DesignTool) => { cancelPlacement(); setTool(next); }, [cancelPlacement]);
  useEffect(() => { cancelPlacement(); setTool('select'); }, [activeSide, view, cancelPlacement]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (e.key !== 'Escape' || e.defaultPrevented || target?.closest('[data-inline-editor],[role="dialog"]')) return;
      if (tool !== 'select') e.preventDefault();
      chooseTool('select');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [chooseTool, tool]);
  const boxAt = (at: Point) => {
    const start = from.current!;
    const dragged = Math.hypot((at.x - start.x) * geometry.pxW * zoom, (at.y - start.y) * geometry.pxH * zoom) >= 4;
    return placementBox(tool === 'select' ? 'text' : tool, start, dragged ? at : undefined);
  };
  const startPlacement = (e: React.MouseEvent) => {
    if (tool === 'select' || e.button !== 0) return;
    e.preventDefault(); e.stopPropagation(); from.current = pointAt(e); setPlacement(placementBox(tool, from.current));
  };
  const movePlacement = (e: React.MouseEvent) => { if (from.current) setPlacement(boxAt(pointAt(e))); };
  const finishPlacement = (e: React.MouseEvent) => {
    if (!from.current || tool === 'select') return;
    const box = boxAt(pointAt(e)); cancelPlacement(); add(elementForTool(tool, box, toolDefaults));
  };
  return { tool, chooseTool, toolDefaults, setToolDefaults, placement, startPlacement, movePlacement, finishPlacement, cancelPlacement };
}
