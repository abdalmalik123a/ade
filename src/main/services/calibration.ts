/**
 * ورقة معايرة الطابعة — نُقل من `render.ts` (D80).
 */

/**
 * ورقة المعايرة: علامتان على ٢٠ ملم من الحافّة اليمنى والعليا، ومسطرتان بالملّم.
 * يُقاس بعد الطباعة بُعدُ العلامة عن حافّتي الورقة، ويُكتب القياس كما هو —
 * والحساب في `offsetFromMeasure` (shared/calibration.ts) لا في رأس الموظف.
 */
export function calibrationSheet(): string {
  const tick = (i: number, horizontal: boolean) =>
    horizontal
      ? `<div style="position:absolute;right:${i}mm;top:0;width:0.15mm;height:${i % 10 === 0 ? 6 : i % 5 === 0 ? 4 : 2.5}mm;background:#000"></div>`
      : `<div style="position:absolute;top:${i}mm;right:0;height:0.15mm;width:${i % 10 === 0 ? 6 : i % 5 === 0 ? 4 : 2.5}mm;background:#000"></div>`;
  const ticks = Array.from({ length: 61 }, (_, i) => tick(i, true) + tick(i, false)).join('');
  const cross = (right: string, top: string) =>
    `<div style="position:absolute;right:calc(${right} - 6mm);top:${top};width:12mm;height:0.2mm;background:#000"></div>` +
    `<div style="position:absolute;right:${right};top:calc(${top} - 6mm);width:0.2mm;height:12mm;background:#000"></div>`;
  return (
    `<div dir="rtl" style="position:relative;width:210mm;height:297mm;font-family:'IBM Plex Sans Arabic',sans-serif;color:#000">` +
    ticks +
    cross('20mm', '20mm') +
    cross('105mm', '148.5mm') +
    `<div style="position:absolute;right:40mm;left:30mm;top:70mm;font-size:15px;line-height:1.9">` +
    `<div style="font-size:22px;font-weight:700;margin-bottom:6mm">ورقة معايرة الطابعة</div>` +
    `<div>١. قِس بالمسطرة بُعدَ الخطّ العمودي في العلامة العليا عن <b>حافّة الورقة اليمنى</b>. الصحيح ٢٠ ملم.</div>` +
    `<div>٢. وقِس بُعدَ الخطّ الأفقي فيها عن <b>حافّة الورقة العليا</b>. الصحيح ٢٠ ملم أيضًا.</div>` +
    `<div>٣. اكتب القياسين في «معايرة الطابعة» كما هما — والبرنامج يحسب الإزاحة.</div>` +
    `<div style="margin-top:4mm;color:#555">والعلامة الوسطى في منتصف الورقة تمامًا — للتحقّق بعد الضبط.</div>` +
    `</div></div>`
  );
}
