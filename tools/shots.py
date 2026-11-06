"""Скриншоты сайтов портфолио для главной страницы и для проверки.

  python tools/shots.py              — все сайты из sites.json
  python tools/shots.py slug1 slug2  — выбранные

Кладёт sites/<slug>/preview.webp (1440×900, для карточки) и _shots/<slug>-{desk,mob}.png (для проверки)."""

from __future__ import annotations

import http.server
import io
import json
import sys
import threading
from functools import partial
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent


def serve() -> int:
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a, **k):
            pass
    h = partial(Quiet, directory=str(ROOT))
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), h)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv.server_address[1]


def main(slugs: list[str]) -> None:
    if not slugs:
        slugs = [s["slug"] for s in json.loads((ROOT / "sites.json").read_text(encoding="utf-8"))]
    port = serve()
    out = ROOT / "_shots"
    out.mkdir(exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome")
        for slug in slugs:
            url = f"http://127.0.0.1:{port}/sites/{slug}/"
            for kind, vp in (("desk", {"width": 1440, "height": 900}), ("mob", {"width": 390, "height": 844})):
                pg = b.new_page(viewport=vp, device_scale_factor=1, reduced_motion="reduce")
                errs: list[str] = []
                pg.on("pageerror", lambda e: errs.append(str(e)))
                pg.goto(url, wait_until="networkidle")
                pg.evaluate("document.querySelectorAll('img[loading=lazy],iframe[loading=lazy]').forEach(e=>e.loading='eager')")
                pg.wait_for_load_state("networkidle")
                pg.wait_for_timeout(600)
                over = pg.evaluate("document.documentElement.scrollWidth - window.innerWidth")
                png = pg.screenshot(full_page=False)
                (out / f"{slug}-{kind}.png").write_bytes(png)
                if kind == "desk":
                    im = Image.open(io.BytesIO(png)).convert("RGB")
                    im.thumbnail((960, 600))
                    im.save(ROOT / "sites" / slug / "preview.webp", "WEBP", quality=80)
                    full = pg.screenshot(full_page=True)
                    (out / f"{slug}-full.png").write_bytes(full)
                else:
                    full = pg.screenshot(full_page=True)
                    (out / f"{slug}-mobfull.png").write_bytes(full)
                print(f"{slug} {kind}: горизонтальная прокрутка {over}px, ошибок JS {len(errs)} {errs[:2]}")
                pg.close()
        b.close()


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    main(sys.argv[1:])
