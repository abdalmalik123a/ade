"""
يصنع صور الهوية من أصولها (خطة Production، ٦٫١) — مرّةً حين تتغيّر الأصول، لا مع كلّ بناء:

    python tools/make-brand.py

- **أيقونة «ديوان»**: الأصل (resources/brand/source/diwan-icon.jpg) مربّعٌ مستدير الأركان على رقعة شطرنجٍ
  مرسومةٍ في الصورة — لا شفافيّة حقيقية — وتحته ظلّ. فيُقصّ المربّع على حدوده (٢٠٠..١٨٠٠ في صورة ٢٠٠٠)،
  وتُرسم أركانه بقناعٍ مستدير نصف قطره ٣٤٠ (قيس من الأصل) بحوافّ ناعمة — ثم أيقونة ويندوز بمقاساتها،
  وصورةٌ للواجهة.
- **شعار MADA TECH**: الأصل على خلفيّةٍ سوداء؛ فالأسود يصير شفّافًا («اللون إلى شفافيّة»: الشفافيّة من
  أسطع القنوات، واللون يُقسم عليها فلا يبقى هالةٌ رمادية)، ويُقصّ على ما فيه. وحروفه البيضاء لا تُرى على
  ورقٍ فاتح — فيُعرض على بطاقةٍ داكنة («عن البرنامج»).

والأصول لا تُحزم في المثبّت؛ ما يُحزم هو ما يُكتب هنا.
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'resources' / 'brand' / 'source'
UI = ROOT / 'src' / 'renderer' / 'src' / 'assets' / 'brand'

TILE = (200, 200, 1800, 1800)
RADIUS = 340
INSET = 3  # الحافّة الفاتحة على حدّ المربّع في الأصل لا تُبقى هالةً حوله


def rounded_mask(size: int, radius: int, scale: int = 4) -> Image.Image:
    big = Image.new('L', (size * scale, size * scale), 0)
    ImageDraw.Draw(big).rounded_rectangle((0, 0, size * scale - 1, size * scale - 1), radius=radius * scale, fill=255)
    return big.resize((size, size), Image.LANCZOS)


def icon() -> Image.Image:
    src = Image.open(SRC / 'diwan-icon.jpg').convert('RGB')
    x0, y0, x1, y1 = TILE
    tile = src.crop((x0 + INSET, y0 + INSET, x1 - INSET, y1 - INSET))
    out = tile.convert('RGBA')
    out.putalpha(rounded_mask(tile.width, RADIUS - INSET))
    return out


def logo() -> Image.Image:
    src = Image.open(SRC / 'madatech-logo.jpg').convert('RGB')
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
        k = 255 / max(m, 1)  # اللون مقسومًا على شفافيّته: الأبيض أبيض والأزرق أزرق، بلا رماديّ
        data.append((min(255, round(r * k)), min(255, round(g * k)), min(255, round(b * k)), a))
    rgba.putdata(data)
    box = rgba.getchannel('A').point(lambda v: 255 if v > 12 else 0).getbbox()
    pad = round(0.04 * max(box[2] - box[0], box[3] - box[1]))
    box = (max(0, box[0] - pad), max(0, box[1] - pad), min(src.width, box[2] + pad), min(src.height, box[3] + pad))
    return rgba.crop(box)


def main() -> None:
    UI.mkdir(parents=True, exist_ok=True)
    ic = icon()
    ic.resize((512, 512), Image.LANCZOS).save(ROOT / 'resources' / 'icon.png')
    ic.resize((256, 256), Image.LANCZOS).save(
        ROOT / 'resources' / 'icon.ico', sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    )
    ic.resize((256, 256), Image.LANCZOS).save(UI / 'diwan-icon.png', optimize=True)
    lg = logo()
    w = min(900, lg.width)
    lg.resize((w, round(lg.height * w / lg.width)), Image.LANCZOS).save(UI / 'madatech-logo.png', optimize=True)
    print('icon:', ic.size, '-> resources/icon.ico, resources/icon.png, assets/brand/diwan-icon.png')
    print('logo:', lg.size, '-> assets/brand/madatech-logo.png')


if __name__ == '__main__':
    main()
