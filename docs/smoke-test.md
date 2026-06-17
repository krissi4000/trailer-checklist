# Smoke test

Run after each deploy.

## On the tablet

1. Open the app. Confirm Home screen loads.
2. Settings → confirm endpoint URL + secret are present.
3. Go offline (airplane mode).
4. Run a checklist end-to-end: pick user → check at least one item → tap an item to see instructions → Submit.
5. Confirm toast "Saved. Will sync when online." and pending badge shows 1.
6. Restore Wi-Fi. Within ~30 seconds, the pending badge should clear (or use Settings → Force sync now).
7. Open the Google Sheet → confirm a new row appeared with today's timestamp, the user picked, and the checklist name.

## Edit mode

1. Long-press the gear icon. Confirm Edit Checklists screen opens.
2. Add a new checklist, add an item with a photo from the camera.
3. Run the new checklist, submit.
4. Confirm the row lands in the Sheet.
