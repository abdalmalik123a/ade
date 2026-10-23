/**
 * «تحقّق من سلامة الأرشيف»: البصمات والسلسلة وأرقام كلّ سنة — نُقل من `documents.ts` (D81).
 */
import type { Database } from 'better-sqlite3';
import type { ArchiveCheck } from '@shared/api';
import { fingerprint, htmlToText, CHAIN_GENESIS, chainLink } from './documents';

/**
 * «تحقّق من سلامة الأرشيف» (د٥): كل بصمةٍ تُعاد من متن كتابها، والسلسلة من أوّلها،
 * وأرقام كل سنةٍ تُعدّ فلا يغيب منها رقم.
 *
 * والبصمة تُحسب بـ`htmlToText` نفسها التي صدر بها الكتاب — فهي لا تُغيَّر: أيّ تغييرٍ
 * فيها يجعل كتب الأمس «معدَّلة» وهي لم تُمسّ.
 */
/**
 * كتب الإصدار الأوّل (قبل التطوير ١) طُبع عليها رقم المكتب وبصمته ورمز QR في مواضع
 * (`data-slot`)، وحُسبت بصمتها **والمواضع فارغةٌ بعلاماتها** ثم مُلئت. فالنصّ المحفوظ
 * غير النصّ المبصوم — ويُعاد هنا كما بُصم: تُردّ المواضع إلى علاماتها. وما في المواضع
 * لم يدخل البصمة يومها أصلًا، فلا يضعف التحقّق: الرقم نفسه في البصمة وفي السلسلة.
 *
 * وبغير هذا كان كلّ كتابٍ قديمٍ يُعلَن «تغيّر بعد صدوره» عند أوّل تحديثٍ للبرنامج.
 */
const LEGACY_SLOTS: [string, string][] = [
  ['serial', '{{DIWAN_SERIAL}}'],
  ['fingerprint', '{{DIWAN_FINGERPRINT}}'],
  ['qr', ' ']
];

function legacySlots(html: string): string {
  let out = html;
  for (const [slot, mark] of LEGACY_SLOTS) {
    out = out.replace(new RegExp(String.raw`(<([a-z]+)[^>]*data-slot="${slot}"[^>]*>)[\s\S]*?(</\2>)`, 'g'), `$1${mark}$3`);
  }
  return out;
}

export function verifyArchive(db: Database): ArchiveCheck {
  // صفًّا صفًّا (`iterate`) لا الكلّ معًا (البند ٢٣): خمسون ألف كتابٍ بمتونها لا تُحمَّل في الذاكرة — يبقى من كلّ صفٍّ رقمه.
  // ولا يُسأل الاتصال عن غيره أثناء المرور: البصمة والسلسلة حسابٌ لا قاعدة.
  const rows = db
    .prepare(
      `SELECT id, serial, serial_year AS year, serial_seq AS seq, body_html AS body, gregorian_date AS date,
              citizen_name AS name, destination, sha256, chain
       FROM documents ORDER BY id`
    )
    .iterate() as IterableIterator<{
    id: number;
    serial: string;
    year: number;
    seq: number;
    body: string;
    date: string;
    name: string | null;
    destination: string | null;
    sha256: string;
    chain: string | null;
  }>;

  const problems: ArchiveCheck['problems'] = [];
  const years = new Map<number, { prefix: string; seqs: Set<number> }>();
  let prev = CHAIN_GENESIS;
  let checked = 0;
  let head: string | null = null;
  for (const r of rows) {
    const hash = (body: string) =>
      fingerprint({
        serial: r.serial,
        bodyHtml: htmlToText(body),
        gregorianDate: r.date,
        citizenName: r.name ?? '',
        destination: r.destination ?? ''
      });
    if (hash(r.body) !== r.sha256 && hash(legacySlots(r.body)) !== r.sha256) {
      problems.push({ id: r.id, serial: r.serial, kind: 'content', text: 'متنه أو بياناته تغيّرت بعد صدوره — بصمته لا تطابقه' });
    }
    const link = chainLink(prev, r.sha256, r.serial);
    if (r.chain !== link) {
      problems.push({ id: r.id, serial: r.serial, kind: 'chain', text: 'السلسلة مكسورة عنده: كتابٌ قبله حُذف أو أُقحم، أو بُدّلت بصمته' });
    }
    // ما بعد الكسر يُقاس بحلقته المقيَّدة — فيُذكر موضع الكسر مرّةً لا في كل كتابٍ بعده.
    prev = r.chain ?? link;
    checked++;
    head = r.chain ?? null;
    // وبادئة السنة من أوّل كتابٍ فيها — لاسم الرقم الغائب.
    if (!years.has(r.year)) years.set(r.year, { prefix: r.serial.split('/')[0] ?? '', seqs: new Set() });
    years.get(r.year)!.seqs.add(r.seq);
  }

  // الأرقام: لكل سنةٍ من ١ إلى أكبرها، بلا ثقب.
  for (const [year, { prefix, seqs }] of years) {
    // بحلقةٍ لا بـ`Math.max(...)`: النشر يضع كلّ رقمٍ وسيطًا على المكدّس، فيفيض فوق
    // نحو ١٢٥ ألف كتابٍ في السنة (التدقيق المستقل).
    let top = 0;
    for (const n of seqs) if (n > top) top = n;
    for (let n = 1; n <= top; n++) {
      if (!seqs.has(n)) {
        problems.push({ id: null, serial: `${prefix}/${year}/${n}`, kind: 'gap', text: 'رقمٌ غائب من سجلّ الصادر' });
      }
    }
  }

  return { checked, problems, head };
}
