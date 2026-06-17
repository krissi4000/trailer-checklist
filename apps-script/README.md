# Apps Script deployment

## One-time setup

1. Install clasp globally: `npm install -g @google/clasp`
2. `clasp login`
3. From the project root: `cd apps-script && clasp create --type sheets --title "Trailer Checklist Log"`
4. `clasp push`
5. Open the Sheet (via `clasp open`) → Extensions → Apps Script → Project Settings → Script properties
   - Add `TRAILER_SECRET` = (paste a long random string, save it; you'll also paste it into the tablet Settings)
6. Deploy → New deployment → Web app → Execute as: yourself → Who has access: Anyone
7. Copy the `/exec` URL. Paste into the tablet's Settings → Sheets endpoint URL.

## Manual smoke test

```bash
# Edit test-payload.json first and replace the "secret" field.
curl -X POST \
  -H "Content-Type: application/json" \
  --data @test-payload.json \
  "<your /exec URL>"
```

Expected: `{"ok":true,"row":2}` (or `{"ok":true,"dedup":true}` on the second call).

Then open the Sheet and confirm the row landed in the `Runs` tab.
