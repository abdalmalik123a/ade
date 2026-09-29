"""
تجهيز صور القاط للتركيب — من صورٍ مقصوصةٍ خامٍ إلى ما يُحزم في البرنامج.

    python tools/prepare-suits.py <مجلّد الخام> src/renderer/src/assets/suits [<مجلّد الأصول المولَّدة>]

الخام: صورٌ PNG شفّافة الخلفية والرأس (قُصّت من صورٍ مولَّدة — لا أشخاص حقيقيّون). وما يُصلَح:

- **ما قصّه القصّ الآليّ من الياقة وعقدة الربطة** يُعاد من الصورة المولَّدة الأصلية إن أُعطي
  مجلّدها: ما ليس بشرةً ولا خلفيةً في منطقة الياقة، ومتّصلٌ بالقاط — فلا يعود وجهٌ ولا رقبة.
- **ثقوب الياقة**: شفافيّةٌ مغلقة داخل القماش (قصٌّ رديء) تُملأ — وفتحة العنق تبقى لأنها
  متّصلةٌ بأعلى الصورة.
- **بقعٌ شاردة**: ما لا يتّصل بجسم القاط يُمحى.
- **جلد العارض** في فتحة العنق يصير شفّافًا — فتظهر رقبة الزبون لا رقبة غيره.
- **أعلى القاط منحنٍ**: الخام قُصّ بخطٍّ أفقيٍّ فوق الياقة والكتفين، فيبدو فوق رقبة الزبون حافّةً
  مسطّحة. فيُنحت منحنًى ينزل من العنق إلى الكتفين، ويتلاشى أعلاه حول العنق وحده — والبرنامج
  يُبقي رقبة الزبون تحت ما شفّ منه فيذوب فيها.
- **الإطار**: يُقصّ إلى الصدر (كتفان وما تحتهما بعرضهما) — فلا تظهر يدان ولا حزام.
- **الحافّة** تُنعَّم قليلًا، وما تحت الشفّاف يُصفَّر (كان يحمل وجه العارض مخفيًّا ويضخّم الملف).

وتُكتب WebP بشفافية (عُشر حجم PNG تقريبًا). يحتاج Pillow وnumpy.
"""
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

