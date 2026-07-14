"""Reusable base scraper.

Prefers **Patchright** (an undetected Playwright fork that patches the
`Runtime.enable` CDP leak nearly every 2026 anti-bot checks) and falls back to
vanilla Playwright if Patchright isn't installed. Uses a **persistent browser
context** so cookies / anti-bot tokens (Bayut's anonymous_session_id + device_id,
DataDome / AWS-WAF cookies) survive across runs and pages.

Key helpers:
  - capture_json(page, filters): passively read the JSON the page itself fetches
    (the browser handles TLS + anti-bot cookies; we just read responses).
  - goto(): retry + backoff + automatic CAPTCHA-challenge detection.
  - wait_for_human(): in headed mode, pause once for a manual CAPTCHA solve.

Subclasses set `source` and implement `run(dry_run=False) -> list[dict]`.
"""
from __future__ import annotations

import logging
import os
import random
import time

try:  # preferred engine
    from patchright.sync_api import sync_playwright
    ENGINE = "patchright"
except ImportError:  # fallback
    from playwright.sync_api import sync_playwright
    ENGINE = "playwright"

log = logging.getLogger("scraper")

DEFAULT_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

# only used on the vanilla-Playwright fallback (Patchright handles this itself)
_STEALTH_JS = """
Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
Object.defineProperty(navigator, 'languages', {get: () => ['en-US', 'en', 'ar']});
Object.defineProperty(navigator, 'plugins', {get: () => [1, 2, 3, 4, 5]});
window.chrome = window.chrome || { runtime: {} };
"""


def _env_bool(name: str, default: bool) -> bool:
    v = os.getenv(name)
    return default if v is None else v.strip().lower() not in ("false", "0", "no", "")


