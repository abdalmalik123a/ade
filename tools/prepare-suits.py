"""
تجهيز صور القاط للتركيب — من مكتبة المكتب إلى ما يُحزم في البرنامج.

    node tools/psd-layers.mjs "<المكتبة>/قووووووووط.psd" <مجلّد الطبقات>
    python tools/prepare-suits.py <المكتبة> <مجلّد الطبقات> src/renderer/src/assets/suits

المكتبة (قرار المالك، ٢٩ أيلول ٢٠٢٦ — بدل القاط المولَّدة): قوالب القاط التي يستعملها المكتب —
طبقات ملف Photoshop شفّافة، وصورةٌ PNG شفّافة، وصور JPEG على خلفيةٍ بيضاء. **والنظامية بلا رتبةٍ
ولا شارةٍ ولا علمٍ ولا اسم جهة وحدها**: ما فيه شيءٌ من ذلك لا يُحزم (`EXCLUDED` بسببه)، ولا
المكرَّر.

ما يُصلَح:
- **الخلفية البيضاء** (JPEG): الأبيض المتّصل بحافّة الصورة يصير شفّافًا — ومنه فتحة العنق — وحافّته
  ناعمةٌ بكسلًا، ويُنزع منها بياضها فلا تظهر هالةٌ بيضاء على خلفيةٍ زرقاء.
- **بقعٌ شاردة**: ما لا يتّصل بأسفل القاط (جسمه) يُمحى. **وثقوب القماش** المغلقة تُملأ.
- **الإطار**: يُقصّ إلى الصدر (كتفان وما تحتهما بعرضهما)، وما تحت الشفّاف يُصفَّر.

وتُكتب WebP بشفافية، وعرضها ٩٠٠ بكسل على الأكثر. يحتاج Pillow وnumpy.
"""
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

