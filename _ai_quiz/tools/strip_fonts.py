# -*- coding: utf-8 -*-
"""移除 pptx 中未使用的内嵌字体子集（模板的南宋书局体），大幅缩小文件体积。"""
import zipfile
import os
from lxml import etree

SRC = r"F:\cursor20260624\output\站前小学一年级新生家长会_政教处分享.pptx"
TMP = SRC + ".tmp"
PRES = "ppt/presentation.xml"
PRES_RELS = "ppt/_rels/presentation.xml.rels"
P_NS = "http://schemas.openxmlformats.org/presentationml/2006/main"
R_NS = "http://schemas.openxmlformats.org/package/2006/relationships"

with zipfile.ZipFile(SRC) as zin:
    items = zin.namelist()
    pres = zin.read(PRES)
    rels = zin.read(PRES_RELS) if PRES_RELS in items else None

# 1) presentation.xml：删掉 embeddedFontLst
root = etree.fromstring(pres)
for el in root.findall("{%s}embeddedFontLst" % P_NS):
    root.remove(el)
pres_new = etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=True)

# 2) presentation.xml.rels：删掉指向 fonts 的关系
rels_new = None
if rels is not None:
    rroot = etree.fromstring(rels)
    for el in list(rroot):
        if el.get("Target", "").startswith("../fonts/"):
            rroot.remove(el)
    rels_new = etree.tostring(rroot, xml_declaration=True, encoding="UTF-8", standalone=True)

with zipfile.ZipFile(SRC) as zin, zipfile.ZipFile(TMP, "w", zipfile.ZIP_DEFLATED) as zout:
    for item in items:
        if item.startswith("ppt/fonts/"):
            continue
        data = zin.read(item)
        if item == PRES:
            data = pres_new
        elif item == PRES_RELS and rels_new is not None:
            data = rels_new
        zout.writestr(item, data)

import time
for attempt in range(8):
    try:
        os.replace(TMP, SRC)
        break
    except PermissionError:
        time.sleep(1)
else:
    # 目标被占用：先删再改名
    for _ in range(8):
        try:
            os.remove(SRC)
            os.rename(TMP, SRC)
            break
        except PermissionError:
            time.sleep(1)
print("done, new size:", os.path.getsize(SRC), "bytes")
