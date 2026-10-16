# Lampa plugins

## Lift v0.2.1

Standalone JavaScript plugin for Lampa. Add `https://sergdi.github.io/lampa-plugins/lift.js` in Settings → Extensions → Add plugin, then restart Lampa.

Open **Watch → Lift** from a movie or series card. A unique match by title/original title, release year and film/series type opens automatically. Ambiguous or incomplete metadata leaves a choice of search matches; Search Lift always allows manual selection. The native Lampa screen provides episode lists, season/format filters, progress and saved selection. HLS is the default; DASH support depends on the player. Audio and subtitles use player controls.

GitHub Pages hosts only the plugin. Media is requested directly from the provider. No backend, dependencies, APK or account credentials are bundled. API/CDN availability can change; reopen Lift to refresh expired links. Audio switching and Apple TV playback have not been verified.

## Verification

```sh
npm test
npm run check
# Optional live API/manifest check (Node 18+):
node tests/live-check.cjs
```

The browser integration was checked using the installed Mac Lampa web assets in isolated Chromium. Real movie HLS playback, native activity navigation, filters and series playlist selection were verified. Tests use controlled fixtures and do not bundle live signed media URLs.

## Publishing

Enable GitHub Pages from the repository branch root. `.nojekyll` keeps deployment static. `lift.js` is the complete distributable; no build is required.
