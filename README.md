# Trailer Checklist

Offline-first PWA for running family checklists at the trailer. Bilingual EN/IS. Submits each run as a row in a Google Sheet.

## Develop

```bash
npm install
npm run dev      # local server
npm test         # unit + component tests
npm run build    # production build (writes dist/)
```

## Deploy

- App: push to `master` — GitHub Action publishes to GitHub Pages at https://krissi4000.github.io/trailer-checklist/.
- Sheets endpoint: see `apps-script/README.md`.

## First-time tablet setup

1. Open the deployed URL in Android Chrome.
2. Menu → "Install app" / "Add to Home screen".
3. Open the app once online, then Settings → paste the Apps Script `/exec` URL and the shared secret, add user names.
4. Done. The app works fully offline; submissions sync when the tablet sees the internet again.

## Smoke test

See `docs/smoke-test.md`.