# (المصدر، المعرّف، الاسم، الصنف) — «psd:NNN» طبقةٌ من ملف Photoshop بفهرسها، وغيره ملفٌّ في المكتبة.
KEEP = [
    ('psd:001', 'suit-gray-bowtie', 'قاطٌ رمادي بربطة فراشة', 'suit'),
    ('psd:002', 'suit-navy-dark-tie', 'قاطٌ كحلي بربطةٍ داكنة', 'suit'),
    ('psd:004', 'suit-black-pink-tie', 'قاطٌ أسود بربطةٍ مخطّطة ومنديل', 'suit'),
    ('psd:007', 'suit-brown-gold-tie', 'سترةٌ بنّية بربطةٍ ذهبية', 'suit'),
    ('psd:008', 'suit-black-red-stripe', 'قاطٌ أسود بربطةٍ حمراء مخطّطة', 'suit'),
    ('psd:009', 'suit-black-bw-stripe', 'قاطٌ أسود بربطةٍ مخطّطة بالأبيض', 'suit'),
    ('psd:011', 'suit-navy', 'قاطٌ كحلي', 'suit'),
    ('psd:015', 'suit-vest-brown-tie', 'قاطٌ مقلّم بصديريٍّ وربطةٍ بنّية', 'suit'),
    ('psd:016', 'suit-vest-red-tie', 'قاطٌ مقلّم بصديريٍّ وربطةٍ حمراء', 'suit'),
    ('psd:018', 'suit-charcoal-silver-tie', 'قاطٌ فحمي بربطةٍ فضّية', 'suit'),
    ('psd:019', 'suit-pinstripe-red-tie', 'قاطٌ مقلّم بربطةٍ حمراء', 'suit'),
    ('psd:020', 'suit-pinstripe-gold-tie', 'قاطٌ مقلّم بربطةٍ صفراء', 'suit'),
    ('psd:021', 'suit-black-blue-shirt', 'قاطٌ أسود بقميصٍ أزرق', 'suit'),
    ('imgbin_tuxedo-suit-clothing-lapel-single-breasted-png.png', 'suit-navy-gray-tie', 'قاطٌ كحلي بربطةٍ رمادية', 'suit'),
    ('psd:013', 'shirt-white', 'قميصٌ أبيض', 'shirt'),
    ('psd:017', 'shirt-black', 'قميصٌ أسود', 'shirt'),
    ('IMG-20220126-WA0003.jpg', 'uniform-desert-collar', 'مرقّطٌ صحراويّ بياقة', 'uniform'),
    ('IMG-20220126-WA0004.jpg', 'uniform-dark-camo', 'مرقّطٌ رماديّ داكن', 'uniform'),
    ('IMG-20220126-WA0005.jpg', 'uniform-desert-stand', 'مرقّطٌ صحراويّ بياقةٍ واقفة', 'uniform'),
    ('IMG-20220126-WA0006.jpg', 'uniform-urban-camo', 'مرقّطٌ أزرق رماديّ', 'uniform'),
    ('IMG-20220126-WA0007.jpg', 'uniform-navy-camo', 'مرقّطٌ كحليّ', 'uniform'),
    ('IMG-20220126-WA0008.jpg', 'uniform-multicam-dark', 'مرقّطٌ متعدّد داكن', 'uniform'),
    ('IMG-20220126-WA0010.jpg', 'uniform-black-tactical', 'تكتيكيٌّ أسود', 'uniform'),
    ('IMG-20220126-WA0011.jpg', 'uniform-black-stand', 'تكتيكيٌّ أسود بياقةٍ واقفة', 'uniform'),
    ('IMG-20220126-WA0012.jpg', 'uniform-woodland-shirt', 'مرقّطٌ غابيّ بياقة', 'uniform'),
    ('IMG-20220126-WA0014.jpg', 'uniform-multicam', 'مرقّطٌ متعدّد', 'uniform'),
    ('IMG-20220126-WA0016.jpg', 'uniform-digital-woodland', 'مرقّطٌ رقميّ غابيّ', 'uniform'),
    ('photo_12_2024-04-20_16-22-41.jpg', 'uniform-desert-three', 'صحراويٌّ ثلاثيّ', 'uniform'),
    ('photo_13_2024-04-20_16-22-41.jpg', 'uniform-woodland-open', 'مرقّطٌ غابيّ مفتوح', 'uniform'),
    ('photo_7_2024-04-20_16-22-41.jpg', 'uniform-sand-stand', 'مرقّطٌ رمليّ بياقةٍ واقفة', 'uniform'),
    ('photo_9_2024-04-20_16-22-41.jpg', 'uniform-woodland-green', 'مرقّطٌ غابيّ أخضر', 'uniform'),
]

# ما لا يُحزم وسببه — ليُعرف أنه تُرك عمدًا لا سهوًا.
EXCLUDED = {
    'FB_IMG_*.jpg (العشر)': 'رتبٌ على الكتفين، وشاراتٌ وأعلامٌ وأشرطة أسماء',
    'IMG-20220126-WA0000..0002.jpg': 'شارات وزارة وأعلام',
    'IMG-20220126-WA0017.jpg': 'مكرّرةٌ (photo_12 أكبر منها)',
    'IMG-20220126-WA0009.jpg و0015': 'مكرّرتان (photo_7 وphoto_9 أكبر منهما)',
    'photo_10': 'علم', 'photo_11': 'شريط اسم', 'photo_14': 'شارات وعلم', 'photo_1': 'رتبة وشعار',
    'photo_2': 'رتبٌ على الياقة', 'photo_3': 'شارات', 'photo_4': 'شارات وزارة', 'photo_5': 'اسم وزارة ورتبة وعلم',
    'photo_6': 'شعارات', 'photo_8': 'علم وشارة',
    'psd:005 و psd:006': 'قيافة شرطة بشعاراتها وشريط POLICE',
    'psd:003 و010 و012 و014': 'مكرّراتٌ لغيرها بقصٍّ آخر',
}

MAX_WIDTH = 900


def flood(mask: np.ndarray, seed: np.ndarray) -> np.ndarray:
    """ما يتّصل بالبذرة داخل القناع — تمدّدٌ متكرّر حتى يثبت (بلا scipy)."""
    region = seed & mask
    while True:
        grown = region.copy()
        grown[1:, :] |= region[:-1, :]
        grown[:-1, :] |= region[1:, :]
        grown[:, 1:] |= region[:, :-1]
        grown[:, :-1] |= region[:, 1:]
        grown &= mask
        if (grown == region).all():
            return region
        region = grown


