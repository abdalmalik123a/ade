/**
 * الطلب وملفّ الجهة يملآن التصميم (DESIGNS.md ٣٫٥): الطلب يفتح تصميمه — أو المعرضَ لجهته فيُختار — وقائمته في الدفعة،
 * وجهته تملأ ما يُعرف من حقوله (اسمها وعنوانها وهاتفها ومديريتها ومديرها وصفته، والعام الدراسي)، وكمّيته نسخه إن لم تكن
 * قائمة. و«طقم الجهة ← طبّق» يملأ بالقاعدة نفسها.
 *
 * **وما كتبه الموظّف بيده لا يُطمس**، وما ملأته جهةٌ سابقة يُبدَّل (`applySchool` نفسه في الشبّاك) — فالقيم ليست في سجلّ
 * التراجع، ولا يضيع منها شيءٌ بضغطة.
 */
import { useEffect, useRef, useState } from 'react';
import { toIndic } from '@shared/arabic';
import type { Doc } from '@shared/doc';
import type { LearnedGenders } from '@shared/gender';
import type { Client } from '@shared/orders';
import { applySchool } from '@shared/schoolFile';
import { clientValues, filledWords } from '@shared/design/fillFrom';
import type { GalleryPick } from '../Gallery';

type Inputs = {
  doc: Doc;
  values: Record<string, string>;
  setValues: (v: Record<string, string>) => void;
  setCopies: (n: number) => void;
  say: (text: string, tone?: 'ok' | 'warn') => void;
  learned: LearnedGenders;
  /** قائمة الطلب في لوح الدفعة. */
  seedBatch: (text: string) => void;
  pickFromGallery: (pick: GalleryPick) => void;
};

/** ما جاء به الطلب: جهته وقائمته وكمّيته. */
export type OrderSeed = { clientId?: number; batchText?: string | null; quantity?: number | null };

export function useOrderFill(i: Inputs) {
  /** ما ملأته آخر جهة — فتبديلها يبدّله ولا يُبقي عنوان الأولى. */
  const filled = useRef<Record<string, string>>({});
  /** جهةٌ تنتظر تصميمها: الطلب يفتح تصميمه ثمّ يملؤه، فتُملأ حقول التصميم الجديد لا السابق. */
  const [pending, setPending] = useState<{ client: Client; note: string } | null>(null);
  /** طلبٌ فُتح المعرضُ له بلا تصميم: قائمته وكمّيته للتصميم الذي يُختار أوّلًا. */
  const [galleryOrder, setGalleryOrder] = useState<OrderSeed | null>(null);

  /** يملأ الآن بحقول التصميم المفتوح — ويعيد ما مُلئ. */
  const fillNow = (client: Client | null): Record<string, string> => {
    const next = clientValues(
      i.doc.fields.map((f) => f.key),
      client,
      new Date(),
      i.learned
    );
    const out = applySchool(i.values, next, filled.current);
    filled.current = out.filled;
    i.setValues(out.values);
    return out.filled;
  };

  useEffect(() => {
    if (!pending) return;
    const now = fillNow(pending.client);
    const fromFile = Object.keys(now).length ? `من ملفّ «${pending.client.name}»: ${filledWords(now)} — وما تكتبه بيدك لا يُطمس` : '';
    const text = [fromFile, pending.note].filter(Boolean).join('، ');
    if (text) i.say(text);
    setPending(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  /** جهةٌ برقمها (من الطلب) أو بملفّها (من المعرض) — تُملأ حين يُفتح التصميم؛ و`note` ما يُقال معها. */
  const fillFor = async (client: Client | number | undefined, note: string) => {
    const c = typeof client === 'number' ? ((await window.diwan.clients.list()).find((x) => x.id === client) ?? null) : (client ?? null);
    if (c) setPending({ client: c, note });
    else if (note) i.say(note);
  };

  /** نسخٌ من كمّية طلب — تعود واحدةً في التصميم التالي إن لم يكن من طلب، فلا يُطبع تصميمٌ آخر أربعين مرّة. */
  const orderCopies = useRef(false);
  /** «٥٠٠ نسخة من الطلب» — كمّية الطلب نسخُ تصميمٍ بلا قائمة (ومراجعة الأوراق تقول عددها قبل الطباعة). */
  const takeQuantity = (seed: OrderSeed | null): string => {
    if (!seed?.quantity || seed.quantity < 2 || seed.batchText?.trim()) {
      leaveOrder();
      return '';
    }
    const n = Math.min(seed.quantity, 2000);
    i.setCopies(n);
    orderCopies.current = true;
    return `${toIndic(n)} نسخة من الطلب`;
  };
  /** تصميمٌ ليس من الطلب: نسخه واحدة إن كانت من كمّيته. */
  const leaveOrder = () => {
    if (orderCopies.current) i.setCopies(1);
    orderCopies.current = false;
  };

  /** الطلب فتح تصميمه المحفوظ: قائمته في الدفعة، وجهته تملأ حقوله، وكمّيته نسخه. */
  const openedFromOrder = (seed: OrderSeed) => {
    i.seedBatch(seed.batchText ?? '');
    void fillFor(seed.clientId, takeQuantity(seed));
  };

  /** من المعرض: التصميم المختار لطلبٍ يأخذ قائمته وكمّيته مرّةً، ولجهةٍ يُملأ من ملفّها. */
  const pickFromGallery = (pick: GalleryPick) => {
    i.pickFromGallery(pick);
    const seed = galleryOrder;
    setGalleryOrder(null);
    if (seed?.batchText?.trim()) i.seedBatch(seed.batchText);
    filled.current = {};
    void fillFor(pick.client ?? undefined, takeQuantity(seed));
  };

  return { fillNow, openedFromOrder, galleryForOrder: setGalleryOrder, pickFromGallery, leaveOrder };
}
