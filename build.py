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
        parsed.append((out_name, meta, body))

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
    for out_name, meta, body in parsed:

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
                .replace("{{OG_IMAGE}}", base + site["og_image"])
                .replace("{{SITE_NAME}}", site["site_name"])
                .replace("{{GA_ID}}", site["ga_id"])
                .replace("{{VERIFICATION}}",
                         f'<meta name="google-site-verification" content="{site["google_verification"]}">'
                         if out_name == "index.html" else "")
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
        built.append((out_name, page_url, truthy(meta.get("noindex"), False)))
        print(f"  ✓ {out_name}")

    # ---- 舊網址轉址頁 ----
    stub = read(os.path.join(PARTIALS, "redirect.html"))
    for old, new in site.get("redirects", {}).items():
        write(os.path.join(ROOT, old),
              stub.replace("{{TARGET}}", new).replace("{{TARGET_URL}}", base + new))
    if site.get("redirects"):
        print(f"  ✓ {len(site['redirects'])} 個舊網址轉址頁")

    # ---- sitemap ----
    urls = "\n".join(
        f"  <url><loc>{u}</loc></url>" for _, u, noindex in sorted(built) if not noindex
    )
    write(os.path.join(ROOT, "sitemap.xml"),
          '<?xml version="1.0" encoding="UTF-8"?>\n'
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
          f"{urls}\n</urlset>\n")
    write(os.path.join(ROOT, "robots.txt"),
          f"User-agent: *\nAllow: /\n\nSitemap: {base}sitemap.xml\n")
    print(f"  ✓ sitemap.xml（{len([b for b in built if not b[2]])} 頁）")
    print(f"\n完成，共產生 {len(built)} 頁。")


if __name__ == "__main__":
    main()
