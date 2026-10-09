"""deform_conv2d من عمليّاتٍ معياريّة (grid_sample و1×1) — يُصدَّر إلى ONNX، ويطابق torchvision (`python deform_py.py` يقارنهما)."""
import torch
import torch.nn.functional as F

def _pair(v):
    return (v, v) if isinstance(v, int) else tuple(v)

def deform_conv2d_py(input, offset, weight, bias=None, stride=(1, 1), padding=(0, 0), dilation=(1, 1), mask=None):
    B, C, H, W = input.shape
    O, _, kh, kw = weight.shape
    sh, sw = _pair(stride); ph, pw = _pair(padding); dh, dw = _pair(dilation)
    Ho = (H + 2 * ph - dh * (kh - 1) - 1) // sh + 1
    Wo = (W + 2 * pw - dw * (kw - 1) - 1) // sw + 1
    ys = (torch.arange(Ho, dtype=input.dtype) * sh - ph).view(1, Ho, 1)
    xs = (torch.arange(Wo, dtype=input.dtype) * sw - pw).view(1, 1, Wo)
    out = None
    for i in range(kh):
        for j in range(kw):
            k = i * kw + j
            py = ys + i * dh + offset[:, 2 * k]
            px = xs + j * dw + offset[:, 2 * k + 1]
            grid = torch.stack([2 * px / (W - 1) - 1, 2 * py / (H - 1) - 1], dim=-1)
            s = F.grid_sample(input, grid, mode='bilinear', padding_mode='zeros', align_corners=True)
            if mask is not None:
                s = s * mask[:, k:k + 1]
            y = F.conv2d(s, weight[:, :, i:i + 1, j:j + 1])
            out = y if out is None else out + y
    if bias is not None:
        out = out + bias.view(1, -1, 1, 1)
    return out

if __name__ == '__main__':
    from torchvision.ops import deform_conv2d
    torch.manual_seed(0)
    for (kh, pad, H) in [(3, 1, 17), (7, 3, 23), (1, 0, 9)]:
        x = torch.randn(2, 8, H, H + 3); w = torch.randn(5, 8, kh, kh); b = torch.randn(5)
        off = torch.randn(2, 2 * kh * kh, H, H + 3) * 2; m = torch.rand(2, kh * kh, H, H + 3) * 2
        a = deform_conv2d(x, off, w, b, padding=pad, mask=m); c = deform_conv2d_py(x, off, w, b, padding=(pad, pad), mask=m)
        print(kh, tuple(a.shape), float((a - c).abs().max()))
