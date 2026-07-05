# Screenshots

Drop PNGs here and they'll render in the main [README](../../README.md).

Suggested captures (file names the README already references):

| File | Page / state |
|------|--------------|
| `landing.png` | Marketing landing page (`/`) |
| `dashboard.png` | Live dashboard with stats + recent events (`/dashboard`) |
| `repositories.png` | Repositories grid + "Connect repository" dialog |
| `rules.png` | Rules list + rule builder dialog |
| `events.png` | Events table with filters (`/events`) |
| `event-detail.png` | Event detail: AI analysis, GitHub actions, Slack, log timeline |
| `logs.png` | Structured logs feed (`/logs`) |
| `settings.png` | Settings: webhook URL, AI + Slack config |
| `slack.png` | A delivered Slack notification |

## How to capture

```bash
pnpm dev            # http://localhost:3000
# Sign in with GitHub, connect a repo, add a rule, then open an issue
# titled "bug" on that repo to populate events/actions/Slack.
```

For a populated dashboard without wiring up GitHub, run `pnpm db:seed` first —
it inserts a demo repository, two rules and a fully-processed sample event.
