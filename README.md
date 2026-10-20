# Postcards from Singapore

A passport-style website for the Gardens by the Bay Flower Dome student event (Christmas Train Show, late Nov / early Dec 2026). Students collect 5 stamps with photos and reflections, make a postcard to send home, and plant a flower on a shared garden.

> **Status: between Milestone 1 and 2.** Student ID login, the passport and the 5 stamp activities work, using a temporary stand-in backend that keeps data in each browser. Milestone 2 connects Supabase, and this README will then include the full committee setup guide.

## Try it on your phone (developers)

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run dev
```

The terminal prints a `Network:` address such as `http://192.168.1.23:5173`. Open it on a phone on the **same Wi-Fi**. If it can't connect, allow Node.js through Windows Firewall (private networks).

Use event code `GBTB26` (or open `/?code=GBTB26`, as the QR code will) and any 7-digit student ID.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server, reachable from phones on the same Wi-Fi |
| `npm run build` | Type-check and build for production into `dist/` |
| `npm run preview` | Serve the production build locally |
