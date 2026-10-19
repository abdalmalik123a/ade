use napi::bindgen_prelude::Buffer;
use napi_derive::napi;

#[napi(object)]
pub struct PsdRead {
    pub width: u32,
    pub height: u32,
    pub dpi: Option<f64>,
    pub rgba: Option<Buffer>,
    pub planes: Option<Vec<Buffer>>,
    pub warnings: Vec<String>,
}

#[napi]
pub fn psd_engine_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

pub fn unpack_bits(src: &[u8], mut at: usize, length: usize, out: &mut [u8], to: usize) -> usize {
    let end = (at + length).min(src.len());
    let mut write = to;
    while at < end && write < out.len() {
        let n = src[at] as i8;
        at += 1;
        if n >= 0 {
            let count = (n as usize) + 1;
            for _ in 0..count {
                if at < end && write < out.len() {
                    out[write] = src[at];
                    write += 1;
                    at += 1;
                } else {
                    break;
                }
            }
        } else if n != -128 {
            let count = (1 - (n as i16)) as usize;
            if at < end {
                let value = src[at];
                at += 1;
                for _ in 0..count {
                    if write < out.len() {
                        out[write] = value;
                        write += 1;
                    } else {
                        break;
                    }
                }
            }
        }
    }
    write
}

#[napi]
pub fn read_psd(bytes: Buffer) -> Option<PsdRead> {
    let buf = bytes.as_ref();
    if buf.len() < 26 || &buf[0..4] != b"8BPS" {
        return None;
    }

    let version = u16::from_be_bytes([buf[4], buf[5]]);
    let channels = u16::from_be_bytes([buf[12], buf[13]]) as usize;
    let height = u32::from_be_bytes([buf[14], buf[15], buf[16], buf[17]]);
    let width = u32::from_be_bytes([buf[18], buf[19], buf[20], buf[21]]);
    let depth = u16::from_be_bytes([buf[22], buf[23]]);
    let color_mode = u16::from_be_bytes([buf[24], buf[25]]);

    if version != 1 || width == 0 || height == 0 {
        return None;
    }

    let mut at = 26;
    if at + 4 > buf.len() {
        return None;
    }
    let color_data_len = u32::from_be_bytes([buf[at], buf[at + 1], buf[at + 2], buf[at + 3]]) as usize;
    at += 4 + color_data_len;

    // الموارد: الدقّة في المورد ١٠٠٥
    let mut dpi: Option<f64> = None;
    if at + 4 > buf.len() {
        return None;
    }
    let res_len = u32::from_be_bytes([buf[at], buf[at + 1], buf[at + 2], buf[at + 3]]) as usize;
    let resources_end = at + 4 + res_len;
    let limit = resources_end.min(buf.len());
    let mut res = at + 4;
    while res + 12 <= limit {
        if &buf[res..res + 4] != b"8BIM" {
            break;
        }
        let id = u16::from_be_bytes([buf[res + 4], buf[res + 5]]);
        res += 6;
        let name_length = buf[res] as usize;
        res += if name_length % 2 == 0 {
            name_length + 2
        } else {
            name_length + 1
        };
        if res + 4 > limit {
            break;
        }
        let size = u32::from_be_bytes([buf[res], buf[res + 1], buf[res + 2], buf[res + 3]]) as usize;
        res += 4;
        if id == 1005 && res + 4 <= buf.len() {
            let val = u32::from_be_bytes([buf[res], buf[res + 1], buf[res + 2], buf[res + 3]]) as f64;
            dpi = Some(((val / 65536.0) * 100.0).round() / 100.0);
        }
        res += size + (size % 2);
    }
    at = resources_end;

    // الطبقات تُتخطّى: الصورة المسطَّحة بعدها
    if at + 4 > buf.len() {
        return Some(PsdRead {
            width,
            height,
            dpi,
            rgba: None,
            planes: None,
            warnings: vec!["truncated".to_string()],
        });
    }
    let layers_len = u32::from_be_bytes([buf[at], buf[at + 1], buf[at + 2], buf[at + 3]]) as usize;
    at += 4 + layers_len;

    let supported_modes = [1u16, 3u16, 4u16];
    let mut warnings = Vec::new();
    if depth != 8 {
        warnings.push(format!("depth:{}", depth));
    }
    if !supported_modes.contains(&color_mode) {
        warnings.push(format!("mode:{}", color_mode));
    }
    if at + 2 > buf.len() || depth != 8 || !supported_modes.contains(&color_mode) {
        warnings.push("unreadable".to_string());
        return Some(PsdRead {
            width,
            height,
            dpi,
            rgba: None,
            planes: None,
            warnings,
        });
    }

    let compression = u16::from_be_bytes([buf[at], buf[at + 1]]);
    at += 2;
    let pixels = (width as usize) * (height as usize);
    let mut channel_planes: Vec<Vec<u8>> = Vec::new();

    if compression == 0 {
        for c in 0..channels {
            let mut plane = vec![0u8; pixels];
            let from = at + c * pixels;
            if from + pixels <= buf.len() {
                plane.copy_from_slice(&buf[from..from + pixels]);
            }
            channel_planes.push(plane);
        }
    } else if compression == 1 {
        let rows = (height as usize) * channels;
        let mut lengths = Vec::with_capacity(rows);
        for _ in 0..rows {
            if at + 2 <= buf.len() {
                lengths.push(u16::from_be_bytes([buf[at], buf[at + 1]]) as usize);
                at += 2;
            } else {
                break;
            }
        }
        for c in 0..channels {
            let mut plane = vec![0u8; pixels];
            let mut write = 0;
            for y in 0..height as usize {
                let idx = c * (height as usize) + y;
                let length = if idx < lengths.len() { lengths[idx] } else { 0 };
                if at + length > buf.len() {
                    break;
                }
                write = unpack_bits(buf, at, length, &mut plane, write);
                at += length;
            }
            channel_planes.push(plane);
        }
    } else {
        warnings.push("zip".to_string());
        return Some(PsdRead {
            width,
            height,
            dpi,
            rgba: None,
            planes: None,
            warnings,
        });
    }

    let mut rgba = vec![255u8; pixels * 4];

    if color_mode == 3 {
        // RGB
        let r_plane = channel_planes.get(0);
        let g_plane = channel_planes.get(1);
        let b_plane = channel_planes.get(2);
        let a_plane = channel_planes.get(3);
        for i in 0..pixels {
            if let Some(p) = r_plane { rgba[i * 4] = p[i]; }
            if let Some(p) = g_plane { rgba[i * 4 + 1] = p[i]; }
            if let Some(p) = b_plane { rgba[i * 4 + 2] = p[i]; }
            if let Some(p) = a_plane { rgba[i * 4 + 3] = p[i]; }
        }
    } else if color_mode == 4 {
        // CMYK
        let c_plane = channel_planes.get(0);
        let m_plane = channel_planes.get(1);
        let y_plane = channel_planes.get(2);
        let k_plane = channel_planes.get(3);
        let a_plane = channel_planes.get(4);
        for i in 0..pixels {
            let c = if let Some(p) = c_plane { p[i] as f64 } else { 255.0 };
            let m = if let Some(p) = m_plane { p[i] as f64 } else { 255.0 };
            let y = if let Some(p) = y_plane { p[i] as f64 } else { 255.0 };
            let k = if let Some(p) = k_plane { p[i] as f64 } else { 255.0 };
            rgba[i * 4] = ((c * k / 255.0).round()) as u8;
            rgba[i * 4 + 1] = ((m * k / 255.0).round()) as u8;
            rgba[i * 4 + 2] = ((y * k / 255.0).round()) as u8;
            if let Some(p) = a_plane { rgba[i * 4 + 3] = p[i]; }
        }
    } else if color_mode == 1 {
        // Grayscale
        let g_plane = channel_planes.get(0);
        let a_plane = channel_planes.get(1);
        for i in 0..pixels {
            let g = if let Some(p) = g_plane { p[i] } else { 0 };
            rgba[i * 4] = g;
            rgba[i * 4 + 1] = g;
            rgba[i * 4 + 2] = g;
            if let Some(p) = a_plane { rgba[i * 4 + 3] = p[i]; }
        }
    }

    let colors = if color_mode == 4 { 4 } else if color_mode == 1 { 1 } else { 3 };
    let planes_count = colors.min(channel_planes.len());
    let mut selected_planes = Vec::with_capacity(planes_count);
    for p in channel_planes.into_iter().take(planes_count) {
        selected_planes.push(Buffer::from(p));
    }

    Some(PsdRead {
        width,
        height,
        dpi,
        rgba: Some(Buffer::from(rgba)),
        planes: Some(selected_planes),
        warnings,
    })
}




