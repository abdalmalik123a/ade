/**
 * الترويسة كما تُطبع — مكوّن واحد يستعمله المحرر وشاشة الإعدادات معًا.
 *
 * وجود نسختين من الرسم كان يعني ورقتين مختلفتين لترويسة واحدة؛ فما يراه
 * المكتب في الإعدادات هو نفسه ما يخرج على الكتاب، لأنه الكود نفسه.
 */
import {
  defaultAlign,
  fontStack,
  isLayoutEmpty,
  visibleSections,
  type LetterheadBlock,
  type LetterheadLayout
} from '@shared/letterhead';
import { emptyDoc } from '@shared/doc';
import { renderDocHtml } from '@shared/docHtml';

const storeUrl = (rel: string | null) => (rel ? `diwan://store/${rel}` : undefined);

export type LetterheadViewProps = {
  layout: LetterheadLayout;
  /** قيمتا العدد والتاريخ حين تكون الترويسة «مطبوعة» لا فراغًا. */
  registryValues?: { serial: string; date: string };
  /** يملأ الحقول التلقائية مثل {رقم_الصادر}؛ بلا دالّة يبقى الوسم كما هو. */
  resolve?: (value: string) => string;
  /** يُنادى عند النقر على كتلة — للتحديد في المصمّم. */
  onPickBlock?: (sectionIndex: number, blockId: string) => void;
  selectedBlock?: string | null;
  /** رسالة الفراغ تُعرض في المصمّم فقط، لا على ورقة الكتاب. */
  emptyHint?: string;
};

function Block({
  block,
  fallbackAlign,
  resolve,
  onClick,
  selected
}: {
  block: LetterheadBlock;
  fallbackAlign: LetterheadBlock['align'];
  resolve?: (value: string) => string;
  onClick?: () => void;
  selected?: boolean;
}) {
  const ring = selected ? 'outline outline-1 outline-secondary outline-offset-2' : '';
  const align = block.align ?? fallbackAlign;

  if (block.kind === 'spacer') {
    return <div className={ring} style={{ height: block.gap ?? 12 }} onClick={onClick} />;
  }

  if (block.kind === 'divider') {
    return (
      <hr
        className={`border-t border-on-surface my-1 ${ring}`}
        onClick={onClick}
      />
    );
  }

  if (block.kind === 'image') {
    const justify = align === 'center' ? 'center' : align === 'left' ? 'flex-start' : 'flex-end';
    return (
      <div className={`flex ${ring}`} style={{ justifyContent: justify }} onClick={onClick}>
        {block.value ? (
          <img alt="" src={storeUrl(block.value)} style={{ width: block.width ?? 90 }} />
        ) : (
          <span className="font-label-sm text-label-sm text-on-surface-variant">
            [لم تُختر صورة]
          </span>
        )}
      </div>
    );
  }

  const text = block.kind === 'field' && resolve ? resolve(block.value) : block.value;
  // حقل رقم الصادر في الترويسة يُملأ عند الإصدار كما يُملأ في سطر العدد:
  // ما يُعرض قبله اطّلاعٌ، والموضع محجوز ليحلّ فيه الرقم المحجوز فعلًا.
  const slot =
    block.kind === 'field' && block.value.includes('رقم_الصادر') ? 'serial' : undefined;
  return (
    <div
      className={`${block.bold ? 'font-bold' : ''} ${ring}`}
      style={{ textAlign: align, fontSize: `${block.size}px`, lineHeight: 1.7 }}
      data-slot={slot}
      onClick={onClick}
    >
      {text || ' '}
    </div>
  );
}

/**
 * العدد والتاريخ في رأس القسم الأخير — التاريخ فوق العدد كما تكتبه الدوائر.
 * والأصل فراغ منقوط: الكتاب يخرج من المكتب ليكتبهما موظّف الاستلام بخطّه.
 */
function Registry({
  mode,
  values
}: {
  mode: 'manual' | 'printed';
  values?: { serial: string; date: string };
}) {
  const blank = (
    <span className="flex-1" style={{ borderBottom: '1px dotted currentColor', height: '1em' }} />
  );

  return (
    <div className="flex flex-col gap-1 text-on-surface" data-registry={mode}>
      <div className="flex items-baseline gap-2" style={{ fontSize: '12px' }}>
        <span className="font-semibold shrink-0">التاريخ:</span>
        {mode === 'printed' ? <span>{values?.date || '—'}</span> : blank}
      </div>
      <div className="flex items-baseline gap-2" style={{ fontSize: '12px' }}>
        <span className="font-semibold shrink-0">العدد:</span>
        {mode === 'printed' ? (
          <span className="font-mono font-bold" data-slot="serial">
            {values?.serial || '—'}
          </span>
        ) : (
          blank
        )}
      </div>
    </div>
  );
}

export default function LetterheadView({
  layout,
  registryValues,
  resolve,
  onPickBlock,
  selectedBlock,
  emptyHint
}: LetterheadViewProps) {
  const sections = visibleSections(layout);
  const registryAt = sections.length - 1;

  if (layout.sheet?.length) {
    // رأسٌ من ورقة: يُرسم بأصناف المتن ورسّامه، فيقع حيث وقع في Word.
    return (
      <div
        className="font-body-md text-body-md leading-8"
        data-sheet-head=""
        dangerouslySetInnerHTML={{
          __html: renderDocHtml({ ...emptyDoc(), blocks: layout.sheet }, {}, { paragraphs: 'blocks' })
        }}
      />
    );
  }

  if (isLayoutEmpty(layout)) {
    return emptyHint ? (
      <div className="py-space-lg flex flex-col items-center gap-space-xs text-on-surface-variant border border-dashed border-outline-variant rounded">
        <span className="material-symbols-outlined text-[28px]">note_add</span>
        <span className="font-body-md text-body-md">{emptyHint}</span>
      </div>
    ) : null;
  }

  return (
    // خطّ الترويسة يُضبط هنا مرّة — فالمعاينة والطباعة يرثانه معًا.
    <div style={{ fontFamily: fontStack(layout.font) }}>
      {layout.basmala.show && (
        // فوق الأقسام كلّها لا داخل عمود — وهو موضعها في الكتاب الرسمي.
        <div
          className="mb-space-xs"
          style={{
            textAlign: layout.basmala.align,
            fontSize: `${layout.basmala.size}px`,
            lineHeight: 1.7
          }}
        >
          {layout.basmala.text}
        </div>
      )}
      <div className="flex items-start gap-space-md">
        {sections.map((section, i) => (
          <div
            key={section.id}
            className="flex flex-col"
            style={{ flex: `${section.weight || 1} 1 0`, minWidth: 0 }}
          >
            {layout.registry.show && i === registryAt && (
              <Registry mode={layout.registry.mode} values={registryValues} />
            )}
            {section.blocks.map((block) => (
              <Block
                key={block.id}
                block={block}
                fallbackAlign={defaultAlign(i, layout.columns)}
                resolve={resolve}
                selected={selectedBlock === block.id}
                onClick={onPickBlock ? () => onPickBlock(i, block.id) : undefined}
              />
            ))}
          </div>
        ))}
      </div>
      {layout.divider && <hr className="border-t-2 border-on-surface mt-space-sm" />}
    </div>
  );
}
