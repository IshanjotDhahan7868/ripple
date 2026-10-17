# Checkups

The live loop (`.github/workflows/live.yml`) runs on its own every 2 hours and costs nothing. It is a
keyword robot, so it misreads some headlines. Every so often a Claude Code session does a checkup: it
reads what the robot did, fixes the rulebook so the same mistake can't happen again, and repairs anything
broken. In Claude Code, inside this repo, say **"ripple checkup"**.

## Steps

1. **Is it running?** `gh run list --workflow live -L 12`. For any failure, `gh run view <id> --log-failed`,
   fix the cause on `master`, then `gh workflow run live` and watch it.
2. **Get the data.** `git fetch origin live && git worktree add -f /tmp/ripple-live origin/live -B live`
   (or `git -C /tmp/ripple-live pull` if it exists).
3. **Read the report.** `.venv/bin/python -m live.review --data /tmp/ripple-live`. Look for dead feeds,
   zero new calls for many runs, and misread headlines.
4. **Fix misreads at the root**, in `live/rules.yaml`:
   - wrong direction from a word → a `rules:` entry, or add the word to `inverse:`
   - a name that looks like an alias but isn't → `ignore:`
   - a headline type the map shouldn't touch → `skip:`
   - a word list gap → `UP` / `DOWN` / `NEGATE` / `TROUBLE` in `live/pick.py`

   Add each misread headline to `tests/test_live.py` with the read you expect, then `.venv/bin/pytest -q`.
5. **Apply to calls not yet graded.** `.venv/bin/python -m live.review --data /tmp/ripple-live --recheck`
   withdraws the calls the new rulebook reads differently. Graded calls can't be withdrawn, and the site
   shows the withdrawn count, so a checkup never hides a wrong call.
6. **Leave a note** the site shows: `.venv/bin/python -m live.review --data /tmp/ripple-live --note "Fixed 3 misreads: ..."`.
7. **Ship.** Commit `master` (rules, tests, fixes) and push. Then in `/tmp/ripple-live`: `git pull --rebase`,
   commit, push. Keep each commit message to what changed and why.

## Never

- Withdraw or edit a graded call, or change a grade.
- Add an AI call to the loop. It stays free; judgment happens at checkups.
- Put keys in the workflow. It needs none.
