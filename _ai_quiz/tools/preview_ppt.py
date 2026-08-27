# -*- coding: utf-8 -*-
"""用 PIL 把生成的 PPT 渲染成 PNG 预览（用于检查排版/重叠）。"""
import os
from PIL import Image, ImageDraw, ImageFont
from pptx import Presentation
from pptx.util import Emu
from pptx.enum.shapes import MSO_SHAPE_TYPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.oxml.ns import qn

SRC = r"F:\cursor20260624\output\站前小学一年级新生家长会_政教处分享.pptx"
OUT = r"F:\cursor20260624\output\preview"
os.makedirs(OUT, exist_ok=True)

W, H = 1333, 750
KAITI = r"C:\Windows\Fonts\simkai.ttf"
MSYH = r"C:\Windows\Fonts\msyh.ttc"

font_cache = {}
def get_font(size_px):
    key = int(size_px)
    if key not in font_cache:
        try:
            font_cache[key] = ImageFont.truetype(KAITI, key)
        except Exception:
            font_cache[key] = ImageFont.truetype(MSYH, key)
    return font_cache[key]

def emu2px(v):
    return int(round(Emu(v).inches * 100))  # 1333 / 13.333 = 100

def shape_geom(sh):
    return (emu2px(sh.left), emu2px(sh.top), emu2px(sh.width), emu2px(sh.height))

def solid_color(sh):
    try:
        if sh.fill.type == 1:  # solid
            c = sh.fill.fore_color.rgb
            return (c[0], c[1], c[2])
    except Exception:
        pass
    return None

def draw_text(draw, x, y, w, h, tf, scale=1.0):
    paras = []
    for p in tf.paragraphs:
        runs = []
        for r in p.runs:
            sz = r.font.size.pt if r.font.size else 18
            col = None
            try:
                if r.font.color and r.font.color.type is not None:
                    col = tuple(r.font.color.rgb)
            except Exception:
                pass
            b = bool(r.font.bold)
            runs.append((r.text, sz, col, b))
        if runs:
            paras.append((runs, p.alignment, p.space_after.pt if p.space_after else 0,
                          p.line_spacing if p.line_spacing else 1.0))
    # 计算文本总高（用于垂直居中）
    total_h = 0.0
    line_heights = []
    for runs, al, spa, ls in paras:
        ph = 0.0
        for text, sz, col, b in runs:
            f = get_font(sz * scale)
            # 逐字符换行
            lh = sz * 1.35 * ls
            ph += lh
        total_h += ph + spa
    anchor = tf.vertical_anchor
    ty = y
    if anchor == MSO_ANCHOR.MIDDLE:
        ty = y + (h - total_h) / 2
    elif anchor == MSO_ANCHOR.BOTTOM:
        ty = y + (h - total_h)
    cx = x + 6
    cw = w - 12
    for runs, al, spa, ls in paras:
        for text, sz, col, b in runs:
            f = get_font(sz * scale)
            lh = sz * 1.35 * ls
            # 字符级换行
            line = ""
            lines = []
            for ch in text:
                test = line + ch
                tw = draw.textlength(test, font=f)
                if tw > cw and line:
                    lines.append(line)
                    line = ch
                else:
                    line = test
            if line:
                lines.append(line)
            for ln in lines:
                tw = draw.textlength(ln, font=f)
                lx = cx
                if al == PP_ALIGN.CENTER:
                    lx = cx + (cw - tw) / 2
                elif al == PP_ALIGN.RIGHT:
                    lx = cx + (cw - tw)
                draw.text((lx, ty), ln, font=f, fill=(col if col else (0,0,0)))
                ty += lh
        ty += spa

prs = Presentation(SRC)
for si, slide in enumerate(prs.slides):
    img = Image.new("RGBA", (W, H), (255, 255, 255, 255))
    draw = ImageDraw.Draw(img)
    for sh in slide.shapes:
        x, y, w, h = shape_geom(sh)
        st = sh.shape_type
        if st == MSO_SHAPE_TYPE.AUTO_SHAPE:
            fill = solid_color(sh)
            if fill is None:
                fill = (255, 255, 255)
            prst = ""
            prstEl = sh._element.spPr.find(qn("a:prstGeom"))
            if prstEl is not None:
                prst = prstEl.get("prst") or ""
            radius = min(26, h // 4) if prst == "roundRect" else 0
            if radius:
                draw.rounded_rectangle([x, y, x + w, y + h], radius=radius, fill=fill)
            else:
                draw.rectangle([x, y, x + w, y + h], fill=fill)
            # 边框
            try:
                lc = sh.line.color.rgb
                lw = max(1, int(sh.line.width.pt))
            except Exception:
                lc, lw = None, 0
            if lc:
                if radius:
                    draw.rounded_rectangle([x, y, x + w, y + h], radius=radius,
                                           outline=tuple(lc), width=lw)
                else:
                    draw.rectangle([x, y, x + w, y + h], outline=tuple(lc), width=lw)
        elif st == MSO_SHAPE_TYPE.PICTURE:
            try:
                blob = sh.image.blob
                from io import BytesIO
                im = Image.open(BytesIO(blob)).convert("RGBA")
                im = im.resize((w, h))
                fl = sh._element.find(".//{http://schemas.openxmlformats.org/drawingml/2006/main}xfrm")
                if fl is not None and fl.get("flipH") == "1":
                    im = im.transpose(Image.FLIP_LEFT_RIGHT)
                if fl is not None and fl.get("flipV") == "1":
                    im = im.transpose(Image.FLIP_TOP_BOTTOM)
                img.paste(im, (x, y), im)
            except Exception as e:
                draw.rectangle([x, y, x + w, y + h], fill=(200, 200, 200))
        elif st == MSO_SHAPE_TYPE.TEXT_BOX:
            draw_text(draw, x, y, w, h, sh.text_frame)
    # 白底输出
    img.convert("RGB").save(os.path.join(OUT, f"slide{si+1}.png"))
    print("rendered slide", si + 1)
