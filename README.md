# Postcards from Singapore

A digital passport for the Gardens by the Bay Flower Dome student event (Christmas Train Show, late Nov / early Dec 2026). Students collect 5 stamps with photos and reflections, make a postcard to send home, and plant a flower on a shared garden wall.

> **Status: Milestone 1 (demo mode).** Student ID login and rejoin, the passport, the 5 stamp activities, and saving on the phone all work. There is no real backend yet: a stand-in "demo server" lives inside each browser, so data never leaves the phone. The full committee setup guide (Supabase, Vercel, QR code) arrives with Milestone 2.

## Try it on your phone (developers)

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run dev
```

The terminal prints a `Network:` address such as `http://192.168.1.23:5173`. Open it on a phone connected to the **same Wi-Fi**. If the phone can't connect, allow Node.js through Windows Firewall (private networks) when prompted.

Demo data:

| What | Value |
|---|---|
| Event code | `GBTB26` (or open `/?code=GBTB26` to have it filled in, as the QR code will) |
| Rejoin a full passport | student ID `2500002`, first name `Lucas` |
| Rejoin a part-filled passport | student ID `2500001`, first name `Aisha` |
| New student | any other 7-digit number |

Things to try:

- **Rejoin lockout:** enter `2500002` with a wrong first name 5 times; that ID is locked for 5 minutes.
- **No signal:** collect a stamp in airplane mode. It shows as collected with "saved on phone", then syncs when signal returns.
- **Leave this phone:** at the bottom of the passport. Rejoining with the same student ID and first name brings everything back.

Note: offline caching of the app itself (the service worker) only switches on over HTTPS, so test it on the Vercel deployment from Milestone 2. Saving submissions offline already works on the Wi-Fi address.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server, reachable from phones on the same Wi-Fi |
| `npm run build` | Type-check and build for production into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run icons` | Regenerate app icons from `public/logo.svg` |
