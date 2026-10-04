"""
يصنع صور الهوية — مرّةً حين تتغيّر الهوية، لا مع كلّ بناء:

    python tools/make-brand.py

هوية «منتصف الليل» (خطّة الترقية، المرحلة ٦):

- **أيقونة «ديوان»**: «د» أبيض على مربّعٍ كحليّ مستدير الأركان، يقطعه من أسفله قطعٌ مائل بتدرّج MADA
  (‎#1570DA ← ‎#1446D8) على حدّه خيطٌ من الوهج (‎#22D3EE). تُرسم هنا لا تُقصّ من صورة — فتبقى حادّةً في
  كلّ مقاس — ثم أيقونة ويندوز بمقاساتها، وصورةٌ للواجهة. والحرف بخطّ Segoe UI العريض من خطوط ويندوز.
- **شعار MADA TECH**: الأصل (resources/brand/source/madatech-logo.jpg) على خلفيّةٍ سوداء؛ فالأسود يصير
  شفّافًا («اللون إلى شفافيّة»: الشفافيّة من أسطع القنوات، واللون يُقسم عليها فلا يبقى هالةٌ رمادية)،
  ويُقصّ على ما فيه. وحروفه البيضاء لا تُرى على ورقٍ فاتح — فيُعرض على بطاقةٍ داكنة.
- **علامة MT**: أعلى الشعار وحده (الحرفان فوق «MADA TECH») — لرأس السكّة وللعلامة المائية في الشبّاك.

والأصول لا تُحزم في المثبّت؛ ما يُحزم هو ما يُكتب هنا.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'resources' / 'brand' / 'source'
UI = ROOT / 'src' / 'renderer' / 'src' / 'assets' / 'brand'

NAVY_TOP = (16, 28, 64)  # ‎#101C40
NAVY_BOTTOM = (6, 11, 26)  # ‎#060B1A
MADA_FROM = (21, 112, 218)  # ‎#1570DA
MADA_TO = (20, 70, 216)  # ‎#1446D8
GLOW = (34, 211, 238)  # ‎#22D3EE
FONTS = [Path('C:/Windows/Fonts') / n for n in ('segoeuib.ttf', 'arialbd.ttf', 'tahomabd.ttf')]

# علامة MT في الأصل (١٢٥٤ مربّعًا): فوق «MADA TECH».
MT_BOX = (340, 300, 960, 700)


def rounded_mask(size: int, radius: int, scale: int = 4) -> Image.Image:
    big = Image.new('L', (size * scale, size * scale), 0)
    ImageDraw.Draw(big).rounded_rectangle((0, 0, size * scale - 1, size * scale - 1), radius=radius * scale, fill=255)
    return big.resize((size, size), Image.LANCZOS)


def gradient(size: int, a: tuple[int, int, int], b: tuple[int, int, int], diagonal: bool) -> Image.Image:
    """تدرّجٌ من a إلى b — عموديًّا، أو مائلًا من أعلى اليسار إلى أسفل اليمين."""
    g = Image.new('RGB', (size, size))
    px = g.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * (size - 1)) if diagonal else y / (size - 1)
            px[x, y] = tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))
    return g


def icon(size: int = 1024) -> Image.Image:
    out = gradient(size, NAVY_TOP, NAVY_BOTTOM, diagonal=False).convert('RGBA')

    # القطع المائل: ما تحت خطٍّ من يسار الثلث الأسفل إلى يمين الثلث الأعلى، بتدرّج MADA.
    cut = Image.new('L', (size, size), 0)
    left, right = round(size * 0.80), round(size * 0.46)
    ImageDraw.Draw(cut).polygon([(0, left), (size, right), (size, size), (0, size)], fill=255)
    out.paste(gradient(size, MADA_FROM, MADA_TO, diagonal=True), (0, 0), cut)
    # وعلى حدّه خيطٌ من الوهج.
    line = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(line).line([(0, left), (size, right)], fill=GLOW + (210,), width=max(2, size // 90))
    out.alpha_composite(line.filter(ImageFilter.GaussianBlur(size / 700)))

    # «د» أبيض في الوسط — بظلٍّ خفيف يفصله عن القطع.
    font_path = next((p for p in FONTS if p.exists()), None)
    if font_path is None:
        raise SystemExit('لا خطّ عربيّ عريض في C:/Windows/Fonts (segoeuib أو arialbd أو tahomabd)')
    font = ImageFont.truetype(str(font_path), round(size * 0.62))
    glyph = Image.new('L', (size, size), 0)
    d = ImageDraw.Draw(glyph)
    x0, y0, x1, y1 = d.textbbox((0, 0), 'د', font=font)
    pos = ((size - (x1 - x0)) / 2 - x0, (size - (y1 - y0)) / 2 - y0 - size * 0.03)
    d.text(pos, 'د', font=font, fill=255)
    shadow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    shadow.putalpha(glyph.filter(ImageFilter.GaussianBlur(size / 60)).point(lambda v: v * 0.55))
    out.alpha_composite(shadow, (0, round(size * 0.012)))
    white = Image.new('RGBA', (size, size), (255, 255, 255, 255))
    white.putalpha(glyph)
    out.alpha_composite(white)

    out.putalpha(rounded_mask(size, round(size * 0.22)))
    return out


def transparent(src: Image.Image) -> Image.Image:
    """الأسود شفّافًا — واللون مقسومًا على شفافيّته: الأبيض أبيض والأزرق أزرق، بلا رماديّ."""
    floor = 22  # سواد الخلفية في الأصل ليس صفرًا خالصًا (نحو ٥–١٠)
    rgba = Image.new('RGBA', src.size)
    data = []
    pixels = src.get_flattened_data() if hasattr(src, 'get_flattened_data') else src.getdata()
    for r, g, b in pixels:
        m = max(r, g, b)
        a = 0 if m <= floor else min(255, round((m - floor) * 255 / (255 - floor)))
        if a == 0:
            data.append((0, 0, 0, 0))
            continue
        k = 255 / max(m, 1)
        data.append((min(255, round(r * k)), min(255, round(g * k)), min(255, round(b * k)), a))
    rgba.putdata(data)
    return rgba


def trim(rgba: Image.Image, pad_share: float) -> Image.Image:
    box = rgba.getchannel('A').point(lambda v: 255 if v > 12 else 0).getbbox()
    pad = round(pad_share * max(box[2] - box[0], box[3] - box[1]))
    box = (max(0, box[0] - pad), max(0, box[1] - pad), min(rgba.width, box[2] + pad), min(rgba.height, box[3] + pad))
    return rgba.crop(box)


def main() -> None:
    UI.mkdir(parents=True, exist_ok=True)
    ic = icon()
    ic.resize((512, 512), Image.LANCZOS).save(ROOT / 'resources' / 'icon.png')
    ic.resize((256, 256), Image.LANCZOS).save(
        ROOT / 'resources' / 'icon.ico', sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    )
    ic.resize((256, 256), Image.LANCZOS).save(UI / 'diwan-icon.png', optimize=True)

    full = transparent(Image.open(SRC / 'madatech-logo.jpg').convert('RGB'))
    lg = trim(full, 0.04)
    w = min(900, lg.width)
    lg.resize((w, round(lg.height * w / lg.width)), Image.LANCZOS).save(UI / 'madatech-logo.png', optimize=True)

    mt = trim(full.crop(MT_BOX), 0.02)
    h = 256
    mt.resize((round(mt.width * h / mt.height), h), Image.LANCZOS).save(UI / 'mt-mark.png', optimize=True)

    print('icon:', ic.size, '-> resources/icon.ico, resources/icon.png, assets/brand/diwan-icon.png')
    print('logo:', lg.size, '-> assets/brand/madatech-logo.png')
    print('mark:', mt.size, '-> assets/brand/mt-mark.png')


if __name__ == '__main__':
    main()
