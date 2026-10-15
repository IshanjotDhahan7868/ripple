# Ripple UI design tokens

Subject: an instrument for watching a shock travel through the economy. Audience: analysts and hackathon judges.
Primary job: make the graph's multi-hop reasoning visible and verifiable in one glance.

## Color
| Token | Dark | Light | Role |
|---|---|---|---|
| `--ground` | #0F1B26 | #EDF1F4 | app background (blue-slate, not black) |
| `--panel` | #152433 | #FFFFFF | side panes |
| `--ink` | #DCE6EE | #14212C | primary text |
| `--muted` | #7F93A4 | #5B6E7E | secondary text, idle edges |
| `--signal` | #F2B544 | #B87A00 | the ripple: active path, pulse rings, focus |
| `--up` / `--down` | #49C29A / #EE6A55 | #13855F / #C43D27 | exposure direction only |

## Type
- Schibsted Grotesk: all UI text. Scale 12 / 14 / 16 / 20 / 28.
- JetBrains Mono: only for real Cypher, tickers in the trace.

## Layout
```
┌ headline ───────┬──────────── causal graph (ELK, left→right) ────────────┬ trace / brief ──┐
│ input, depth    │  source ◎ ─── hop1 ─── hop2 ─── hop3 ─── hop4          │ tool calls      │
│ sample headlines│  rings pulse at source, edges light in lag order       │ Cypher + ms     │
│ event memory    │                                                         │ Impact brief    │
└─────────────────┴─────────────────────────────────────────────────────────┴─────────────────┘
```
Left-aligned text everywhere. Mobile: panes stack (input → graph → brief).

## Principles
- Spend boldness once: the ripple animation. Everything else is quiet.
- Every claim on screen links to a path in the graph. No decorative chrome.
- Sentence case, no ALL-CAPS eyebrows, no middle-dot meta strings.
- Respect `prefers-reduced-motion`: paths highlight instantly.
