# Ripple live data

Written every 2 hours by `.github/workflows/live.yml` on `master`. Nothing here is edited by hand except at a checkup.

- `feed.json`: the newest traced headlines and the running score (what the website shows)
- `ledger.json`: every call ever made, with its grade once 5 and 20 trading days have passed
- `items/<id>.json`: the full analysis behind each call
- `state.json`: headlines already seen, so nothing is traced twice