# ما يُحزم، وما يُسمّى به. والبدلات العسكرية بلا رتبةٍ ولا شارةٍ ولا وسام وحدها (قرار المالك).
KEEP = {
    'men-black-tie.png': ('suit-black-tie', 'suit_men_black_tie_1790667972009.jpg'),
    'men-gray-tie.png': ('suit-gray-tie', 'suit_men_gray_tie_1790667993544.jpg'),
    'men-navy-tie.png': ('suit-navy-tie', 'suit_test_1790667942679.jpg'),
    'men-black-open.png': ('suit-black-open', 'suit_men_black_open_1790668016868.jpg'),
    'women-black-formal.png': ('women-black-jacket', 'suit_women_black_1790668179216.jpg'),
    'mil-security-dark.png': ('uniform-mandarin-dark', 'suit_mil_black_1790668143102.jpg'),
    'iraq-cts-black.png': ('uniform-black-shirt', 'iraq_cts_black_1790668424020.jpg'),
    # والمرقّطة الصحراوية لا: قُصّ خامها بخطٍّ أفقيٍّ عبر الكتفين، فتقع الرقبة على حافّةٍ مسطّحة.
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


def skin(rgb: np.ndarray) -> np.ndarray:
    """
    البشرة بحدود YCbCr، مضيَّقةً: ربطة العنق العنابيّة وقعت في الحدود المعروفة (Cr حتى ١٧٣)
    فمُحي أعلاها. فالبشرة هنا فاتحةٌ (Y ≥ ١١٠)، وأحمرها معتدل (Cr ≤ ١٦٥)، وترتيبها R > G > B.
    """
    r, g, b = (rgb[..., i].astype(np.float32) for i in range(3))
    y = 0.299 * r + 0.587 * g + 0.114 * b
    cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b
    cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b
    return (y >= 110) & (cb >= 77) & (cb <= 127) & (cr >= 138) & (cr <= 165) & (r > g) & (g > b) & (r - g < 70)


def restore(rgb: np.ndarray, alpha: np.ndarray, orig: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """
    ما قصّه القصّ الآليّ من الياقة والربطة يُعاد من الأصل المولَّد: في منطقة الياقة وحدها، وما
    ليس بشرةً (بحدودٍ واسعة) ولا خلفية (بيضاء متّصلة بحافّة الصورة)، ومتّصلٌ بالقاط.
    """
    h, w = alpha.shape
    border = np.zeros((h, w), bool)
    border[0, :] = border[-1, :] = True
    border[:, 0] = border[:, -1] = True
    background = flood(orig.min(axis=2) > 225, border)
    r, g, b = (orig[..., i].astype(np.float32) for i in range(3))
    cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b
    cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b
    loose_skin = (cb >= 72) & (cb <= 132) & (cr >= 132) & (cr <= 175) & (r > g) & (g >= b) & (r - g < 70)
    ys, _ = np.nonzero(alpha >= 128)
    top, bottom = ys.min(), ys.max()
    band = np.zeros((h, w), bool)
    band[top : top + int((bottom - top) * 0.35), int(w * 0.25) : int(w * 0.75)] = True
    cand = band & ~background & ~loose_skin & (alpha < 128)
    grown = flood(cand | (alpha >= 128), alpha >= 128) & cand
    rgb = np.where(grown[..., None], orig, rgb)
    alpha = np.where(grown, 255, alpha)
    return rgb, alpha


def prepare(path: str, original: str | None = None) -> Image.Image:
    im = Image.open(path).convert('RGBA')
    a = np.array(im)
    rgb, alpha = a[..., :3], a[..., 3]
    h, w = alpha.shape

    # ٠. ما قصّه القصّ الآليّ من الياقة والربطة — من الأصل إن وُجد بالمقاس نفسه.
    if original and os.path.exists(original):
        orig = np.array(Image.open(original).convert('RGB'))
        if orig.shape[:2] == (h, w):
            rgb, alpha = restore(rgb, alpha, orig)
    opaque = alpha >= 128

    # ١. البقع الشاردة: يبقى ما اتّصل بأسفل القاط (جسمه).
    seed = np.zeros_like(opaque)
    seed[-1, :] = True
    body = flood(opaque, seed)
    alpha = np.where(body, alpha, 0)

    # ٢. ثقوب القماش: الشفّاف الذي لا يتّصل بحافّة الصورة يُملأ.
    clear = alpha < 128
    border = np.zeros_like(clear)
    border[0, :] = border[-1, :] = True
    border[:, 0] = border[:, -1] = True
    outside = flood(clear, border)
    holes = clear & ~outside
    alpha = np.where(holes, 255, alpha)

    # ٣. جلد العارض في فتحة العنق: بشرةٌ متّصلةٌ بالشفّاف من أعلى، في الوسط العلويّ وحده.
    ys, xs = np.nonzero(alpha >= 128)
    top, bottom = ys.min(), ys.max()
    zone = np.zeros_like(clear)
    zone[top : top + int((bottom - top) * 0.45), int(w * 0.3) : int(w * 0.7)] = True
    neck_skin = skin(rgb) & zone & (alpha > 0)
    reach = flood(neck_skin | (alpha < 128), outside & zone)
    alpha = np.where(reach & neck_skin, 0, alpha)

    # ٤. الحافّة: إغلاقٌ ثم فتحٌ صغيران، ثم تنعيمٌ ببكسلٍ واحد.
    m = Image.fromarray(alpha.astype(np.uint8), 'L')
    m = m.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
    m = m.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))
    m = m.filter(ImageFilter.GaussianBlur(0.8))
    alpha = np.array(m)

    # ٤ب. أعلى القاط: الخام قُصّ بخطٍّ أفقيّ، فيُنحت منحنًى ينزل من العنق إلى الكتفين (قطعٌ مكافئ،
    # ميله عند الكتف نحو عشرين درجة) بحافّةٍ ناعمة — وحول العنق وحده يتلاشى أعلاه قليلًا فيذوب في
    # رقبة الزبون.
    ys, xs = np.nonzero(alpha >= 128)
    top = ys.min()
    upper = ys < top + (ys.max() - top) * 0.35
    left, right = xs[upper].min(), xs[upper].max()
    mid, half = (left + right) / 2, (right - left) / 2
    dx = np.abs(np.arange(w) - mid) / half
    curve = top + 0.35 * half * dx**2
    rows = np.arange(h)[:, None]
    alpha = (alpha * np.clip(rows - curve[None, :] + 1, 0, 1)).astype(np.uint8)
    fade = max(4, int((ys.max() - top) * 0.025))
    near = np.clip(1 - (dx - 0.18) / 0.06, 0, 1)
    ramp = np.clip((rows - curve[None, :] + 1) / fade, 0, 1)
    alpha = (alpha * (1 - near[None, :] * (1 - ramp))).astype(np.uint8)

    # ٥. الإطار: من أعلى القاط إلى ما تحت الكتفين بعرضهما — لا يدان ولا حزام.
    ys, xs = np.nonzero(alpha >= 128)
    top = int(np.nonzero(alpha.max(axis=1) > 0)[0].min())  # من أوّل ما يُرى — والمتلاشي منه
    upper = ys < top + (ys.max() - top) * 0.35
    shoulders = xs[upper].max() - xs[upper].min() + 1
    x0, x1 = xs.min(), xs.max() + 1
    y1 = min(h, int(top + shoulders * 1.05))
    out = np.dstack([rgb, alpha]).astype(np.uint8)
    out[out[..., 3] == 0, :3] = 0
    img = Image.fromarray(out[top:y1, x0:x1], 'RGBA')
    if img.width > MAX_WIDTH:
        img = img.resize((MAX_WIDTH, round(img.height * MAX_WIDTH / img.width)), Image.LANCZOS)
    return img


def main() -> None:
    src, dst = sys.argv[1], sys.argv[2]
    originals = sys.argv[3] if len(sys.argv) > 3 else None
    os.makedirs(dst, exist_ok=True)
    for name, (out, original) in KEEP.items():
        img = prepare(os.path.join(src, name), os.path.join(originals, original) if originals else None)
        target = os.path.join(dst, out + '.webp')
        img.save(target, 'WEBP', quality=90, method=6)
        print(f'{out}.webp  {img.width}x{img.height}  {os.path.getsize(target)} bytes')


if __name__ == '__main__':
    main()
