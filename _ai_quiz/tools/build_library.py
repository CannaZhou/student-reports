# -*- coding: utf-8 -*-
"""
名家绘本 → 网页漫画页 构建脚本

把 4 本《未来侦探团》电子书（3 EPUB + 1 PDF）拆成按章的小图：
    app/media/books/<bookId>/cover.webp
    app/media/books/<bookId>/ch01/001.webp ...
并生成清单 app/content/library.json

用法（必须用 -I，避免当前目录的 json.py 之类被优先导入）：
    python -I tools/build_library.py --report --dry-run
    python -I tools/build_library.py
    python -I tools/build_library.py --rebuild --only fd-ai

注意：
- 页序以 EPUB 的 toc.ncx / xhtml 中 <img> 的出现顺序为准，不能按文件名排序。
- 只取「第X章」正文；前言、人物介绍、版权页、封底一律跳过。
"""
import argparse
import hashlib
import io
import json
import os
import posixpath
import re
import sys
import zipfile
from urllib.parse import unquote

from PIL import Image
import fitz  # PyMuPDF

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
MEDIA_DIR = os.path.join(ROOT, 'app', 'media', 'books')
CONTENT_DIR = os.path.join(ROOT, 'app', 'content')
MANIFEST = os.path.join(CONTENT_DIR, 'library.json')
REPORT = os.path.join(ROOT, 'tools', '_library_build_report.txt')

DEFAULT_SRC = r'f:\桌面\临时存放\桌面所有图标\2025年师生共读书本活动\阅读之路启动'

BOOKS = [
    {
        'id': 'fd-ai',
        'file': '未来侦探团之人工智能篇 机器少年_9787115574107.epub',
        'title': '未来侦探团·人工智能篇',
        'subtitle': '机器少年',
        'isbn': '9787115574107',
        'spine': '#2f5d8a',
    },
    {
        'id': 'fd-sat',
        'file': '未来侦探团之卫星篇 北斗星的指引_9787115575319.epub',
        'title': '未来侦探团·卫星篇',
        'subtitle': '北斗星的指引',
        'isbn': '9787115575319',
        'spine': '#1f6f78',
    },
    {
        'id': 'fd-data',
        'file': '未来侦探团之大数据篇 数据战队 千鹤动漫,.pdf',
        'title': '未来侦探团·大数据篇',
        'subtitle': '数据战队',
        'isbn': '9787115577344',
        'spine': '#7a4b8f',
    },
    {
        'id': 'fd-disaster',
        'file': '未来侦探团之防灾救灾篇 大自然的复仇 千鹤动漫, 9787115581693(1).epub',
        'title': '未来侦探团·防灾救灾篇',
        'subtitle': '大自然的复仇',
        'isbn': '9787115581693',
        'spine': '#b1541f',
    },
]

WIDTH = 880
QUALITY = 60
HARD_QUALITY = 55
MAX_BYTES = 150 * 1024
MIN_BYTES = 15 * 1024
COVER_WIDTH = 600
COVER_QUALITY = 82

CN_NUM = '一二三四五六七八九十'
RE_CHAPTER = re.compile(r'^第[%s]+章' % CN_NUM)


# ---------------------------------------------------------------- 工具

def log(*a):
    print(*a)


def read_zip_text(z, name):
    return z.read(name).decode('utf-8', 'replace')


def zip_find(z, path):
    """大小写不敏感地找一个 zip 条目，返回真实名字。"""
    try:
        z.getinfo(path)
        return path
    except KeyError:
        low = path.lower()
        for n in z.namelist():
            if n.lower() == low:
                return n
    raise KeyError(path)


def encode_page(im, quality=QUALITY, width=WIDTH):
    im = im.convert('RGB')
    if im.width > width:
        h = int(round(im.height * width / im.width))
        im = im.resize((width, h), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, 'WEBP', quality=quality, method=6)
    data = buf.getvalue()
    if len(data) > MAX_BYTES and quality > HARD_QUALITY:
        buf = io.BytesIO()
        im.save(buf, 'WEBP', quality=HARD_QUALITY, method=6)
        data = buf.getvalue()
    return data


