/**
 * أرشيفٌ مضغوط يُكتب ويُقرأ ملفًّا ملفًّا (خطة Production، ٤٫١).
 *
 * كانت النسخة اليدوية تحمل المخزن كلّه في الذاكرة ثم تضغطه (`zipSync`): والمستمسك الممسوح نحو
 * ١١ ميغا، فمكتبٌ بألف مستمسكٍ غيغاتٌ في ذاكرة البرنامج — تسقط النسخة حين يحتاجها المكتب أكثر.
 * فهنا يُكتب كلّ ملفٍّ مارًّا: ترويسته، ثم بياناته من القرص، ثم «واصفٌ» بعده بحجمه وCRC (العلَم ٣)
 * — فلا يُقرأ ملفٌّ مرّتين ولا يُرجع في الكتابة. والفهرس المركزي في آخره بالقيم كلّها.
 *
 * **وZIP64** لما جاوز ٤ غيغا — ملفًّا أو أرشيفًا — أو ٦٥٥٣٥ ملفًّا. وما دونها يُكتب بالصيغة العادية،
 * فيفتحه مستكشف ويندوز وكلّ برنامج.
 *
 * **والقراءة من الفهرس المركزي** لا من ترويسات الملفات: فتقرأ ما كتبه هذا الملف، وما كتبته `zipSync`
 * في النسخ القديمة، بطريقةٍ واحدة. وكلّ ملفٍّ يُفكّ إلى القرص مارًّا ويُطابَق CRC.
 */
import { createReadStream, createWriteStream, rmSync } from 'node:fs';
import { open, stat, type FileHandle } from 'node:fs/promises';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createDeflateRaw, createInflateRaw, crc32 } from 'node:zlib';

const U32 = 0xffffffff;
const U16 = 0xffff;
/** ما بلغه حجمٌ يُكتب ZIP64 — بهامشٍ لما قد يكبر به الضغط (نحو ٠٫٠٣٪ في أسوأه). */
const BIG = U32 - (16 << 20);

/** وجهة الكتابة: مارّةً، بموضعها — ملفٌّ عاديّ، أو مشفِّرٌ يكتب وسمه في آخره (`backup.ts`). */
export type Sink = {
  write(chunk: Uint8Array): Promise<void>;
  readonly position: number;
};

type Written = { name: Buffer; method: number; crc: number; comp: number; size: number; offset: number; time: number; date: number };

