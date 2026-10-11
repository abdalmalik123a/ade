/**
 * حقل بحثٍ يُمسح بـ✕ ظاهرٍ كما يُمسح بـEscape (البند ١٩، دليل الواجهة `UI.md`): كان Escape يمسح بحث الشبّاك ولا يُرى.
 * و✕ المتصفّح نفسه يُخفى — فلا ✕ان.
 */
import type { InputHTMLAttributes, MutableRefObject } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: string;
  onChange: (value: string) => void;
  inputRef?: MutableRefObject<HTMLInputElement | null>;
  /** صنف الغلاف — العرض وما يحيط بالحقل. */
  wrapClassName?: string;
};

export default function SearchField({ value, onChange, inputRef, wrapClassName = '', className = '', ...rest }: Props) {
  return (
    <div className={`relative ${wrapClassName}`}>
      <input
        {...rest}
        ref={inputRef}
        className={`${className} pe-10 [&::-webkit-search-cancel-button]:hidden`}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button
          className="absolute inset-y-0 end-1 my-auto w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high"
          data-act="search-clear"
          title="امسح البحث (Escape)"
          type="button"
          onClick={() => {
            onChange('');
            inputRef?.current?.focus();
          }}
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      )}
    </div>
  );
}
