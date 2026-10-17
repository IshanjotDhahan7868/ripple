"""Free RSS feeds of business headlines. Stdlib only, so the loop has no feed-parsing dependency."""

import hashlib
import re
import urllib.request
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime

FEEDS = {
    "Google News": "https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=en-US&gl=US&ceid=US:en",
    "CNBC": "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664",
    "MarketWatch": "https://feeds.content.dowjones.io/public/rss/mw_topstories",
    "BBC": "https://feeds.bbci.co.uk/news/business/rss.xml",
}
UA = "Mozilla/5.0 (compatible; ripple-live/1.0; +https://github.com/IshanjotDhahan7868/ripple)"


def clean(title: str, source: str) -> tuple[str, str]:
    """Google News titles end in ' - Publisher'; split that off so the headline reads cleanly."""
    title = re.sub(r"\s+", " ", title).strip()
    if source == "Google News" and " - " in title:
        title, source = title.rsplit(" - ", 1)
    return title.strip(), source.strip()


def key(headline: str) -> str:
    norm = re.sub(r"[^a-z0-9 ]", "", headline.lower())
    return hashlib.sha1(" ".join(norm.split()).encode()).hexdigest()[:12]


def fetch(timeout: int = 20) -> list[dict]:
    items, seen = [], set()
    for name, url in FEEDS.items():
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            root = ET.fromstring(urllib.request.urlopen(req, timeout=timeout).read())
        except Exception as e:  # one dead feed must not stop the run
            print(f"feed {name} failed: {e}")
            continue
        for it in root.iter("item"):
            title, source = clean(it.findtext("title") or "", name)
            if len(title) < 25 or key(title) in seen:
                continue
            seen.add(key(title))
            try:
                at = int(parsedate_to_datetime(it.findtext("pubDate")).timestamp())
            except Exception:
                at = None
            items.append({"id": key(title), "headline": title, "source": source,
                          "url": (it.findtext("link") or "").strip(), "published": at})
    return items
