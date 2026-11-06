"""Фото для сайтов портфолио из открытых библиотек (Openverse: Wikimedia Commons, Flickr CC).

  python tools/photos.py search <папка> "<запрос>" [ещё запросы...]   — кандидаты + контактный лист sheet.jpg
  python tools/photos.py pick <папка> <номер> <имя>                    — скачать выбранное фото в img/<имя>.webp

Берём только лицензии, разрешающие коммерческое использование (CC0, PDM, CC BY, CC BY-SA);
авторство пишется в credits.json рядом и выводится в подвале сайта."""

from __future__ import annotations

import io
import json
import sys
import urllib.parse
from pathlib import Path

import httpx
from PIL import Image, ImageDraw

API = "https://api.openverse.org/v1/images/"
UA = {"User-Agent": "MoscowPortfolioBuilder/1.0 (https://github.com/discord0hom-ui; portfolio site build, few images) python-httpx"}
OK_LICENSES = {"cc0", "pdm", "by", "by-sa"}


def big_url(r: dict, width: int = 1920) -> str:
    u = r["url"]
    if "upload.wikimedia.org/wikipedia/commons/" in u and "/thumb/" not in u:
        tail = u.split("/wikipedia/commons/")[1]
        name = tail.rsplit("/", 1)[1]
        if (r.get("width") or 0) > width:
            ext = ".jpg" if not name.lower().endswith((".jpg", ".jpeg", ".png")) else ""
            return f"https://upload.wikimedia.org/wikipedia/commons/thumb/{tail}/{width}px-{name}{ext}"
    if "staticflickr.com" in u:
        return u.replace("_m.", "_b.").replace("_z.", "_b.")
    return u


def search(folder: Path, queries: list[str]) -> None:
    folder.mkdir(parents=True, exist_ok=True)
    seen, cands = set(), []
    with httpx.Client(headers=UA, timeout=30, follow_redirects=True) as c:
        for q in queries:
            import time
            data = {}
            for attempt in range(8):  # анонимный доступ Openverse ограничен по частоте — ждём и повторяем
                r = c.get(API, params={"q": q, "license_type": "commercial", "page_size": 20, "size": "large",
                                       "mature": "false"})
                if r.status_code == 200:
                    data = r.json()
                    break
                time.sleep(15 * (attempt + 1))
            took = 0
            for it in data.get("results", []):
                if took >= max(6, 36 // len(queries)):
                    break
                if it["license"] not in OK_LICENSES or it["url"] in seen:
                    continue
                if (it.get("width") or 0) < 1200:
                    continue
                seen.add(it["url"])
                cands.append(it)
                took += 1
        def small(i_it):
            i, it = i_it
            u = it["url"].replace("_b.", "_n.") if "staticflickr" in it["url"] else big_url(it, 330)
            for url in (u, it.get("thumbnail")):
                try:
                    t = c.get(url, timeout=30)
                    im = Image.open(io.BytesIO(t.content)).convert("RGB")
                    im.thumbnail((300, 200))
                    return i, im
                except Exception:  # noqa: BLE001
                    continue
            return None
        from concurrent.futures import ThreadPoolExecutor
        with ThreadPoolExecutor(8) as ex:
            thumbs = [t for t in ex.map(small, enumerate(cands[:36])) if t]
    cols, cw, ch = 6, 300, 220
    rows = (len(thumbs) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cw, max(1, rows) * ch), "white")
    d = ImageDraw.Draw(sheet)
    for k, (i, im) in enumerate(thumbs):
        x, y = (k % cols) * cw, (k // cols) * ch
        sheet.paste(im, (x, y))
        d.rectangle([x, y, x + 34, y + 22], fill="black")
        d.text((x + 5, y + 5), str(i), fill="white")
    sheet.save(folder / "sheet.jpg", quality=80)
    (folder / "candidates.json").write_text(json.dumps(cands[:36], ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(cands[:36])} кандидатов, лист: {folder / 'sheet.jpg'}")


def pick(folder: Path, idx: int, name: str, site_dir: Path | None = None) -> None:
    cands = json.loads((folder / "candidates.json").read_text(encoding="utf-8"))
    it = cands[idx]
    site_dir = site_dir or folder
    out = site_dir / "img" / f"{name}.webp"
    out.parent.mkdir(parents=True, exist_ok=True)
    im = None
    with httpx.Client(headers=UA, timeout=90, follow_redirects=True) as c:
        for u in (big_url(it), big_url(it, 1280), it["url"], it.get("thumbnail")):
            if not u:
                continue
            try:
                r = c.get(u)
                im = Image.open(io.BytesIO(r.content)).convert("RGB")
                break
            except Exception:  # noqa: BLE001 — пробуем следующий размер
                continue
    if im is None:
        raise SystemExit(f"не удалось скачать фото {idx}")
    im.thumbnail((1600, 1600))
    im.save(out, "WEBP", quality=72, method=6)
    cred_f = site_dir / "img" / "credits.json"
    creds = json.loads(cred_f.read_text(encoding="utf-8")) if cred_f.exists() else {}
    creds[name] = {"title": it.get("title"), "author": it.get("creator"), "license": it["license"].upper(),
                   "license_url": it.get("license_url"), "source": it.get("foreign_landing_url")}
    cred_f.write_text(json.dumps(creds, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{out} {im.size} {out.stat().st_size // 1024} КБ — {it['license']} {it.get('creator')}")


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    cmd, folder = sys.argv[1], Path(sys.argv[2])
    if cmd == "search":
        search(folder, sys.argv[3:])
    elif cmd == "pick":
        pick(folder / "_photos", int(sys.argv[3]), sys.argv[4], folder) if (folder / "_photos").exists() else \
            pick(folder, int(sys.argv[3]), sys.argv[4])