def border_of(shape: tuple[int, int]) -> np.ndarray:
    b = np.zeros(shape, bool)
    b[0, :] = b[-1, :] = True
    b[:, 0] = b[:, -1] = True
    return b


def white_matte(rgb: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """
    الأبيض المتّصل بحافّة الصورة خلفية — وفتحة العنق منه. والحافّة ناعمةٌ بكسلًا، ويُنزع منها
    بياضها: الملاحظ = α·القماش + (١−α)·أبيض، فالقماش = (الملاحظ − (١−α)·٢٥٥) / α.
    """
    mn, mx = rgb.min(axis=2), rgb.max(axis=2)
    near_white = (mn >= 228) & (mx - mn <= 22)
    background = flood(near_white, border_of(near_white.shape))
    m = Image.fromarray(np.where(background, 0, 255).astype(np.uint8), 'L')
    m = m.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    alpha = np.array(m)
    a = alpha.astype(np.float32)[..., None] / 255
    clean = np.where(a > 0.05, (rgb.astype(np.float32) - (1 - a) * 255) / np.maximum(a, 0.05), rgb)
    return np.clip(clean, 0, 255).astype(np.uint8), alpha


def load(src: str, library: str, layers: str) -> tuple[np.ndarray, np.ndarray]:
    path = os.path.join(layers, src[4:] + '.png') if src.startswith('psd:') else os.path.join(library, src)
    im = Image.open(path)
    if im.mode in ('RGBA', 'LA') or 'transparency' in im.info:
        a = np.array(im.convert('RGBA'))
        return a[..., :3], a[..., 3]
    return white_matte(np.array(im.convert('RGB')))


def prepare(rgb: np.ndarray, alpha: np.ndarray) -> Image.Image:
    h, w = alpha.shape
    opaque = alpha >= 128

    # ١. البقع الشاردة: يبقى ما اتّصل بأسفل القاط (جسمه).
    ys, _ = np.nonzero(opaque)
    seed = np.zeros_like(opaque)
    seed[ys.max(), :] = True
    body = flood(opaque, seed)
    alpha = np.where(flood(alpha > 0, body), alpha, 0)

    # ٢. ثقوب القماش: الشفّاف الذي لا يتّصل بحافّة الصورة يُملأ.
    clear = alpha < 128
    holes = clear & ~flood(clear, border_of(clear.shape))
    alpha = np.where(holes, 255, alpha)

    # ٣. الإطار: من أعلى القاط إلى ما تحت الكتفين بعرضهما — لا يدان ولا حزام.
    ys, xs = np.nonzero(alpha >= 128)
    # من أوّل ما يُرى — ولا يُبدأ من غبشٍ خافتٍ بعيدٍ فوق القاط.
    top = max(int(np.nonzero(alpha.max(axis=1) > 0)[0].min()), int(ys.min()) - 6)
    upper = ys < top + (ys.max() - top) * 0.35
    shoulders = xs[upper].max() - xs[upper].min() + 1
    x0, x1 = xs.min(), xs.max() + 1
    y1 = min(h, int(top + shoulders * 1.05), ys.max() + 1)
    out = np.dstack([rgb, alpha]).astype(np.uint8)
    out[out[..., 3] == 0, :3] = 0
    img = Image.fromarray(out[top:y1, x0:x1], 'RGBA')
    if img.width > MAX_WIDTH:
        img = img.resize((MAX_WIDTH, round(img.height * MAX_WIDTH / img.width)), Image.LANCZOS)
    return img


def main() -> None:
    library, layers, dst = sys.argv[1], sys.argv[2], sys.argv[3]
    os.makedirs(dst, exist_ok=True)
    for src, out, _name, _category in KEEP:
        img = prepare(*load(src, library, layers))
        target = os.path.join(dst, out + '.webp')
        img.save(target, 'WEBP', quality=90, method=6)
        print(f'{out}.webp  {img.width}x{img.height}  {os.path.getsize(target)} bytes')


if __name__ == '__main__':
    main()