function dosTime(d: Date): { time: number; date: number } {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: (Math.max(0, d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
  };
}

/** يحسب CRC ويعدّ البايتات وهو يمرّرها كما هي. */
function tap(): Transform & { crc: number; size: number } {
  const t = new Transform({
    transform(chunk: Buffer, _enc, done) {
      t.crc = crc32(chunk, t.crc);
      t.size += chunk.length;
      done(null, chunk);
    }
  }) as Transform & { crc: number; size: number };
  t.crc = 0;
  t.size = 0;
  return t;
}

export class ZipWriter {
  #sink: Sink;
  #entries: Written[] = [];
  #now = dosTime(new Date());
  #force64: boolean;

  /** `force64`: ZIP64 لكلّ شيء — ليُختبر بلا أربعة غيغات. */
  constructor(sink: Sink, opts: { force64?: boolean } = {}) {
    this.#sink = sink;
    this.#force64 = Boolean(opts.force64);
  }

  /** ملفٌّ من القرص: يُضغط إن طُلب (القاعدة)، ويُخزَّن كما هو إن كان مضغوطًا أصلًا (الصور وPDF). */
  async addFile(name: string, path: string, compress: boolean): Promise<void> {
    const big = (await stat(path)).size >= BIG;
    await this.#add(name, createReadStream(path, { highWaterMark: 1 << 20 }), compress, big || this.#force64);
  }

  async addBuffer(name: string, data: Uint8Array, compress = true): Promise<void> {
    await this.#add(name, Readable.from([Buffer.from(data)]), compress, data.length >= BIG || this.#force64);
  }

  async #add(name: string, source: Readable, compress: boolean, zip64: boolean): Promise<void> {
    const nameBytes = Buffer.from(name, 'utf8');
    const offset = this.#sink.position;
    const method = compress ? 8 : 0;
    // الترويسة قبل البيانات: CRC والحجم صفر، وهما في الواصف بعدها (العلَم ٣)، وUTF-8 للأسماء (١١).
    const extra = zip64 ? zip64Extra([0n, 0n]) : Buffer.alloc(0);
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0);
    head.writeUInt16LE(zip64 ? 45 : 20, 4);
    head.writeUInt16LE(0x0808, 6);
    head.writeUInt16LE(method, 8);
    head.writeUInt16LE(this.#now.time, 10);
    head.writeUInt16LE(this.#now.date, 12);
    head.writeUInt32LE(0, 14);
    head.writeUInt32LE(zip64 ? U32 : 0, 18);
    head.writeUInt32LE(zip64 ? U32 : 0, 22);
    head.writeUInt16LE(nameBytes.length, 26);
    head.writeUInt16LE(extra.length, 28);
    await this.#sink.write(Buffer.concat([head, nameBytes, extra]));

    const counter = tap();
    let comp = 0;
    const sink = this.#sink;
    const stages: (Readable | Transform)[] = [source, counter];
    if (compress) stages.push(createDeflateRaw({ level: 6 }));
    await pipeline(...(stages as [Readable, Transform]), async function (data: AsyncIterable<Buffer>) {
      for await (const chunk of data) {
        comp += chunk.length;
        await sink.write(chunk);
      }
    });

    const desc = Buffer.alloc(zip64 ? 24 : 16);
    desc.writeUInt32LE(0x08074b50, 0);
    desc.writeUInt32LE(counter.crc >>> 0, 4);
    if (zip64) {
      desc.writeBigUInt64LE(BigInt(comp), 8);
      desc.writeBigUInt64LE(BigInt(counter.size), 16);
    } else {
      if (comp > U32 || counter.size > U32) throw new Error(`«${name}» كبر بالضغط فوق حدّ الصيغة`);
      desc.writeUInt32LE(comp, 8);
      desc.writeUInt32LE(counter.size, 12);
    }
    await this.#sink.write(desc);
    this.#entries.push({ name: nameBytes, method, crc: counter.crc >>> 0, comp, size: counter.size, offset, ...this.#now });
  }

  /** الفهرس المركزي، وسجلّ النهاية — وZIP64 لما يحتاجه. */
  async finish(): Promise<void> {
    const cdStart = this.#sink.position;
    for (const e of this.#entries) {
      const f = this.#force64;
      const wideSize = f || e.size >= U32;
      const wideComp = f || e.comp >= U32;
      const wideOffset = f || e.offset >= U32;
      const wide: bigint[] = [];
      if (wideSize) wide.push(BigInt(e.size));
      if (wideComp) wide.push(BigInt(e.comp));
      if (wideOffset) wide.push(BigInt(e.offset));
      const extra = wide.length ? zip64Extra(wide) : Buffer.alloc(0);
      const h = Buffer.alloc(46);
      h.writeUInt32LE(0x02014b50, 0);
      h.writeUInt16LE(45, 4);
      h.writeUInt16LE(wide.length ? 45 : 20, 6);
      h.writeUInt16LE(0x0808, 8);
      h.writeUInt16LE(e.method, 10);
      h.writeUInt16LE(e.time, 12);
      h.writeUInt16LE(e.date, 14);
      h.writeUInt32LE(e.crc, 16);
      h.writeUInt32LE(wideComp ? U32 : e.comp, 20);
      h.writeUInt32LE(wideSize ? U32 : e.size, 24);
      h.writeUInt16LE(e.name.length, 28);
      h.writeUInt16LE(extra.length, 30);
      h.writeUInt32LE(wideOffset ? U32 : e.offset, 42);
      await this.#sink.write(Buffer.concat([h, e.name, extra]));
    }
    const cdSize = this.#sink.position - cdStart;
    const count = this.#entries.length;
    const needs64 = this.#force64 || count >= U16 || cdStart >= U32 || cdSize >= U32;
    if (needs64) {
      const at = this.#sink.position;
      const rec = Buffer.alloc(56);
      rec.writeUInt32LE(0x06064b50, 0);
      rec.writeBigUInt64LE(44n, 4);
      rec.writeUInt16LE(45, 12);
      rec.writeUInt16LE(45, 14);
      rec.writeBigUInt64LE(BigInt(count), 24);
      rec.writeBigUInt64LE(BigInt(count), 32);
      rec.writeBigUInt64LE(BigInt(cdSize), 40);
      rec.writeBigUInt64LE(BigInt(cdStart), 48);
      const loc = Buffer.alloc(20);
      loc.writeUInt32LE(0x07064b50, 0);
      loc.writeBigUInt64LE(BigInt(at), 8);
      loc.writeUInt32LE(1, 16);
      await this.#sink.write(Buffer.concat([rec, loc]));
    }
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    // في ZIP64 تُكتب حقول السجلّ القديم «أقصى قيمة» فيُقرأ الحجم والموضع من سجلّ ZIP64.
    end.writeUInt16LE(needs64 ? U16 : count, 8);
    end.writeUInt16LE(needs64 ? U16 : count, 10);
    end.writeUInt32LE(needs64 ? U32 : cdSize, 12);
    end.writeUInt32LE(needs64 ? U32 : cdStart, 16);
    await this.#sink.write(end);
  }
}

function zip64Extra(values: bigint[]): Buffer {
  const b = Buffer.alloc(4 + values.length * 8);
  b.writeUInt16LE(0x0001, 0);
  b.writeUInt16LE(values.length * 8, 2);
  values.forEach((v, i) => b.writeBigUInt64LE(v, 4 + i * 8));
  return b;
}

/** وجهةٌ إلى ملف — بمخزنٍ صغير فلا تُكتب القطع الصغيرة واحدةً واحدة. */
export async function fileSink(path: string, start = 0): Promise<Sink & { handle: FileHandle; close(): Promise<void> }> {
  const handle = await open(path, start ? 'r+' : 'w');
  let position = start;
  let pending: Buffer[] = [];
  let pendingSize = 0;
  const flush = async () => {
    if (!pendingSize) return;
    const buf = Buffer.concat(pending, pendingSize);
    pending = [];
    pendingSize = 0;
    let done = 0;
    while (done < buf.length) {
      const { bytesWritten } = await handle.write(buf, done, buf.length - done, position - buf.length + done);
      done += bytesWritten;
    }
  };
  return {
    handle,
    get position() {
      return position;
    },
    async write(chunk) {
      pending.push(Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength));
      pendingSize += chunk.byteLength;
      position += chunk.byteLength;
      if (pendingSize >= 1 << 20) await flush();
    },
    async close() {
      await flush();
      await handle.sync();
      await handle.close();
    }
  };
}

