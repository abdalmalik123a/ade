/**
 * حزمة المحتوى (خطة Production، ٤٫٣) — قنوات النظام. المنطق في services/contentPack.ts، وحزمة التصاميم المختارة
 * (DESIGNS.md ٣٫٦) في services/design/designPack.ts.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { app, BrowserWindow, ipcMain } from 'electron';
import { dataDir, getDb } from '../db';
import { exportContent, importContent, type ContentPackage } from '../services/contentPack';
import { checkSection, exportSection, isSealedContent } from '../services/contentSection';
import { openSealedPack, type OpenedSeal } from '../services/sealedPack';
import { ownerPublicKeys, requirePaid } from './license';
import { handleChecked } from './checked';
import { oneOf } from '@shared/bridgeGuards';
import { CONTENT_SECTIONS, SEAL_EXT, SECTION_LABEL } from '@shared/sealedPack';
import { exportDesigns, missingAfterImport } from '../services/design/designPack';
import { logAudit } from '../services/documents';
import { isoDate } from '@shared/dates';
import type { BundledPackInfo, ContentCounts, ContentImportResult } from '@shared/api';
import { pickOpenPath, pickSavePath } from './files';

export function packsDir(): string {
  const candidates = [
    join(process.resourcesPath ?? '', 'packs'),
    join(app.getAppPath(), 'resources', 'packs'),
    join(app.getAppPath(), '..', 'resources', 'packs')
  ];
  return candidates.find((p) => existsSync(join(p, 'index.json'))) ?? candidates[1]!;
}

export function registerContentIpc(): void {
  const win = (e: Electron.IpcMainInvokeEvent) => BrowserWindow.fromWebContents(e.sender);
  const storeRoot = () => join(dataDir(), 'store');

  ipcMain.handle('content:export', async (e, designs?: unknown): Promise<(ContentCounts & { path: string }) | null> => {
    const w = win(e);
    if (!w) return null;
    // تصاميمُ مختارة من المعرض (٣٫٦): أرقامٌ صحيحة وحدها، وحدٌّ لما يُحزم مرّة.
    const ids = Array.isArray(designs) ? designs.filter((d): d is number => Number.isInteger(d) && d > 0).slice(0, 500) : [];
    if (ids.length) {
      const target = await pickSavePath(w, {
        title: 'حزمة التصاميم المختارة',
        defaultName: `تصاميم-${isoDate(new Date())}.diwanpack`,
        filterName: 'حزمة محتوى ديوان',
        ext: 'diwanpack'
      });
      if (!target) return null;
      const out = await exportDesigns(target, getDb(), storeRoot(), app.getVersion(), ids);
      logAudit(getDb(), 'content', 'export', `حزمة تصاميم: ${out.templates} تصميمًا`);
      return { ...out, path: target };
    }
    const path = await pickSavePath(w, {
      title: 'حزمة المحتوى — النماذج والترويسات والكليشات',
      defaultName: `diwan-content-${isoDate(new Date())}.diwanpack`,
      filterName: 'حزمة محتوى ديوان',
      ext: 'diwanpack'
    });
    if (!path) return null;
    const counts = await exportContent(path, getDb(), storeRoot(), app.getVersion());
    logAudit(getDb(), 'content', 'export', `${counts.templates} نموذجًا، ${counts.letterheads} ترويسة، ${counts.clips} كليشة`);
    return { ...counts, path };
  });

  handleChecked('content:exportSection', { section: oneOf(CONTENT_SECTIONS) }, async ({ section }, e) => {
    const w = win(e);
    if (!w) return null;
    const path = await pickSavePath(w, {
      title: `تصدير قسم «${SECTION_LABEL[section]}»`, defaultName: `diwan-${section}-${isoDate(new Date())}.diwanpack`,
      filterName: 'حزمة محتوى ديوان', ext: 'diwanpack'
    });
    if (!path) return null;
    const counts = await exportSection(path, getDb(), storeRoot(), app.getVersion(), section);
    logAudit(getDb(), 'content', 'export', `قسم «${SECTION_LABEL[section]}»: ${counts.templates} نموذجًا، ${counts.letterheads} ترويسة، ${counts.clips} كليشة`);
    return { ...counts, path };
  });

  ipcMain.handle('content:import', async (e): Promise<ContentImportResult | null> => {
    const w = win(e);
    if (!w) return null;
    const path = await pickOpenPath(w, {
      title: 'استيراد حزمة محتوى',
      buttonLabel: 'استوردها',
      filterName: 'حزمة محتوى ديوان',
      extensions: ['diwanpack', SEAL_EXT]
    });
    if (!path) return null;
    let opened: OpenedSeal | null = null;
    try {
      let file = path;
      let sealed: ContentImportResult['sealed'];
      let check: ((pkg: ContentPackage) => void) | undefined;
      if (isSealedContent(path)) {
        opened = await openSealedPack(path, ownerPublicKeys('update'), join(dataDir(), 'seal-work'));
        const { head } = opened;
        if (head.content === 'suits') throw new Error('هذه حزمة قاط — استوردها من الصور الشخصية');
        if (head.kind === 'buyer') requirePaid();
        const section = head.content;
        sealed = { title: head.title, content: section, kind: head.kind };
        check = (pkg) => checkSection(pkg, section);
        file = opened.items[0]!.path;
      }
      const { addedIds, ...result } = await importContent(file, getDb(), storeRoot(), join(dataDir(), 'restore-work'), check);
      const a = result.added;
      logAudit(getDb(), 'content', 'import', `${sealed ? `«${sealed.title}»: ` : ''}أُضيف ${a.templates} نموذجًا، ${a.letterheads} ترويسة، ${a.clips} كليشة`);
      // وما غاب في التصاميم المضافة (٣٫٦): خطٌّ ليس في هذا الجهاز، وصورةٌ لم تأتِ.
      return { ...result, path, ...(sealed && { sealed }), ...(addedIds.length && { missing: missingAfterImport(getDb(), storeRoot(), addedIds) }) };
    } finally { opened?.cleanup(); }
  });

  ipcMain.handle('content:bundled', async (): Promise<BundledPackInfo[]> => {
    const dir = packsDir();
    const indexPath = join(dir, 'index.json');
    if (!existsSync(indexPath)) return [];
    let list: (Omit<BundledPackInfo, 'imported'> & { sampleUuid?: string })[] = [];
    try {
      list = JSON.parse(readFileSync(indexPath, 'utf8')) as typeof list;
    } catch {
      return [];
    }
    const db = getDb();
    const isImportedStmt = db.prepare(
      'SELECT 1 FROM templates WHERE uuid = ? UNION ALL SELECT 1 FROM clips WHERE uuid = ?'
    );
    return list.map(({ sampleUuid, ...p }) => {
      let imported = false;
      if (sampleUuid) {
        imported = Boolean(isImportedStmt.get(sampleUuid, sampleUuid));
      }
      return { ...p, imported };
    });
  });

  ipcMain.handle('content:importBundled', async (_e, id: string): Promise<ContentImportResult | null> => {
    if (typeof id !== 'string' || !/^[a-z0-9_-]+$/i.test(id)) throw new Error('معرف الحزمة غير صالح');
    const path = join(packsDir(), `${id}.diwanpack`);
    if (!existsSync(path)) throw new Error(`حزمة المحتوى «${id}» غير موجودة في مجلد الحزم`);
    const { addedIds: _ids, ...result } = await importContent(path, getDb(), storeRoot(), join(dataDir(), 'restore-work'));
    const a = result.added;
    logAudit(getDb(), 'content', 'import', `أُضيف ${a.templates} نموذجًا، ${a.letterheads} ترويسة، ${a.clips} كليشة`);
    return { ...result, path };
  });
}