class BaseScraper:
    source = "base"

    def __init__(self, headless: bool | None = None,
                 min_delay: float | None = None, max_delay: float | None = None,
                 profile_dir: str | None = None):
        # Default HEADED — 2026 anti-bot guidance: headless leaks GPU/automation tells.
        self.headless = _env_bool("SCRAPE_HEADLESS", False) if headless is None else headless
        self.min_delay = float(min_delay if min_delay is not None else os.getenv("SCRAPE_MIN_DELAY", 2))
        self.max_delay = float(max_delay if max_delay is not None else os.getenv("SCRAPE_MAX_DELAY", 6))
        self.max_pages = int(os.getenv("SCRAPE_MAX_PAGES", 20))
        self.profile_dir = os.path.abspath(profile_dir or os.getenv("SCRAPE_PROFILE_DIR", ".pw-profile"))
        self._pw = None
        self.context = None

    # -- lifecycle (use as a context manager) -------------------------------
    def _proxy(self):
        # validate the scheme — guards against blank/whitespace/inline-comment env values
        server = (os.getenv("PROXY_SERVER") or "").strip()
        if not server.startswith(("http://", "https://", "socks5://", "socks://")):
            return None
        proxy = {"server": server}
        user = (os.getenv("PROXY_USERNAME") or "").strip()
        pwd = (os.getenv("PROXY_PASSWORD") or "").strip()
        if user:
            proxy["username"] = user
        if pwd:
            proxy["password"] = pwd
        return proxy

    def __enter__(self):
        self._pw = sync_playwright().start()
        kwargs = dict(
            user_data_dir=self.profile_dir,
            headless=self.headless,
            locale="en-AE",
            timezone_id="Asia/Dubai",
            proxy=self._proxy(),
            args=["--disable-blink-features=AutomationControlled",
                  "--disable-dev-shm-usage", "--no-first-run"],
        )
        if ENGINE == "patchright":
            # real Google Chrome + auto-aligned UA/client-hints — do NOT override UA/headers
            kwargs["channel"] = "chrome"
            kwargs["no_viewport"] = True
        else:
            kwargs["user_agent"] = os.getenv("SCRAPE_UA", DEFAULT_UA)
            kwargs["viewport"] = {"width": 1366, "height": 850}
            kwargs["extra_http_headers"] = {"Accept-Language": "en-US,en;q=0.9,ar;q=0.8"}
        self.context = self._pw.chromium.launch_persistent_context(**kwargs)
        if ENGINE != "patchright":
            self.context.add_init_script(_STEALTH_JS)
        log.info("browser engine=%s headless=%s profile=%s", ENGINE, self.headless, self.profile_dir)
        return self

    def __exit__(self, *exc):
        try:
            if self.context:
                self.context.close()
        except Exception:
            pass
        if self._pw:
            self._pw.stop()

    # -- helpers ------------------------------------------------------------
    def delay(self):
        time.sleep(random.uniform(self.min_delay, self.max_delay))

    def new_page(self):
        return self.context.new_page()

    def capture_json(self, page, filters) -> list:
        """Register a response listener collecting JSON whose URL matches any filter.
        Returns a list that fills as the page issues XHR/fetch calls."""
        subs = [filters] if isinstance(filters, str) else list(filters)
        collected: list = []

        def _on_response(resp):
            try:
                if not any(s in resp.url for s in subs):
                    return
                if "json" not in resp.headers.get("content-type", "").lower():
                    return
                collected.append(resp.json())
            except Exception:
                pass

        page.on("response", _on_response)
        return collected

    def is_challenge(self, page) -> bool:
        try:
            return "captchachallenge" in (page.url or "").lower()
        except Exception:
            return False

    def wait_for_human(self, page, timeout: int = 180) -> bool:
        """Headed mode: pause for a one-time manual CAPTCHA solve, then continue."""
        if self.headless:
            log.error("CAPTCHA challenge hit while HEADLESS — set SCRAPE_HEADLESS=false "
                      "and re-run once to solve it manually (the session cookie then persists).")
            return False
        log.warning(">>> CAPTCHA/anti-bot challenge detected. Please solve it in the browser "
                    "window. Waiting up to %ss...", timeout)
        waited = 0
        while waited < timeout:
            if not self.is_challenge(page):
                log.info("challenge cleared — continuing.")
                self.delay()
                return True
            time.sleep(3)
            waited += 3
        log.error("challenge not solved within %ss — aborting this run.", timeout)
        return False

    def goto(self, page, url, *, wait_until="domcontentloaded",
             wait_selector: str | None = None, retries: int = 3) -> bool:
        last = None
        for attempt in range(1, retries + 1):
            try:
                page.goto(url, wait_until=wait_until, timeout=60_000)
                if self.is_challenge(page) and not self.wait_for_human(page):
                    return False
                if wait_selector:
                    try:
                        page.wait_for_selector(wait_selector, timeout=15_000)
                    except Exception:
                        pass
                self.delay()
                return True
            except Exception as exc:  # noqa: BLE001
                last = exc
                log.warning("goto failed (%d/%d) %s: %s", attempt, retries, url, exc)
                time.sleep(random.uniform(3, 8) * attempt)
        log.error("giving up on %s: %s", url, last)
        return False

    def get_json(self, url, *, method="GET", headers=None, data=None, params=None):
        """Replay a JSON request through the context (reuses anti-bot cookies)."""
        kwargs = {}
        if headers:
            kwargs["headers"] = headers
        if params:
            kwargs["params"] = params
        if data is not None:
            kwargs["data"] = data
        try:
            resp = self.context.request.fetch(url, method=method, **kwargs)
        except Exception as exc:  # noqa: BLE001
            log.warning("json request error %s: %s", url, exc)
            return None
        if not resp.ok:
            log.warning("json %s -> HTTP %s", url, resp.status)
            return None
        try:
            return resp.json()
        except Exception:
            return None

    # -- contract -----------------------------------------------------------
    def run(self, dry_run: bool = False) -> list[dict]:
        raise NotImplementedError