// ── القراءة ─────────────────────────────────────────────────────────────

export type ZipEntry = { name: string; method: number; crc: number; comp: number; size: number; offset: number };

/** فهرس الأرشيف — ويُرفض ما ليس أرشيفًا قبل أن يُقرأ منه شيء. */
export async function readZipIndex(path: string): Promise<ZipEntry[]> {
  const handle = await open(path, 'r');
  try {
    const { size } = await handle.stat();
    const tailLen = Math.min(size, 22 + 0xffff + 20);
    const tail = Buffer.alloc(tailLen);
    await handle.read(tail, 0, tailLen, size - tailLen);
    let eocd = -1;
    for (let i = tailLen - 22; i >= 0; i--) {
      if (tail.readUInt32LE(i) === 0x06054b50) {
        eocd = i;
        break;
      }
    }
    if (eocd < 0) throw new Error('ليس أرشيفًا مضغوطًا');
    let count = tail.readUInt16LE(eocd + 10);
    let cdSize = tail.readUInt32LE(eocd + 12);
    let cdStart = tail.readUInt32LE(eocd + 16);
    if (count === U16 || cdSize === U32 || cdStart === U32) {
      const loc = eocd - 20;
      if (loc < 0 || tail.readUInt32LE(loc) !== 0x07064b50) throw new Error('أرشيفٌ معطوب');
      const rec = Buffer.alloc(56);
      await handle.read(rec, 0, 56, Number(tail.readBigUInt64LE(loc + 8)));
      if (rec.readUInt32LE(0) !== 0x06064b50) throw new Error('أرشيفٌ معطوب');
      count = Number(rec.readBigUInt64LE(32));
      cdSize = Number(rec.readBigUInt64LE(40));
      cdStart = Number(rec.readBigUInt64LE(48));
    }
    const cd = Buffer.alloc(cdSize);
    await handle.read(cd, 0, cdSize, cdStart);
    const out: ZipEntry[] = [];
    let at = 0;
    for (let n = 0; n < count; n++) {
      if (cd.readUInt32LE(at) !== 0x02014b50) throw new Error('أرشيفٌ معطوب');
      const method = cd.readUInt16LE(at + 10);
      const crc = cd.readUInt32LE(at + 16);
      let comp = cd.readUInt32LE(at + 20);
      let usize = cd.readUInt32LE(at + 24);
      const nameLen = cd.readUInt16LE(at + 28);
      const extraLen = cd.readUInt16LE(at + 30);
      const commentLen = cd.readUInt16LE(at + 32);
      let offset = cd.readUInt32LE(at + 42);
      const name = cd.toString('utf8', at + 46, at + 46 + nameLen);
      // حقول ZIP64 بترتيبها: الحجم، ثم المضغوط، ثم الموضع — ما كان منها 0xFFFFFFFF وحده.
      let x = at + 46 + nameLen;
      const xEnd = x + extraLen;
      while (x + 4 <= xEnd) {
        const id = cd.readUInt16LE(x);
        const len = cd.readUInt16LE(x + 2);
        if (id === 0x0001) {
          let p = x + 4;
          if (usize === U32) {
            usize = Number(cd.readBigUInt64LE(p));
            p += 8;
          }
          if (comp === U32) {
            comp = Number(cd.readBigUInt64LE(p));
            p += 8;
          }
          if (offset === U32) offset = Number(cd.readBigUInt64LE(p));
        }
        x += 4 + len;
      }
      out.push({ name, method, crc, comp, size: usize, offset });
      at = xEnd + commentLen;
    }
    return out;
  } finally {
    await handle.close();
  }
}

