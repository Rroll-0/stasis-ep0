# STASIS Episode 0 — iPhone (Safari)

1. Open the HTTPS link in **Safari** (not Chrome).
2. Tap the **Share** button (square with arrow).
3. Tap **Add to Home Screen**, then **Add**.
4. Launch **STASIS** from your Home Screen — plays fullscreen like an app.

## Saves
- Progress is stored in this phone’s Safari `localStorage` only (key `stasis-ep0-save`).
- Clearing Safari website data, or using another device, loses the save.
- Type `new` (or tap **New**) for a fresh campaign.
- `save` / `quit` also persist progress.

## Tips
- Keep the phone online the first time so assets and the service worker can install; after that it can work offline.
- If the page looks stale after an update, remove the Home Screen icon and Add to Home Screen again.
