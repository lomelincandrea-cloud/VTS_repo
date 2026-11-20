"""Check that the browser port of the report rules (docs/tool/report_model.js) gives the same reports as report_model.py.

1. Renders the view model of both reports for every site in sample_data.json, for two periods, with report_model.py,
   and writes them to docs/tool/crosscheck_expected.json.
2. Opens docs/tool/crosscheck.html in headless Edge or Chrome (through a small local web server), which runs the JS port
   on the same records and compares field by field. Prints PASS or the first differences.

Run (conda env "vts"):  python check_js_port.py
If no browser is found, open http://localhost:<port>/tool/crosscheck.html by hand while `python -m http.server` runs in docs/.
"""
import json, shutil, subprocess, sys, threading, functools, re
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import report_model as RM

HERE = Path(__file__).resolve().parent
DOCS = HERE.parent.parent / "docs"
XLSX = HERE.parent / "manual_builder" / "data" / "VTS_manual_content.xlsx"
PERIODS = [None, {"start": "2025-01-01", "end": "2025-12-31"}]   # None: the period in sample_data.json


def expected():
    data, indicators, items = RM.load(DOCS / "tool" / "sample_data.json", XLSX)
    out = []
    for period in PERIODS:
        d = json.loads(json.dumps(data))
        if period: d["meta"]["generated_for_period"] = period
        for s in d["sites"]:
            for name, fn in (("food_safety", lambda: RM.food_safety(d, indicators, items, s["id"], True)),
                             ("water_summary", lambda: RM.water_summary(d, indicators, items, s["id"]))):
                m = fn(); m.pop("generated")
                out.append({"site": s["id"], "report": name, "period": d["meta"]["generated_for_period"], "model": m})
    (DOCS / "tool" / "crosscheck_expected.json").write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    return len(out)


def browser():
    for p in (shutil.which("msedge"), shutil.which("chrome"), r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
              r"C:\Program Files\Microsoft\Edge\Application\msedge.exe", r"C:\Program Files\Google\Chrome\Application\chrome.exe",
              "/usr/bin/google-chrome", "/usr/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"):
        if p and Path(p).exists(): return p
    return None


def run_page():
    handler = functools.partial(type("Q", (SimpleHTTPRequestHandler,), {"log_message": lambda *a: None}), directory=str(DOCS))
    srv = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{srv.server_address[1]}/tool/crosscheck.html"
    exe = browser()
    if not exe:
        print("SKIP browser run (no Edge or Chrome found). Open", url, "by hand."); input("Press Enter to stop the server."); return None
    try:
        dom = subprocess.run([exe, "--headless=new", "--disable-gpu", "--no-first-run", "--virtual-time-budget=20000", "--dump-dom", url],
                             capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=120).stdout
    finally:
        srv.shutdown()
    m = re.search(r'<pre id="result">(.*?)</pre>', dom, re.S)
    return m.group(1).replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&").replace("&quot;", '"') if m else "FAIL no result in the page:\n" + dom[:500]


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    print(f"expected models written: {expected()}")
    res = run_page()
    if res is None: sys.exit(0)
    print(res)
    sys.exit(0 if res.startswith("PASS") else 1)