/** يفكّ ملفًّا من الأرشيف إلى القرص مارًّا — ويُرفض إن لم يطابق CRC: نسخةٌ معطوبة لا تُسترجع صامتة. */
export async function extractEntry(path: string, entry: ZipEntry, dest: string): Promise<void> {
  if (entry.method !== 0 && entry.method !== 8) throw new Error(`«${entry.name}» بضغطٍ لا يعرفه البرنامج`);
  const handle = await open(path, 'r');
  let start: number;
  try {
    const head = Buffer.alloc(30);
    await handle.read(head, 0, 30, entry.offset);
    if (head.readUInt32LE(0) !== 0x04034b50) throw new Error('أرشيفٌ معطوب');
    start = entry.offset + 30 + head.readUInt16LE(26) + head.readUInt16LE(28);
  } finally {
    await handle.close();
  }
  const counter = tap();
  const stages: (Readable | Transform)[] = [];
  stages.push(
    entry.comp > 0 ? createReadStream(path, { start, end: start + entry.comp - 1, highWaterMark: 1 << 20 }) : Readable.from([])
  );
  if (entry.method === 8) stages.push(createInflateRaw());
  stages.push(counter);
  try {
    await pipeline(...(stages as [Readable, Transform]), createWriteStream(dest));
    if ((counter.crc >>> 0) !== entry.crc || counter.size !== entry.size) throw new Error(`«${entry.name}» معطوبٌ في الأرشيف`);
  } catch (e) {
    // ما فُكّ نصفه أو فُكّ معطوبًا لا يبقى على القرص كأنه سليم.
    rmSync(dest, { force: true });
    throw e;
  }
}

/** مسارٌ داخل الأرشيف يُكتب تحت مجلّده — لا `..` ولا مسارٌ مطلق ولا حرف قرص. */
export function safeInnerPath(rel: string): boolean {
  return rel.length > 0 && !rel.split(/[\\/]/).some((part) => part === '..' || part === '') && !/^[a-zA-Z]:/.test(rel) && !rel.startsWith('/');
}
