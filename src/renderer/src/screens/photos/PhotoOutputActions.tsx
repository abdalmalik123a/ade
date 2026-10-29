/** أفعال الإخراج القائمة في شريط ثابت أسفل المعاينة. */
import { toIndic } from '@shared/arabic';
import { SIZE_LIMITS } from '@shared/pdfEdit';
import { ToolOutput } from '../../components/ToolFrame';
import type { PhotoSizeOutputProps } from './PhotoSizeOutput';
type Props = Pick<PhotoSizeOutputProps,'after'|'setAfter'|'lastPrint'|'send'|'src'|'layout'|'busy'|'cutState'|'openReview'|'small'|'saveImage'|'preset'|'nav'|'linkCitizen'|'setPicking'|'limit'|'setLimit'|'saveUpload'>;
export default function PhotoOutputActions({after,setAfter,lastPrint,send,src,layout,busy,cutState,openReview,small,saveImage,preset,nav,linkCitizen,setPicking,limit,setLimit,saveUpload}:Props) {
 return <div className="shrink-0" data-photo-output dir="rtl">
      <ToolOutput bar
        after={after}
        role="photos"
        onDismiss={() => setAfter(null)}
        onReprint={lastPrint.current ? () => void send(lastPrint.current!) : undefined}
      >
      <button
        className="flex-1 min-w-48 h-10 btn-act font-label-md text-label-md font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40"
        data-act="review-photos"
        disabled={!src || !layout.per || Boolean(busy) || cutState === 'running'}
        type="button"
        onClick={() => void openReview()}
      >
        <span className="material-symbols-outlined text-[18px]">grid_view</span>
        راجع الورقة واطبع
      </button>
      <div className="flex gap-space-xs">
        <button className={`${small} bg-surface-container-lowest h-10`} data-act="save-photo" disabled={!src || Boolean(busy)} type="button" onClick={() => void saveImage()}>
          احفظ الصورة ({toIndic(preset.dpi)} نقطة)
        </button>
        <button
          className={`${small} bg-surface-container-lowest h-10 truncate`}
          data-act="link-citizen"
          disabled={!src || Boolean(busy)}
          type="button"
          // جاءت الأداة لزبونٍ من الشبّاك: في ملفّه مباشرة — وإلا يُختار صاحبها.
          onClick={() => (nav.customer ? void linkCitizen(nav.customer.id) : setPicking(true))}
        >
          {nav.customer ? `في ملفّ ${nav.customer.name || 'الزبون'}` : 'في ملف مواطن'}
        </button>
      </div>
      <div className="flex items-center gap-space-xs">
        <select
          className="h-10 px-2 rounded-field bg-surface-container-lowest border border-outline-variant font-label-sm text-label-sm"
          data-upload-limit=""
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
        >
          {SIZE_LIMITS.map((l) => (
            <option key={l.bytes} value={l.bytes}>
              {l.label}
            </option>
          ))}
        </select>
        <button className={`${small} flex-1 bg-surface-container-lowest h-10`} data-act="save-upload" disabled={!src || Boolean(busy)} type="button" onClick={() => void saveUpload()}>
          احفظها للرفع بهذا الحدّ
        </button>
      </div>
      </ToolOutput>
 </div>;
}
