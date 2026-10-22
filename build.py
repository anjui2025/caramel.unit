#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build.py — 把 src/ 組裝成根目錄可直接上線的靜態 HTML

用法：
    python build.py

它做的事：
  1. 讀 src/site.json（全站設定：站名、網址、導覽列、社群連結、外部套件）
  2. 讀 src/partials/*.html（每頁共用的 head / 導覽 / 頁尾 / 共用 JS）
  3. 讀 src/pages/*.html（每頁獨有的內容）
  4. 組好後輸出到專案根目錄，並產生 sitemap.xml 與舊網址轉址頁

沒有任何外部套件相依，只要有 Python 3 就能跑。
"""

import json
import os
import re
import shutil
import time
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "src")
PARTIALS = os.path.join(SRC, "partials")
PAGES = os.path.join(SRC, "pages")

BUILD_MARK = "<!-- 這個檔案由 build.py 自動產生，請不要直接編輯；要改請改 src/ 底下的檔案 -->"


def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def write(path, text):
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)


# --------------------------------------------------------------------------
# 解析 src/pages 的頁面檔
# --------------------------------------------------------------------------

META_RE = re.compile(r"\A<!--meta\s*(.*?)-->", re.S)


def parse_page(text):
    """回傳 (meta dict, body)。meta 是檔案最前面 <!--meta ... --> 區塊裡的 key: value。"""
    text = text.lstrip("﻿").lstrip()
    meta = {}
    m = META_RE.match(text)
    if m:
        for line in m.group(1).strip().splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if ":" not in line:
                continue
            k, v = line.split(":", 1)
            meta[k.strip()] = v.strip()
        text = text[m.end():]
    return meta, text.strip()


BLOCK_RE = {
    "style": re.compile(r"<style>(.*?)</style>", re.S),
    "script": re.compile(r"<script>(.*?)</script>", re.S),
}


def pop_blocks(body, kind):
    """把 body 裡的 <style> 或 <script> 全部抽出來，回傳 (內容, 剩下的 body)。"""
    found = BLOCK_RE[kind].findall(body)
    body = BLOCK_RE[kind].sub("", body)
    return "\n".join(x.strip() for x in found if x.strip()), body


PREFIX_RE = re.compile(r"<!--body-prefix-->(.*?)<!--/body-prefix-->", re.S)
SUFFIX_RE = re.compile(r"<!--body-suffix-->(.*?)<!--/body-suffix-->", re.S)


def pop_prefix(body):
    """抽出要放在 <nav> 之前的東西（例如首頁的自訂游標、雜訊層）。"""
    m = PREFIX_RE.search(body)
    if not m:
        return "", body
    return m.group(1).strip(), PREFIX_RE.sub("", body)


def pop_suffix(body):
    """抽出要放在 </main> 之後的東西（例如燈箱、彈窗容器）。"""
    m = SUFFIX_RE.search(body)
    if not m:
        return "", body
    return m.group(1).strip(), SUFFIX_RE.sub("", body)


def truthy(v, default=True):
    if v is None:
        return default
    return str(v).strip().lower() in ("1", "true", "yes", "y", "on")


# --------------------------------------------------------------------------
# 組裝零件
# --------------------------------------------------------------------------

def indent(text, spaces):
    pad = " " * spaces
    return "\n".join(pad + ln if ln.strip() else ln for ln in text.splitlines())


def build_nav(site, active):
    desktop, mobile = [], []
    for it in site["nav"]:
        is_active = " active" if it["href"] == active else ""
        desktop.append(
            f'<a href="{it["href"]}" class="nav-item hover-target{is_active}">'
            f'{it["en"]} <span>{it["zh"]}</span></a>'
        )
        mobile.append(
            f'<a href="{it["href"]}" class="mobile-link{is_active}" data-close-menu>'
            f'<span class="en">{it["en"]}</span><span class="zh">{it["zh"]}</span></a>'
        )
    return "\n".join(desktop), "\n".join(mobile)


def build_footer(site, tpl):
    parts = []
    for s in site["social"]:
        ext = ' target="_blank" rel="noopener"' if s.get("external") else ""
        parts.append(
            '<a href="{href}"{ext} class="social-link hover-target">'
            '<i class="{icon}"></i> {label}</a>'.format(
                href=s["href"], ext=ext, icon=s["icon"], label=s["label"])
        )
    links = "\n".join(parts)
    return (tpl
            .replace("{{SOCIAL_LINKS}}", indent(links, 12).strip())
            .replace("{{YEAR}}", str(site["year"]))
            .replace("{{SITE_NAME}}", site["site_name"])
            .replace("{{BRAND}}", site["brand"]))


def json_ld(site, base):
    """首頁的結構化資料：讓搜尋引擎知道這個網站對應到哪一個人"""
    person = {
        "@type": "Person",
        "name": site["person"]["name"],
        "alternateName": site["person"].get("alt_name"),
        "jobTitle": site["person"]["job_title"],
        "description": site["default_description"],
        "url": base,
        "image": base + site["og_image"],
        "email": site["person"].get("email"),
        "sameAs": [s["href"] for s in site["social"] if s.get("external")],
        "knowsAbout": site["person"].get("knows_about", []),
    }
    if site["person"].get("locality"):
        person["address"] = {"@type": "PostalAddress",
                             "addressLocality": site["person"]["locality"],
                             "addressCountry": "TW"}
    if site["person"].get("alumni_of"):
        person["alumniOf"] = [{"@type": "CollegeOrUniversity", "name": n}
                              for n in site["person"]["alumni_of"]]

    data = {
        "@context": "https://schema.org",
        "@graph": [
            person,
            {"@type": "WebSite", "name": site["site_name"], "alternateName": site["brand"],
             "url": base, "inLanguage": "zh-Hant-TW",
             "author": {"@type": "Person", "name": site["person"]["name"]}},
        ],
    }

    def prune(o):          # 拿掉沒填的欄位，不要輸出 null
        if isinstance(o, dict):
            return {k: prune(v) for k, v in o.items() if v not in (None, "", [], {})}
        if isinstance(o, list):
            return [prune(x) for x in o]
        return o

    body = json.dumps(prune(data), ensure_ascii=False, indent=2)
    return ('<script type="application/ld+json">' + chr(10)
            + body + chr(10) + '    </script>')


def ld_block(data):
    """把一份資料包成 <script type="application/ld+json">"""
    body = json.dumps(data, ensure_ascii=False, indent=2)
    return ('<script type="application/ld+json">' + chr(10)
            + body + chr(10) + '    </script>')


def page_json_ld(site, base, out_name, meta, page_url, title, desc, order):
    """案例與演講頁的結構化資料：作品本身 + 麵包屑

    date 寫在頁面 meta 裡（例如 date: 2024.05）；沒寫就不輸出日期。
    """
    blocks = []

    date = (meta.get("date") or "").strip().replace(".", "-")
    if date or out_name in order:
        work = {
            "@context": "https://schema.org",
            "@type": "CreativeWork",
            "name": title,
            "description": desc,
            "url": page_url,
            "inLanguage": "zh-Hant-TW",
            "author": {"@type": "Person", "name": site["person"]["name"]},
            "creator": {"@type": "Person", "name": site["person"]["name"]},
        }
        if date:
            work["datePublished"] = date
        if meta.get("og_image"):
            work["image"] = base + meta["og_image"].strip()
        blocks.append(ld_block(work))

    # 麵包屑：首頁 > 分區 > 這一頁
    parent = meta.get("nav", "").strip()
    if not parent or parent == out_name:
        parent = "project.html" if out_name in order else ""
    if parent and parent != out_name:
        names = {"project.html": "完整零件", "small_project.html": "生活碎片",
                 "takeaways.html": "打包帶走", "services.html": "訂製零件"}
        if parent in names:
            blocks.append(ld_block({
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {"@type": "ListItem", "position": 1, "name": "首頁", "item": base},
                    {"@type": "ListItem", "position": 2, "name": names[parent],
                     "item": base + parent},
                    {"@type": "ListItem", "position": 3, "name": title, "item": page_url},
                ],
            }))

    return (chr(10) + "    ").join(blocks)


def minify_css(css):
    """保守的 CSS 壓縮：拿掉註解、收掉多餘空白。

    只處理 { } ; : , 周圍的空白，不碰 + - > ~ ——
    因為 calc(100% - 280px) 這種寫法少了空格就會失效。
    字串內容原樣保留，content: '✓' 不會被動到。
    """
    out, i, n = [], 0, len(css)
    while i < n:
        c = css[i]

        if c in "\"'":                      # 字串：整段照抄
            j = i + 1
            while j < n:
                if css[j] == "\\":
                    j += 2
                    continue
                if css[j] == c:
                    j += 1
                    break
                j += 1
            out.append(css[i:j])
            i = j
            continue

        if c == "/" and css.startswith("/*", i):   # 註解：丟掉
            j = css.find("*/", i + 2)
            i = n if j == -1 else j + 2
            continue

        if c in " \t\r\n\f":                # 連續空白收成一個，必要時整個拿掉
            j = i
            while j < n and css[j] in " \t\r\n\f":
                j += 1
            prev = out[-1][-1] if out and out[-1] else ""
            nxt = css[j] if j < n else ""
            if prev not in "{};:," and nxt not in "{};:,":
                out.append(" ")
            i = j
            continue

        out.append(c)
        i += 1

    return "".join(out).replace(";}", "}").strip()


