/**
 * أثر فرشاة «رمّم» وهي تمرّ (البند ٤٠) — خطٌّ برتقاليٌّ شفيف بعرضها فوق الصورة، يُرى ما سيُملأ قبل رفع الفأرة. نقاطه بإحداثيّات
 * العنصر الذي فوقه، ولا يلتقط الفأرة.
 */
export default function RepairStroke({ points, radius }: { points: { x: number; y: number }[] | null; radius: number }) {
  if (!points?.length) return null;
  const path = points.length === 1 ? `${points[0]!.x},${points[0]!.y} ${points[0]!.x + 0.1},${points[0]!.y}` : points.map((p) => `${p.x},${p.y}`).join(' ');
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" data-repair-stroke="">
      <polyline fill="none" points={path} stroke="rgba(245, 158, 11, 0.5)" strokeLinecap="round" strokeLinejoin="round" strokeWidth={radius * 2} />
    </svg>
  );
}
