import { describe, expect, it } from 'vitest';
import { freshDb } from './helpers';
import { addAttachment, deleteAttachment, deleteCitizen, ensureSearchColumn, getCitizen, saveCitizen } from '../src/main/services/citizens';
import { storeFileInUse, unreferenced } from '../src/main/services/storeRefs';
import type { CitizenInput } from '../src/shared/api';

/**
 * المخزن باسم البصمة: بطاقة سكن العائلة مستمسكٌ للأب وللأمّ بملفٍّ واحد. فلا يُحذف الملفّ
 * من القرص ما بقي له مرجع — وكان حذف مستمسك الأب يُتلف مستمسك الأمّ (خطة Production، ١٫١).
 */

function db() {
  const d = freshDb();
  ensureSearchColumn(d);
  return d;
}

function person(name: string, photoPath: string | null = null): CitizenInput {
  return {
    id: null, fullName: name, nationalId: null, jobTitle: null, workplace: null, employeeCode: null,
    serviceStatus: null, birthDate: null, birthPlace: null, enrollmentDept: null, address: null,
    housingCardNo: null, landmark: null, phone: null, photoPath, category: null, notes: null, verified: false
  };
}

const card = (d: ReturnType<typeof db>, citizenId: number, filePath: string) =>
  addAttachment(d, { citizenId, docType: 'بطاقة السكن', filePath, fileFormat: 'PNG', dpi: null, sha256: null });

describe('مراجع ملفّات المخزن', () => {
  it('المستمسك المشترك يبقى ملفّه ما دام لغيره', () => {
    const d = db();
    const shared = 'attachments/88ab7c203377fb5dc23622385dc386b7.png';
    const father = saveCitizen(d, person('أب العائلة'));
    const mother = saveCitizen(d, person('أمّ العائلة'));
    const a = card(d, father.id, shared);
    const b = card(d, mother.id, shared);

    expect(unreferenced(d, [deleteAttachment(d, a.id)])).toEqual([]);
    expect(getCitizen(d, mother.id)!.attachments).toHaveLength(1);
    // والأخير يُحذف ملفّه — لا يبقى على القرص ما لا سجلّ له.
    expect(unreferenced(d, [deleteAttachment(d, b.id)])).toEqual([shared]);
  });

  it('حذف المواطن: ما تفرّد به يُحذف، وما يشترك فيه يبقى', () => {
    const d = db();
    const own = 'attachments/own.png';
    const shared = 'attachments/shared.png';
    const photo = 'photos/face.jpg';
    const one = saveCitizen(d, person('الأول', photo));
    const two = saveCitizen(d, person('الثاني', photo));
    card(d, one.id, own);
    card(d, one.id, shared);
    card(d, two.id, shared);

    const files = deleteCitizen(d, one.id);
    expect(files.sort()).toEqual([own, shared, photo].sort());
    expect(unreferenced(d, files)).toEqual([own]);

    // ثم يُحذف الثاني فلا يبقى لأيٍّ منهما مرجع.
    expect(unreferenced(d, deleteCitizen(d, two.id)).sort()).toEqual([shared, photo].sort());
  });

  it('الصورة في تصميمٍ أو كتابٍ صادر أو ترويسةٍ أو إعدادٍ مرجعٌ يُبقيها', () => {
    const d = db();
    const inDesign = 'photos/design.jpg';
    const inArchive = 'images/stamp_1.png';
    const inLetterhead = 'letterheads/logo.png';
    const inSettings = 'suits/custom.png';
    d.prepare("INSERT INTO templates (title, body_html, doc_json) VALUES ('هوية', '', ?)").run(
      JSON.stringify({ kind: 'canvas', canvas: { elements: [{ type: 'image', src: inDesign }] } })
    );
    d.prepare(
      "INSERT INTO documents (serial, serial_year, serial_seq, body_html, gregorian_date, sha256) VALUES ('م/2026/1', 2026, 1, ?, '2026-10-02', 'x')"
    ).run(`<img src="diwan://store/${inArchive}">`);
    d.prepare("INSERT INTO letterheads (name, layout_json) VALUES ('مدرسة', ?)").run(JSON.stringify({ logo: inLetterhead }));
    d.prepare("INSERT INTO settings (key, value) VALUES ('photoSuits', ?)").run(JSON.stringify([{ id: 'c1', path: inSettings }]));

    for (const p of [inDesign, inArchive, inLetterhead, inSettings]) expect(storeFileInUse(d, p)).toBe(true);
    expect(unreferenced(d, [inDesign, inArchive, inLetterhead, inSettings, 'photos/none.jpg'])).toEqual(['photos/none.jpg']);
  });

  it('«_» في المسار حرفٌ لا نمط: مسارٌ آخر يشبهه لا يُبقيه', () => {
    const d = db();
    const one = saveCitizen(d, person('واحد'));
    card(d, one.id, 'attachments/scan_1.png');
    expect(storeFileInUse(d, 'attachments/scanX1.png')).toBe(false);
    expect(storeFileInUse(d, 'attachments/scan_1.png')).toBe(true);
  });

  it('الفارغ والمكرّر لا يُحذفان مرّتين، وقاعدةٌ بلا جدولٍ لا تسقط', () => {
    const d = db();
    expect(unreferenced(d, [null, undefined, '', 'a/b.png', 'a/b.png'])).toEqual(['a/b.png']);
    d.exec('DROP TABLE question_bank');
    expect(storeFileInUse(d, 'a/b.png')).toBe(false);
  });
});