def save_bytes(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as f:
        f.write(data)


# ---------------------------------------------------------------- EPUB

def epub_nav(z):
    """返回 [(title, xhtml_path)]，按 navPoint 顺序。"""
    ncx_name = None
    for n in z.namelist():
        if n.lower().endswith('.ncx'):
            ncx_name = n
            break
    if not ncx_name:
        raise RuntimeError('EPUB 里找不到 toc.ncx')
    raw = read_zip_text(z, ncx_name)
    base = posixpath.dirname(ncx_name)
    out = []
    for m in re.finditer(
            r'<navPoint\b.*?<navLabel>\s*<text>(.*?)</text>\s*</navLabel>\s*'
            r'<content\s+src="([^"]+)"', raw, re.S):
        title = re.sub(r'<[^>]+>', '', m.group(1)).strip()
        src = posixpath.normpath(posixpath.join(base, unquote(m.group(2))))
        out.append((title, src))
    return out


def epub_spine(z):
    """按 spine 顺序返回 xhtml 列表。"""
    opf_name = None
    for n in z.namelist():
        if n.lower().endswith('.opf'):
            opf_name = n
            break
    if not opf_name:
        raise RuntimeError('EPUB 里找不到 .opf')
    opf = read_zip_text(z, opf_name)
    base = posixpath.dirname(opf_name)
    manifest = {}
    for m in re.finditer(r'<item\b[^>]*>', opf):
        tag = m.group(0)
        idm = re.search(r'\bid="([^"]+)"', tag)
        href = re.search(r'\bhref="([^"]+)"', tag)
        if idm and href:
            manifest[idm.group(1)] = posixpath.normpath(
                posixpath.join(base, unquote(href.group(1))))
    order = []
    for m in re.finditer(r'<itemref\b[^>]*\bidref="([^"]+)"', opf):
        p = manifest.get(m.group(1))
        if p:
            order.append(p)
    return order


RE_TAIL = re.compile(r'(postface|backcover|back_cover|afterword|colophon)', re.I)


def is_content_section(path):
    """正文之外的结尾页（封底、版权等）不进章节。"""
    base = posixpath.basename(path).lower()
    return not RE_TAIL.search(base)


def images_in_section(z, section):
    raw = read_zip_text(z, section)
    out = []
    for m in re.finditer(r'<img\b[^>]*\bsrc="([^"]+)"', raw):
        p = posixpath.normpath(posixpath.join(posixpath.dirname(section), unquote(m.group(1))))
        out.append(p)
    return out


def load_epub_pages(path):
    """返回 (chapters, cover_bytes)，chapters=[{no,title,pages:[bytes]}]"""
    z = zipfile.ZipFile(path)
    nav = epub_nav(z)
    spine = epub_spine(z)
    spine_idx = {p: i for i, p in enumerate(spine)}

    # nav 里章节条目
    chapter_nav = [(t, s) for t, s in nav if RE_CHAPTER.match(t)]
    if not chapter_nav:
        raise RuntimeError('没找到「第X章」目录项')

    chapters = []
    for i, (title, src) in enumerate(chapter_nav):
        if src not in spine_idx:
            raise RuntimeError('章节不在 spine 里: %s' % src)
        start = spine_idx[src]
        if i + 1 < len(chapter_nav):
            nxt = chapter_nav[i + 1][1]
            end = spine_idx.get(nxt, len(spine))
        else:
            # 最后一章：到下一个非章节 nav 点（创作团队介绍/封底）或结尾
            end = len(spine)
            pos = nav.index((title, src))
            for t2, s2 in nav[pos + 1:]:
                if s2 in spine_idx:
                    end = spine_idx[s2]
                    break
        imgs = []
        for sec in spine[start:end]:
            if not is_content_section(sec):
                break
            imgs.extend(images_in_section(z, sec))
        pages = []
        for rel in imgs:
            real = zip_find(z, rel)
            raw = z.read(real)
            im = Image.open(io.BytesIO(raw))
            pages.append(encode_page(im))
        if not pages:
            raise RuntimeError('章节没有图片: %s' % title)
        chapters.append({'no': i + 1, 'title': re.sub(r'^第[%s]+章\s*' % CN_NUM, '', title),
                         'chapterTitle': title.replace('  ', ' '), 'pages': pages})

    # 封面：优先 Images/cover.jpg
    cover = None
    for n in z.namelist():
        if n.lower().endswith(('cover.jpg', 'cover.jpeg', 'cover.png')):
            im = Image.open(io.BytesIO(z.read(n)))
            cover = encode_page(im, quality=COVER_QUALITY, width=COVER_WIDTH)
            break
    if cover is None and chapters:
        cover = encode_page(Image.open(io.BytesIO(chapters[0]['pages'][0])),
                            quality=COVER_QUALITY, width=COVER_WIDTH)
    return chapters, cover


# ---------------------------------------------------------------- PDF

def load_pdf_pages(path):
    doc = fitz.open(path)
    toc = doc.get_toc()
    chapter_items = [x for x in toc if RE_CHAPTER.match(x[1])]
    if not chapter_items:
        raise RuntimeError('PDF 没有可用的章节大纲')

    chapters = []
    for i, (_, title, start_page) in enumerate(chapter_items):
        if i + 1 < len(chapter_items):
            end_page = chapter_items[i + 1][2] - 1
        else:
            end_page = doc.page_count
            for _, t2, p2 in toc:
                if p2 > start_page:
                    end_page = p2 - 1
                    break
        pages = []
        for pno in range(start_page - 1, end_page):
            page = doc[pno]
            imgs = page.get_images(full=True)
            if not imgs:
                continue
            info = doc.extract_image(imgs[0][0])
            if not info or not info.get('image'):
                continue
            im = Image.open(io.BytesIO(info['image']))
            pages.append(encode_page(im))
        if not pages:
            raise RuntimeError('章节没有图片: %s' % title)
        chapters.append({'no': i + 1, 'title': re.sub(r'^第[%s]+章\s*' % CN_NUM, '', title),
                         'chapterTitle': re.sub(r'\s+', ' ', title), 'pages': pages})

    cover = None
    page0 = doc[0]
    imgs = page0.get_images(full=True)
    if imgs:
        info = doc.extract_image(imgs[0][0])
        im = Image.open(io.BytesIO(info['image']))
        cover = encode_page(im, quality=COVER_QUALITY, width=COVER_WIDTH)
    return chapters, cover


# ---------------------------------------------------------------- 主流程

def build_one(book, src_dir, rebuild, dry=False):
    path = os.path.join(src_dir, book['file'])
    if not os.path.exists(path):
        raise RuntimeError('源文件不存在: %s' % path)
    log('· 解析 %s' % book['file'])
    if book['file'].lower().endswith('.pdf'):
        chapters, cover = load_pdf_pages(path)
    else:
        chapters, cover = load_epub_pages(path)

    out_root = os.path.join(MEDIA_DIR, book['id'])
    total_bytes = 0
    ch_meta = []
    for ch in chapters:
        d = os.path.join(out_root, 'ch%02d' % ch['no'])
        os.makedirs(d, exist_ok=True)
        for idx, data in enumerate(ch['pages'], 1):
            fp = os.path.join(d, '%03d.webp' % idx)
            if dry:
                total_bytes += len(data)
                continue
            if rebuild or not os.path.exists(fp):
                save_bytes(fp, data)
            total_bytes += os.path.getsize(fp)
        ch_meta.append({
            'no': ch['no'],
            'title': ch['title'],
            'chapterTitle': ch['chapterTitle'],
            'dir': 'ch%02d' % ch['no'],
            'pageCount': len(ch['pages']),
        })

    if cover:
        if not dry:
            save_bytes(os.path.join(out_root, 'cover.webp'), cover)
        total_bytes += len(cover)

    n_pages = sum(c['pageCount'] for c in ch_meta)
    avg = total_bytes / max(1, n_pages)
    log('  → %d 章 %d 页，%.1f MB，平均 %.0f KB/页' % (
        len(chapters), n_pages,
        total_bytes / 1048576.0, avg / 1024.0))

    h = hashlib.sha1()
    for c in ch_meta:
        h.update(('%s/%s/%d;' % (book['id'], c['dir'], c['pageCount'])).encode())
    h.update(str(total_bytes).encode())
    return {
        'id': book['id'],
        'title': book['title'],
        'subtitle': book['subtitle'],
        'series': '未来侦探团',
        'author': '千鹤动漫 编绘',
        'publisher': '人民邮电出版社',
        'isbn': book['isbn'],
        'spine': book['spine'],
        'cover': 'cover.webp',
        'intro': '',
        'chapters': ch_meta,
    }, h.hexdigest()[:8], total_bytes


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default=DEFAULT_SRC)
    ap.add_argument('--only', default='')
    ap.add_argument('--rebuild', action='store_true')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--report', action='store_true')
    args = ap.parse_args()

    only = set(x.strip() for x in args.only.split(',') if x.strip())
    books_out = []
    revs = []
    grand = 0
    report_lines = []
    for book in BOOKS:
        if only and book['id'] not in only:
            continue
        meta, rev, nbytes = build_one(book, args.src, args.rebuild, dry=args.dry_run)
        books_out.append(meta)
        revs.append(rev)
        grand += nbytes
        report_lines.append('%s  %d章 %d页  %.1fMB  rev=%s' % (
            book['id'], len(meta['chapters']),
            sum(c['pageCount'] for c in meta['chapters']),
            nbytes / 1048576.0, rev))

    if args.report or args.dry_run:
        print('\n===== 构建报告 =====')
        for line in report_lines:
            print(line)
        print('合计 %.1f MB' % (grand / 1048576.0))
        for meta in books_out:
            print(meta['id'], [c['pageCount'] for c in meta['chapters']])
        if args.dry_run:
            print('(dry-run：未写 library.json)')
            return

    os.makedirs(CONTENT_DIR, exist_ok=True)
    manifest = {
        'version': 1,
        'builtAt': __import__('datetime').datetime.now().astimezone().isoformat(timespec='seconds'),
        'rev': hashlib.sha1(''.join(revs).encode()).hexdigest()[:8],
        'series': '未来侦探团',
        'image': {'format': 'webp', 'width': WIDTH, 'quality': QUALITY},
        'books': books_out,
    }
    tmp = MANIFEST + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    os.replace(tmp, MANIFEST)
    with open(REPORT, 'w', encoding='utf-8') as f:
        f.write('\n'.join(report_lines) + '\n合计 %.1f MB\n' % (grand / 1048576.0))
    print('\n✓ 已写入 %s（rev=%s，%.1f MB）' % (MANIFEST, manifest['rev'], grand / 1048576.0))


if __name__ == '__main__':
    main()
