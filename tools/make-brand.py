"""
يصنع صور الهوية — مرّةً حين تتغيّر الهوية، لا مع كلّ بناء:

    python tools/make-brand.py

- **شعار «ديوان» وأيقونته** (أرسله المالك ١٣ ت١ ٢٠٢٦): الأصل `resources/brand/source/diwan-logo.ico` بمقاساته السبعة
  (١٦ إلى ٢٥٦) كما رسمها مصمّمه — فأيقونة ويندوز (`resources/icon.ico`) نسخته كما هي بلا إعادة تصغير، و`icon.png` وصورة الواجهة
  (`diwan-icon.png`) مقاسه الأكبر ٢٥٦ بلا تكبير. و**علامته** للعلامة المائية الخافتة في الشبّاك (`diwan-mark.png`) هو نفسه بلا خلفيّته
  الكحليّة («اللون إلى شفافيّة» من لون الزاوية — فلا يبقى مربّعٌ باهت خلف العمل).
- **شعار MADA TECH** (المطوّر): الأصل (resources/brand/source/madatech-logo.jpg) على خلفيّةٍ سوداء؛ فالأسود يصير
  شفّافًا («اللون إلى شفافيّة»: الشفافيّة من أسطع القنوات، واللون يُقسم عليها فلا يبقى هالةٌ رمادية)،
  ويُقصّ على ما فيه. وحروفه البيضاء لا تُرى على ورقٍ فاتح — فيُعرض على بطاقةٍ داكنة.

والأصول لا تُحزم في المثبّت؛ ما يُحزم هو ما يُكتب هنا.
"""
import shutil
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'resources' / 'brand' / 'source'
UI = ROOT / 'src' / 'renderer' / 'src' / 'assets' / 'brand'
LOGO = SRC / 'diwan-logo.ico'


def logo_at(size: int) -> Image.Image:
    """مقاسٌ من الأيقونة كما رسمه مصمّمها — لا تصغيرٌ من الأكبر."""
    im = Image.open(LOGO)
    im.size = (size, size)
    im.load()
    return im.convert('RGBA')


def without_background(im: Image.Image) -> Image.Image:
    """الخلفية (لون الزاوية) شفّافة: الشفافيّة من بُعد البكسل عن لونها (أقصى فرقٍ في قناة) — ما دون ٨ خلفيةٌ تامّة، وما فوق
    ٤٠ معتمٌ تامّ. والقسمة على قنوات الكحليّ الصغيرة (الأحمر ٤) كانت تضخّم فروق الضغط الخفيفة نقاطًا ظاهرة — فلا قسمة."""
    bg = im.getpixel((0, 0))[:3]
    out = []
    pixels = im.get_flattened_data() if hasattr(im, 'get_flattened_data') else im.getdata()
    for r, g, b, _ in pixels:
        d = max(abs(r - bg[0]), abs(g - bg[1]), abs(b - bg[2]))
        a = max(0.0, min(1.0, (d - 8) / 32))
        out.append((r, g, b, round(a * 255)) if a else (0, 0, 0, 0))
    res = Image.new('RGBA', im.size)
    res.putdata(out)
    return res


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
    shutil.copyfile(LOGO, ROOT / 'resources' / 'icon.ico')
    big = logo_at(256)
    big.save(ROOT / 'resources' / 'icon.png', optimize=True)
    big.save(UI / 'diwan-icon.png', optimize=True)
    mark = trim(without_background(big), 0.02)
    mark.save(UI / 'diwan-mark.png', optimize=True)

    full = transparent(Image.open(SRC / 'madatech-logo.jpg').convert('RGB'))
    lg = trim(full, 0.04)
    w = min(900, lg.width)
    lg.resize((w, round(lg.height * w / lg.width)), Image.LANCZOS).save(UI / 'madatech-logo.png', optimize=True)

    print('icon:', LOGO.name, '-> resources/icon.ico, resources/icon.png, assets/brand/diwan-icon.png')
    print('mark:', mark.size, '-> assets/brand/diwan-mark.png')
    print('logo:', lg.size, '-> assets/brand/madatech-logo.png')


if __name__ == '__main__':
    main()
