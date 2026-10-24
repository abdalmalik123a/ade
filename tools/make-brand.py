"""
يصنع صور الهوية — مرّةً حين تتغيّر الهوية، لا مع كلّ بناء:

    python tools/make-brand.py

- **رمز «ديوان» وأيقونته** (ملفّ المالك الجديد ٢٤ ت١ ٢٠٢٦، ر175 يعدّل ر130): الأصل `resources/brand/source/diwan-logo.ico` مقاسٌ واحد
  ٢٥٦ بخلفيةٍ شفّافة، وتحت الرمز كلمة «DIWAN» **بيضاء**. والمأخوذ منه **الرمز وحده**: الكلمة البيضاء لا تُرى على الواجهة الفاتحة
  ولا على شريط المهامّ وسطح المكتب، ولا تُقرأ دون ٤٨ نقطة. فالرمز ما فوق الشريط الشفّاف الذي يفصله عن الكلمة (لا أرقام باليد:
  يُحسب من الصورة ويُطبع)، ويُوضع في مربّع. ومنه أيقونة ويندوز (`resources/icon.ico`) بمقاساتها السبعة، كلٌّ مصغّرٌ من الرمز نفسه
  (الأصل مقاسٌ واحد فلا مقاساتٍ رسمها مصمّم)، و`icon.png` وصورة الواجهة (`diwan-icon.png`) بـ٢٥٦ لا أكبر،
  و**علامته** للعلامة المائية الخافتة في الشبّاك (`diwan-mark.png`) الرمز نفسه مقصوصًا.
- **شعار MADA TECH** (المطوّر): الأصل (resources/brand/source/madatech-logo.jpg) على خلفيّةٍ سوداء؛ فالأسود يصير
  شفّافًا («اللون إلى شفافيّة»: الشفافيّة من أسطع القنوات، واللون يُقسم عليها فلا يبقى هالةٌ رمادية)،
  ويُقصّ على ما فيه. وحروفه البيضاء لا تُرى على ورقٍ فاتح — فيُعرض على بطاقةٍ داكنة.

والأصول لا تُحزم في المثبّت؛ ما يُحزم هو ما يُكتب هنا.
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'resources' / 'brand' / 'source'
UI = ROOT / 'src' / 'renderer' / 'src' / 'assets' / 'brand'
LOGO = SRC / 'diwan-logo.ico'
ICON_SIZES = (16, 24, 32, 48, 64, 128, 256)


def symbol(pad_share: float) -> tuple[Image.Image, tuple[int, int, int, int]]:
    """الرمز بلا الكلمة البيضاء تحته: ما فوق أوّل سطرٍ شفّافٍ كلّه تحت أعلى محتوى، مقصوصًا على ما ليس شفّافًا بهامشٍ صغير.
    (حدّ «أوّل بياضٍ معتم» يُدخل حافّة الكلمة المنعّمة الرماديّة فوقه — فالحدّ الشريط الشفّاف نفسه، مراجعة D154.)"""
    im = Image.open(LOGO)
    im.load()
    im = im.convert('RGBA')
    alpha = im.getchannel('A')
    top = alpha.getbbox()[1]
    rows = (alpha.crop((0, y, im.width, y + 1)).getbbox() for y in range(top, im.height))
    gap = top + next(i for i, row in enumerate(rows) if row is None)
    box = alpha.crop((0, 0, im.width, gap)).getbbox()
    pad = round(pad_share * max(box[2] - box[0], box[3] - box[1]))
    return im.crop((max(0, box[0] - pad), max(0, box[1] - pad), min(im.width, box[2] + pad), min(gap, box[3] + pad))), box


def squared(im: Image.Image) -> Image.Image:
    """في مربّعٍ شفّاف، في وسطه."""
    side = max(im.size)
    sq = Image.new('RGBA', (side, side))
    sq.paste(im, ((side - im.width) // 2, (side - im.height) // 2))
    return sq


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
    mark, box = symbol(0.02)
    mark.save(UI / 'diwan-mark.png', optimize=True)
    sq = squared(mark)
    sizes = [sq.resize((n, n), Image.LANCZOS) for n in ICON_SIZES]
    big = sizes[-1]
    big.save(ROOT / 'resources' / 'icon.png', optimize=True)
    big.save(UI / 'diwan-icon.png', optimize=True)
    big.save(ROOT / 'resources' / 'icon.ico', sizes=[(n, n) for n in ICON_SIZES], append_images=sizes[:-1])

    full = transparent(Image.open(SRC / 'madatech-logo.jpg').convert('RGB'))
    lg = trim(full, 0.04)
    w = min(900, lg.width)
    lg.resize((w, round(lg.height * w / lg.width)), Image.LANCZOS).save(UI / 'madatech-logo.png', optimize=True)

    print('symbol: x', box[0], '-', box[2] - 1, 'y', box[1], '-', box[3] - 1, 'from', LOGO.name)
    print('icon:', ICON_SIZES, '-> resources/icon.ico; 256 -> resources/icon.png, assets/brand/diwan-icon.png')
    print('mark:', mark.size, '-> assets/brand/diwan-mark.png')
    print('logo:', lg.size, '-> assets/brand/madatech-logo.png')


if __name__ == '__main__':
    main()
