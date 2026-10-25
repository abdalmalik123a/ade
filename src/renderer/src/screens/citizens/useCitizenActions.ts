/**
 * أفعال ملفّ الزبون ومستمسكاته (تقسيم شاشة الزبائن بعد ١٫٧٫٠) — منقولةٌ من `CitizensScreen` كما هي: «افحص الماسح»، والمسح
 * والاستيراد، والقراءة وظهر البطاقة، وما بعد تعديل الملفّ وحذفه — وكلٌّ بانشغاله (`withBusy`). والحال كلّها في الشاشة.
 */
import type { Dispatch, SetStateAction } from 'react';
import { errorText } from '../../lib/errors';
import type { Attachment, ScannerDevice, CitizenSummary, CitizenDetail } from '@shared/api';
import type { MrzResult } from '@shared/mrz';

export function useCitizenActions(
  ctx: {
    setBusy: Dispatch<SetStateAction<string | null>>;
    say: (text: string, tone?: 'ok' | 'warn') => void;
    setScanners: Dispatch<SetStateAction<ScannerDevice[] | null>>;
    reloadList: () => Promise<CitizenSummary[]>;
    reloadDetail: (id: number | null) => Promise<void>;
    onChanged: (() => void) | undefined;
    detail: CitizenDetail | null;
    setConfirmDelete: Dispatch<SetStateAction<{ usage: number; } | null>>;
    setSelectedId: Dispatch<SetStateAction<number | null>>;
    setOcrPanel: Dispatch<SetStateAction<{ attachment: Attachment; text: string; confidence: number | null; mrz?: MrzResult | null; } | null>>;
  }
) {
  const { setBusy, say, setScanners, reloadList, reloadDetail, onChanged, detail, setConfirmDelete, setSelectedId, setOcrPanel } = ctx;

  async function withBusy<T>(key: string, fn: () => Promise<T>): Promise<T | null> {
    setBusy(key);
    try {
      return await fn();
    } catch (e) {
      say(errorText(e, 'تعذّر تنفيذ العملية'), 'warn');
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function checkScanner() {
    const found = await withBusy('scanner', () => window.diwan.scanner.list());
    if (found === null) return;
    setScanners(found);
    say(
      found.length === 0
        ? 'لا يوجد ماسح ضوئي موصول بهذا الجهاز'
        : `الماسح متصل: ${found.map((d) => d.name).join('، ')}`,
      found.length === 0 ? 'warn' : 'ok'
    );
  }

  async function afterCitizenChange(id: number | null) {
    await reloadList();
    await reloadDetail(id);
    onChanged?.();
  }

  async function removeCitizen() {
    if (!detail) return;
    await window.diwan.citizens.delete(detail.id);
    setConfirmDelete(null);
    const list = await reloadList();
    const next = list[0]?.id ?? null;
    setSelectedId(next);
    await reloadDetail(next);
    onChanged?.();
    say('حُذف ملف المواطن');
  }

  async function scan(docType: string) {
    if (!detail) return;
    // ٣٠٠ نقطة: تكفي الاستنساخ ١:١ والقراءة. و٦٠٠ على ماسحٍ حقيقي ٤٣ ثانية و٤٣ ميغا للمستمسك.
    const created = await withBusy('scan', () =>
      window.diwan.attachments.scan(detail.id, docType, 300)
    );
    if (created) {
      await reloadDetail(detail.id);
      await reloadList();
      say(`اكتمل المسح الضوئي بدقة ${created.dpi ?? 300}`);
    }
  }

  async function importAttachment(docType: string) {
    if (!detail) return;
    const created = await withBusy('import', () =>
      window.diwan.attachments.importFile(detail.id, docType)
    );
    if (created) {
      await reloadDetail(detail.id);
      await reloadList();
      say('أُدرج المستمسك');
    }
  }

  async function runOcr(a: Attachment) {
    const result = await withBusy(`ocr-${a.id}`, () => window.diwan.attachments.ocr(a.id));
    if (result) {
      await reloadDetail(detail?.id ?? null);
      setOcrPanel({ attachment: a, text: result.text, confidence: result.confidence });
      say(`استُخرج النصّ بدقة ${Math.round(result.confidence * 100)}%`);
    }
  }

  /** ظهر البطاقة بقارئه الخاصّ (تعميق الموجود ٨): يجد سطورها في الصورة ويقرؤها ويتحقّق. */
  async function readBack(a: Attachment) {
    const read = await withBusy(`mrz-${a.id}`, () => window.diwan.attachments.readMrz(a.id));
    if (!read) return;
    if (!read.result) {
      say('لم تُوجد سطور MRZ في الصورة — امسح ظهر البطاقة (ثلاثة أسطر) أو صفحة الجواز (سطران)', 'warn');
      return;
    }
    setOcrPanel({ attachment: a, text: read.lines.join('\n'), confidence: null, mrz: read.result });
    // والجواز (S41، D181) يُقال باسمه.
    const what = read.result.format === 'TD3' ? ['قُرئت صفحة الجواز وتحقّقت أرقامها', 'قُرئت صفحة الجواز، وفي بعض أرقامها خطأ قراءة'] : ['قُرئ ظهر البطاقة وتحقّقت أرقامه', 'قُرئ ظهر البطاقة، وفي بعض أرقامه خطأ قراءة'];
    say(read.result.valid ? what[0]! : what[1]!, read.result.valid ? 'ok' : 'warn');
  }

  return { checkScanner, withBusy, removeCitizen, importAttachment, scan, runOcr, readBack, afterCitizenChange };
}