def lib_assets(site, names):
    css, js, init = [], [], []
    for n in names:
        lib = site["libs"].get(n)
        if not lib:
            sys.exit(f"[build] 未知的 lib：{n}（請在 src/site.json 的 libs 裡定義）")
        if lib.get("css"):
            css.append(f'<link rel="stylesheet" href="{lib["css"]}">')
        if lib.get("js"):
            js.append(f'<script src="{lib["js"]}"></script>')
        if lib.get("init"):
            init.append(lib["init"].strip())
    return "\n".join(css), "\n".join(js), "\n\n".join(init)


# --------------------------------------------------------------------------
# 主流程
# --------------------------------------------------------------------------

def main():
    site = json.load(open(os.path.join(SRC, "site.json"), encoding="utf-8"))
    head_tpl = read(os.path.join(PARTIALS, "head.html"))
    nav_tpl = read(os.path.join(PARTIALS, "nav.html"))
    footer_tpl = read(os.path.join(PARTIALS, "footer.html"))
    scripts_tpl = read(os.path.join(PARTIALS, "scripts.html"))

    base = site["base_url"].rstrip("/") + "/"
    built = []

    # ---- 第一遍：先把每頁的 meta 讀出來，才能算出「下一個案例」的標題 ----
    parsed = []
    titles = {}
    for fname in sorted(os.listdir(PAGES)):
        if not fname.endswith(".html"):
            continue
        meta, body = parse_page(read(os.path.join(PAGES, fname)))
        out_name = meta.get("output", fname)
        titles[out_name] = meta.get("title", out_name)
        parsed.append((out_name, meta, body, fname))

    cta_tpl = read(os.path.join(PARTIALS, "case-cta.html"))
    order = site.get("case_order", [])

    def case_cta(out_name):
        """產生案例頁結尾的行動呼籲；下一個案例依 site.json 的 case_order 循環"""
        nxt = ""
        if out_name in order and len(order) > 1:
            n = order[(order.index(out_name) + 1) % len(order)]
            nxt = ('<p class="case-cta-next">看下一個案例：'
                   '<a href="{h}" class="hover-target">{t} →</a></p>').format(
                       h=n, t=titles.get(n, n))
        return (cta_tpl
                .replace("{{CTA_LEAD}}", site.get("cta_lead", "有類似的專案想討論嗎？"))
                .replace("{{CV_URL}}", site.get("cv_url", "about.html"))
                .replace("{{NEXT_CASE}}", nxt))

    # ---- 第二遍：組裝並輸出 ----
    for out_name, meta, body, src_name in parsed:

        page_style, body = pop_blocks(body, "style")
        page_script, body = pop_blocks(body, "script")
        body_prefix, body = pop_prefix(body)
        body_suffix, body = pop_suffix(body)

        # 案例頁結尾的行動呼籲，插在「返回」按鈕之前
        if truthy(meta.get("cta"), False):
            marker = '<div class="back-btn-container">'
            if marker in body:
                body = body.replace(marker, case_cta(out_name) + "\n\n        " + marker, 1)
            else:
                body = body.rstrip() + "\n\n" + case_cta(out_name)

        libs = [x.strip() for x in meta.get("libs", "").split(",") if x.strip()]
        includes = [x.strip() for x in meta.get("include", "").split(",") if x.strip()]
        lib_css, lib_js, lib_init = lib_assets(site, libs)

        for inc in includes:
            p = os.path.join(PARTIALS, inc + ".js")
            if not os.path.exists(p):
                sys.exit(f"[build] 找不到 partial：{inc}.js")
            lib_init = (lib_init + "\n\n" + read(p).strip()).strip()

        page_url = base + ("" if out_name == "index.html" else out_name)
        title = meta.get("title", out_name)
        full_title = title if meta.get("title_raw") else f'{title}｜{site["site_name"]}'
        desc = meta.get("description", site["default_description"])

        head = (head_tpl
                .replace("{{TITLE}}", full_title)
                .replace("{{DESCRIPTION}}", desc)
                .replace("{{PAGE_URL}}", page_url)
                .replace("{{OG_IMAGE}}", base + meta.get("og_image", site["og_image"]))
                .replace("{{SITE_NAME}}", site["site_name"])
                .replace("{{GA_ID}}", site["ga_id"])
                .replace("{{VERIFICATION}}",
                         f'<meta name="google-site-verification" content="{site["google_verification"]}">'
                         if out_name == "index.html" else "")
                .replace("{{JSONLD}}",
                         json_ld(site, base) if out_name == "index.html"
                         else page_json_ld(site, base, out_name, meta, page_url,
                                           title, desc, order))
                .replace("{{ROBOTS}}",
                         '<meta name="robots" content="noindex">' if truthy(meta.get("noindex"), False) else "")
                .replace("{{LIB_CSS}}", lib_css)
                .replace("{{PAGE_STYLE}}", f"<style>\n{page_style}\n</style>" if page_style else ""))

        nav_items, mobile_items = build_nav(site, meta.get("nav", out_name))
        nav = (nav_tpl
               .replace("{{NAV_ITEMS}}", indent(nav_items, 12).strip())
               .replace("{{MOBILE_ITEMS}}", indent(mobile_items, 8).strip())
               .replace("{{SITE_NAME}}", site["site_name"]))

        footer = build_footer(site, footer_tpl) if truthy(meta.get("footer")) else ""
        back_to_top = read(os.path.join(PARTIALS, "back-to-top.html")) if truthy(meta.get("back_to_top")) else ""

        tail = scripts_tpl
        extra = "\n\n".join(x for x in (lib_init, page_script) if x)
        tail = tail.replace("{{PAGE_SCRIPT}}", f"\n<script>\n{extra}\n</script>" if extra else "")
        tail = tail.replace("{{LIB_JS}}", lib_js)

        html = "\n".join(x for x in [
            head,
            BUILD_MARK,
            "<body>",
            body_prefix,
            nav,
            f'<main class="{meta.get("main_class", "main-stage")}">',
            body.strip(),
            footer,
            back_to_top,
            "</main>",
            body_suffix,
            tail,
            "</body>",
            "</html>",
        ] if x.strip())

        # 全域可用的簡易變數（頁面內容裡也能寫 {{CV_URL}} 這種寫法）
        for token, value in (("{{CV_URL}}", site.get("cv_url", "about.html")),
                             ("{{SITE_NAME}}", site["site_name"]),
                             ("{{BRAND}}", site["brand"])):
            html = html.replace(token, value)

        leftover = re.findall(r"\{\{[A-Z_]+\}\}", html)
        if leftover:
            sys.exit(f"[build] {out_name} 有沒被取代的樣板變數：{set(leftover)}")

        write(os.path.join(ROOT, out_name), html + "\n")
        lastmod = time.strftime(
            "%Y-%m-%d",
            time.localtime(os.path.getmtime(os.path.join(PAGES, src_name))))
        built.append((out_name, page_url, truthy(meta.get("noindex"), False), lastmod))
        print(f"  ✓ {out_name}")

    # ---- 壓縮 CSS ----
    # style.css 是你編輯的那一份；頁面載入的是壓縮後的 style.min.css
    css_src = os.path.join(ROOT, "assets", "css", "style.css")
    raw = read(css_src)
    mini = minify_css(raw)
    write(os.path.join(ROOT, "assets", "css", "style.min.css"), mini)
    print(f"  ✓ style.min.css（{len(raw)/1024:.0f} KB → {len(mini)/1024:.0f} KB）")

    # ---- 舊網址轉址頁 ----
    stub = read(os.path.join(PARTIALS, "redirect.html"))
    for old, new in site.get("redirects", {}).items():
        write(os.path.join(ROOT, old),
              stub.replace("{{TARGET}}", new).replace("{{TARGET_URL}}", base + new))
    if site.get("redirects"):
        print(f"  ✓ {len(site['redirects'])} 個舊網址轉址頁")

    # ---- sitemap ----
    urls = "\n".join(
        f"  <url><loc>{u}</loc><lastmod>{lm}</lastmod></url>"
        for _, u, noindex, lm in sorted(built) if not noindex
    )
    write(os.path.join(ROOT, "sitemap.xml"),
          '<?xml version="1.0" encoding="UTF-8"?>\n'
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
          f"{urls}\n</urlset>\n")
    write(os.path.join(ROOT, "robots.txt"),
          f"User-agent: *\nAllow: /\n\nSitemap: {base}sitemap.xml\n")
    print(f"  ✓ sitemap.xml（{len([b for b in built if not b[2]])} 頁，含 lastmod）")
    print(f"\n完成，共產生 {len(built)} 頁。")


if __name__ == "__main__":
    main()
