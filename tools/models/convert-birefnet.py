"""
نموذج فصل الأشياء عن خلفيّتها (DESIGNS.md ٢٫٣) — من أوزان BiRefNet_lite-matting الأصلية إلى الملفّ الذي يحمله البرنامج:
`resources/models/birefnet-lite-matting-q8.onnx`. يُجرى مرّةً على جهاز التطوير، ولا يدخل البرنامج منه شيء.

  python -m venv venv && venv/Scripts/pip install torch==2.5.1 torchvision==0.20.1 --index-url https://download.pytorch.org/whl/cpu
  venv/Scripts/pip install transformers==4.46.3 timm==1.0.11 kornia==0.7.4 einops==0.8.0 safetensors==0.4.5 onnx==1.17.0 onnxruntime==1.20.1
  python convert-birefnet.py <مجلّد الحزمة> <model.safetensors> <الناتج.onnx>

ومجلّد الحزمة فيه `birefnet_lm/` بملفّي النموذج من https://huggingface.co/ZhengPeng7/BiRefNet_lite-matting (`birefnet.py`
و`BiRefNet_config.py`) و`__init__.py` فارغ.

الخطوات: الالتفاف المشوَّه (`torchvision.ops.deform_conv2d`) لا يُصدَّر إلى ONNX، فيُستبدل بمثيله من عمليّاتٍ معياريّة
(`deform_py.py`، يطابقه بفرقٍ ٠٫٠٠٠٠٥)؛ ثم التصدير بمقاسٍ ثابت ٥١٢ والناتج احتمالٌ (sigmoid)؛ ثم تهيئة ONNX Runtime (تُسقط
نسخ الأوزان المكرَّرة وتطوي الثوابت)؛ ثم ٨ بتّات للضرب والالتفاف (١٨٣ ← ٥٣ م.ب، والدقّة كما هي — `NOTICE.md`).
"""
import os
import sys
import tempfile

import torch
from safetensors.torch import load_file
from onnxruntime.quantization import QuantType, quantize_dynamic
from onnxruntime.quantization.shape_inference import quant_pre_process

SIZE = 512
pkg, weights, out = sys.argv[1:4]
sys.path.insert(0, pkg)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import birefnet_lm.birefnet as bm  # noqa: E402
from birefnet_lm.BiRefNet_config import BiRefNetConfig  # noqa: E402
from deform_py import deform_conv2d_py  # noqa: E402

model = bm.BiRefNet(config=BiRefNetConfig(bb_pretrained=False))
model.load_state_dict(load_file(weights))
model.eval()
bm.deform_conv2d = deform_conv2d_py


class Matte(torch.nn.Module):
    """الناتج الأخير احتمالًا بين ٠ و١ — ما يقرؤه البرنامج قناعًا."""

    def __init__(self, m):
        super().__init__()
        self.m = m

    def forward(self, x):
        return self.m(x)[-1].sigmoid()


with tempfile.TemporaryDirectory() as tmp:
    raw, pre = os.path.join(tmp, 'raw.onnx'), os.path.join(tmp, 'pre.onnx')
    torch.onnx.export(Matte(model).eval(), torch.randn(1, 3, SIZE, SIZE), raw, opset_version=17, input_names=['input'], output_names=['output'], do_constant_folding=True)
    quant_pre_process(raw, pre, skip_symbolic_shape=True)
    quantize_dynamic(pre, out, weight_type=QuantType.QUInt8, op_types_to_quantize=['MatMul', 'Gemm', 'Conv'])
print(out, os.path.getsize(out) // 2**20, 'MB')
