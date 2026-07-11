# Favicon set — "Dispatches from the Far Reaches"

Brass compass-rose seal on the `#14150f` ink-green ground (same mark as the site wordmark).

## Files (place at site root)

- `favicon.ico` — multi-res 16/32/48 legacy icon
- `favicon.svg` — scalable modern icon (source)
- `favicon-16x16.png`, `favicon-32x32.png`, `favicon-48x48.png`
- `apple-touch-icon.png` — 180×180
- `android-chrome-192x192.png`, `android-chrome-512x512.png`
- `site.webmanifest`

## `<head>` snippet (paths assume site root)

```html
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#14150f">
```

Note: renders best at 32px+; at 16px the inner ring detail tightens but the rose still reads.
