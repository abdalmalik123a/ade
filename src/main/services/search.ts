/**
 * البحث الشامل الموحّد — ما سوى الكتب: المواطنون والنماذج ونصّ المستمسكات.
 *
 * الكتب تُسأل في الأرشيف نفسه بمدّتها (`listDocuments`)؛ وهذا ما يظهر بجانبها حين
 * يُكتب في البحث الشامل: «أحمد» ملفُّه في السجلّ، و«تأييد» نموذجه في المكتبة،
 * و«بطاقة سكن» مستمسكٌ ممسوح قُرئ نصّه. كلٌّ من فهرسه (services/searchIndex.ts)،
 * وإن تعذّر الفهرس فمسحٌ متساهل.
 */
import type { Database } from 'better-sqlite3';
import { normalizeFold } from '@shared/arabic';
import type { SearchHits } from '@shared/api';
import { listCitizens } from './citizens';
import { matchIds } from './searchIndex';

/** سطرٌ من نصّ المستمسك حول أوّل كلمةٍ من السؤال — ليُعرف لماذا ظهر. */
function snippet(text: string, query: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  const words = normalizeFold(query).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const folded = normalizeFold(flat);
  const at = words.map((w) => folded.indexOf(w)).filter((i) => i >= 0).sort((a, b) => a - b)[0];
  // الطيّ لا يغيّر الطول إلا بحذف التشكيل؛ فالموضع تقريبٌ يكفي لسطر.
  const start = Math.max(0, (at ?? 0) - 30);
  return (start > 0 ? '…' : '') + flat.slice(start, start + 90) + (flat.length > start + 90 ? '…' : '');
}

export function searchOthers(db: Database, query: string, limit = 12): SearchHits {
  const q = query.trim();
  const empty: SearchHits = { query: q, citizens: [], templates: [], attachments: [] };
  if (!q) return empty;

  const citizens = listCitizens(db, { query: q, limit });

  const templateIds = matchIds(db, 'templates', q);
  const templates = (
    templateIds === null
      ? db
          .prepare(
            `SELECT id, title, category, issuing FROM templates
             WHERE is_active = 1 AND (title LIKE ? OR body_html LIKE ?) ORDER BY print_count DESC LIMIT ?`
          )
          .all(`%${q}%`, `%${q}%`, limit)
      : db
          .prepare(
            `SELECT id, title, category, issuing FROM templates
             WHERE is_active = 1 AND id IN (SELECT value FROM json_each(?)) ORDER BY print_count DESC, title LIMIT ?`
          )
          .all(JSON.stringify(templateIds), limit)
  ) as SearchHits['templates'];

  const attachmentIds = matchIds(db, 'attachments', q);
  const rows = (
    attachmentIds === null
      ? db
          .prepare(
            `SELECT a.id, a.citizen_id AS citizenId, c.full_name AS citizenName, a.doc_type AS docType, a.ocr_text AS text
             FROM attachments a JOIN citizens c ON c.id = a.citizen_id
             WHERE a.ocr_text LIKE ? OR a.doc_type LIKE ? ORDER BY a.id DESC LIMIT ?`
          )
          .all(`%${q}%`, `%${q}%`, limit)
      : db
          .prepare(
            `SELECT a.id, a.citizen_id AS citizenId, c.full_name AS citizenName, a.doc_type AS docType, a.ocr_text AS text
             FROM attachments a JOIN citizens c ON c.id = a.citizen_id
             WHERE a.id IN (SELECT value FROM json_each(?)) ORDER BY a.id DESC LIMIT ?`
          )
          .all(JSON.stringify(attachmentIds), limit)
  ) as { id: number; citizenId: number; citizenName: string; docType: string; text: string | null }[];

  return {
    query: q,
    citizens,
    templates,
    attachments: rows.map((r) => ({
      id: r.id,
      citizenId: r.citizenId,
      citizenName: r.citizenName,
      docType: r.docType,
      snippet: r.text ? snippet(r.text, q) : ''
    }))
  };
}
