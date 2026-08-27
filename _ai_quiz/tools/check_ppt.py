# -*- coding: utf-8 -*-
"""几何检查：文本是否溢出文本框/卡片、文本框之间是否重叠。"""
from PIL import ImageFont
from pptx import Presentation
from pptx.util import Emu, Pt
from pptx.enum.shapes import MSO_SHAPE_TYPE
from pptx.enum.text import PP_ALIGN

SRC = r"F:\cursor20260624\output\站前小学一年级新生家长会_政教处分享.pptx"
KAITI = r"C:\Windows\Fonts\simkai.ttf"
MSYH = r"C:\Windows\Fonts\msyh.ttc"

CARD = (0.47, 0.46, 12.86, 7.04)  # 白卡区域（英寸）
SLIDE_W, SLIDE_H = 13.333, 7.5

cache = {}
def get_font(pt):
    px = int(round(pt * 4))  # 用 4x 分辨率量度更准
    if px not in cache:
        try:
            cache[px] = ImageFont.truetype(KAITI, px)
        except Exception:
            cache[px] = ImageFont.truetype(MSYH, px)
    return cache[px]

def wrap(text, f, max_px):
    line, lines, width = "", [], 0
    for ch in text:
        if ch == "\n":
            lines.append(line); line = ""; continue
        w = f.getlength(line + ch)
        if w > max_px and line:
            lines.append(line); line = ch
        else:
            line += ch
    if line:
        lines.append(line)
    return lines

def est_text(tf):
    """返回 (每行px高度, 总px高度, 行的最大px宽度)。"""
    px_per_in = 4 * 96.0
    total = 0.0
    max_w = 0.0
    for p in tf.paragraphs:
        sz = (p.runs[0].font.size.pt if p.runs and p.runs[0].font.size else 18)
        ls = p.line_spacing if p.line_spacing else 1.0
        lh = sz * 1.35 * ls * (96.0 / 72.0)  # pt->px 线条高
        spa = (p.space_after.pt if p.space_after else 0) * (96.0 / 72.0)
        text = "".join(r.text for r in p.runs)
        f = get_font(sz)
        # 用盒子宽度换行（px）
        max_px = 0
        for r in p.runs:
            max_px += r.font.size.pt if r.font.size else 18
        total += lh + spa
        # 文本内容宽度
        for ln in wrap(text, f, 1e9):
            max_w = max(max_w, f.getlength(ln))
    return total, max_w

prs = Presentation(SRC)
IN = 96.0  # 每英寸像素
issues = []
for si, slide in enumerate(prs.slides):
    boxes = []  # (name, l,t,r,b)
    for sh in slide.shapes:
        if sh.left is None:
            continue
        l = Emu(sh.left).inches; t = Emu(sh.top).inches
        w = Emu(sh.width).inches; h = Emu(sh.height).inches
        r = l + w; b = t + h
        if sh.has_text_frame and sh.shape_type == MSO_SHAPE_TYPE.TEXT_BOX:
            # 估算文本是否溢出盒子
            tf = sh.text_frame
            total_px, _ = est_text(tf)
            total_in = total_px / IN
            is_autofit = False
            bodyPr = tf._txBody.find('{http://schemas.openxmlformats.org/drawingml/2006/main}bodyPr')
            if bodyPr is not None and bodyPr.find('{http://schemas.openxmlformats.org/drawingml/2006/main}spAutoFit') is not None:
                is_autofit = True
            if not is_autofit and total_in > h + 0.05:
                issues.append(f"[S{si+1}] {sh.name} 文本高度≈{total_in:.2f}in > 盒高 {h:.2f}in，可能溢出")
            # 盒子出界检查
            if r > SLIDE_W + 0.05 or b > SLIDE_H + 0.05 or l < -0.2:
                issues.append(f"[S{si+1}] {sh.name} 盒子出界 l={l:.2f} t={t:.2f} r={r:.2f} b={b:.2f}")
            boxes.append((sh.name, l, t, r, b))
        elif sh.shape_type == MSO_SHAPE_TYPE.PICTURE:
            if b > SLIDE_H + 0.05 or r > SLIDE_W + 0.05:
                issues.append(f"[S{si+1}] 图片 {sh.name} 出界 r={r:.2f} b={b:.2f}")
    # 文本框两两重叠
    for i in range(len(boxes)):
        for j in range(i + 1, len(boxes)):
            a, b = boxes[i], boxes[j]
            ox = min(a[3], b[3]) - max(a[1], b[1])
            oy = min(a[4], b[4]) - max(a[2], b[2])
            if ox > 0.15 and oy > 0.15:
                issues.append(f"[S{si+1}] 文本框重叠: {a[0]} & {b[0]} (重叠 {ox:.2f}x{oy:.2f}in)")

if issues:
    print("发现 %d 个问题：" % len(issues))
    for x in issues:
        print(" ", x)
else:
    print("未发现问题。")
