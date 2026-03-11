# WelFaker

<p align="center">
  <img src="src/logo.png" alt="WelFaker Logo" width="120" />
</p>

<p align="center">
  <strong>Create realistic Android Digital Wellbeing screenshots</strong>
</p>

<p align="center">
  <a href="https://wel-faker.dukebraham24.workers.dev">Live Demo</a>
</p>

---

## What is WelFaker?

WelFaker is a single-page web app that generates pixel-perfect replicas of Android's **Digital Wellbeing "App activity details"** screen. Customize every detail — status bar, apps, usage times, weekly graph — and export a screenshot that looks just like the real thing.

## Features

- **Realistic phone frame** with dark Material You theme
- **Fully editable status bar** — time, battery %, network type (4G/5G/WiFi), signal bars, speed indicator
- **Weekly bar chart** with auto-scaling grid lines based on usage
- **Today's bar auto-syncs** with the sum of all app usage times
- **Add/edit/delete apps** with custom names, usage times, and icons
- **Icon picker** — choose from bundled app icons or upload your own
- **24h cap validation** — per-app and total usage can't exceed 24 hours
- **One-click screenshot export** via html2canvas
- **LocalStorage persistence** — your data survives page refreshes
- **Side-by-side editor** — phone preview on the left, controls on the right

## Bundled Icons

YouTube, Instagram, Telegram, Chrome, Google Chrome, Firefox, Brave, Chess, Spotify

## Tech Stack

- **HTML5 / CSS3 / Vanilla JS** — zero frameworks, zero build step
- **Chart.js** v4.4.2 — weekly bar chart
- **html2canvas** v1.4.1 — screenshot export
- **Cloudflare Workers** — hosting & deployment

## Getting Started

### Run locally

```bash
# Clone the repo
git clone https://github.com/Badmaneers/wel-faker.git
cd wel-faker

# Serve with any static server
python3 -m http.server 5500
# Open http://localhost:5500
```

### Deploy to Cloudflare Workers

```bash
npm install
npx wrangler login
npx wrangler deploy
```

## Usage

1. Open the app in your browser
2. Use the **editor panel** on the right to customize:
   - Status bar (time, battery, network, signal, speed)
   - Day label and "today" bar index
   - Weekly graph data (non-today bars are manually editable)
   - Add apps with name, hours/minutes, and icon
3. Click **Export Screenshot** to download the image

## License

[MIT](LICENSE)
