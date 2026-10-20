# Postcards from Singapore

A passport-style website for the Gardens by the Bay Flower Dome student event (Christmas Train Show, late Nov / early Dec 2026). Students log in with their student ID, collect 5 stamps with photos and reflections, make a postcard to send home, and plant a flower in a shared garden.

**Status:** Milestone 2. Login, passport and stamps are saved to Supabase. The postcard (M3), flower garden (M4) and admin page (M5) are still to come.

---

## Setting it up (for the committee)

You'll need about 30 minutes and three free accounts: **GitHub** (the code is already there), **Supabase** (the database) and **Vercel** (the website host). No coding is needed.

### 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com), sign in (signing in with GitHub is easiest) and click **New project**.
2. Fill in:
   - **Name:** `postcards-from-singapore`
   - **Database password:** click **Generate a password** and save it in your password manager. You won't need it day to day.
   - **Region:** **Southeast Asia (Singapore)**, so it's fast for students.
   - **Plan:** Free.
3. Click **Create new project** and wait a minute or two until the dashboard loads.

### 2. Run the setup file

1. In the left sidebar, open **SQL Editor**, then click **New query** (or the **+** button).
2. Open [`supabase/setup.sql`](supabase/setup.sql) on GitHub, click the **Copy raw file** button, and paste everything into the editor.
3. **Before running**, check the line near the bottom that creates the event:
   ```sql
   values ('GBTB26', 'Postcards from Singapore', '2026-11-28')
   ```
   Change the **event code** (`GBTB26`) if you want a different one, and set the **real event date** (year-month-day). The date is printed on every postcard.
4. Click **Run** (bottom right). You should see "Success. No rows returned". If Supabase warns about "destructive operations", that's expected: click **Run this query**.

### 3. Set the organiser passcode

1. Still in the SQL Editor, click **New query** and paste this, using your own passcode and your event code:
   ```sql
   select public.set_admin_passcode('GBTB26', 'your long passcode here');
   ```
2. Click **Run**.
3. Then **delete the text from the editor** so the passcode isn't saved there.

**Use a long passcode:** at least 12 characters. A short, unusual sentence works well, for example `orchids-love-the-downtown-line`. Share it only with organisers. Running the command again with a new passcode changes it and logs every organiser out.

### 4. Turn on anonymous sign-ins

Students don't create accounts. Behind the scenes each phone gets an anonymous login, which the database links to their student ID.

1. In the left sidebar go to **Authentication → Sign In / Providers** (on some versions it's **Authentication → Providers**).
2. Find **Allow anonymous sign-ins** and switch it **on**. Click **Save**.

### 5. Raise the anonymous sign-in limit

By default Supabase allows only 30 anonymous sign-ins per hour from one internet address. Students on the same mobile network can share an address, so raise this limit or some students won't be able to log in.

1. Go to **Authentication → Rate Limits**.
2. Set **Rate limit for anonymous users** to **300** per hour. Click **Save**.

### 6. Copy the two keys

1. Click **Connect** at the top of the dashboard (or go to **Project Settings → API Keys**).
2. Copy and keep these two values somewhere handy:
   - **Project URL**, which looks like `https://abcdefgh.supabase.co`
   - The **publishable key**, which starts with `sb_publishable_`. Older projects have an **anon public** key instead, which works the same.

Both are safe to put in a website. **Never** use the `secret` or `service_role` key.

### 7. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub.
2. Click **Add New… → Project**, find **isn-gbtb-app** and click **Import**. (If it isn't listed, click **Adjust GitHub App Permissions** and give Vercel access to the repository.)
3. Vercel detects **Vite** automatically. Leave the build settings alone.
4. Open **Environment Variables** and add two:

   | Key | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | your Project URL |
   | `VITE_SUPABASE_ANON_KEY` | your publishable (or anon) key |

5. Click **Deploy**. After about a minute you'll get a web address such as `https://isn-gbtb-app.vercel.app`.
6. Open it on your phone and try logging in with your own student ID.

If you add or change the environment variables later, go to **Deployments**, open the **⋯** menu on the latest one and click **Redeploy**, because the keys only take effect after a new deploy.

### 8. Make the QR code

The QR code should open the site with the event code already filled in:

```
https://YOUR-SITE.vercel.app/?code=GBTB26
```

- **In Chrome (on a computer):** open that address, click the **share / QR icon** in the address bar (or right-click the page → **Create QR code**), and download it.
- Or use any free QR generator, and **test the printed QR code with a couple of phones** before the event.

---

## Before the event

- **⚠️ Supabase free projects pause after 7 days without activity.** A paused project means students can't log in. **In the 3 days before the event, open the Supabase dashboard (this wakes the project if it's paused) and run a full rehearsal on the live site:** log in, collect all 5 stamps, make a postcard and plant a flower.
- Log in on the live site with a test student ID during the rehearsal, then delete that data afterwards (the admin page arrives in M5).

## Changing things during the event

**Editing the seasonal stamp or event date:** go to Supabase → **Table Editor → events**, double-click a cell, edit it, and press Enter.

- `seasonal_title` is the activity name, for example "All aboard the MRT".
- `seasonal_stamp_text` is the text in the middle of the stamp, in capitals, with one line per row (up to 3 lines). Use a `/` to split lines, for example `ALL ABOARD / THE MRT`.
- `seasonal_prompt` is the instructions, with each paragraph on its own line.
- `event_date` is the date on the postcard postmark.

Students see the change the next time they open or refresh the page.

**Helping a student who can't get back in:** they need the **same student ID and first name** they used the first time. Capitals, spaces and accents don't matter, but spelling does. To check what they typed, open Supabase → **Table Editor → students** and search for their student ID.

## After the event

- **Export for the report:** Supabase → **Table Editor → submissions** (and **students**) → **Export → Export table as CSV**. Download photos from **Storage → photos** if you need them for social media.
- **Delete all event data,** including student IDs, from the admin page (arrives in M5). This is required for PDPA compliance.

---

## For developers

Requires [Node.js](https://nodejs.org) 20+.

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase URL and key
npm run dev
```

`npm run dev` prints a `Network:` address you can open on a phone on the same Wi-Fi.

| Command | What it does |
|---|---|
| `npm run dev` | Development server, reachable from phones on the same Wi-Fi |
| `npm run build` | Type-check and build for production into `dist/` |
| `npm run preview` | Serve the production build locally |

**How it fits together:** a React + Vite single-page app, hosted as static files on Vercel. `vercel.json` sends every route to `index.html`. All rules live in the database: Row Level Security policies, plus `join_event` and the `admin_*` functions in [`supabase/setup.sql`](supabase/setup.sql). Students can only read and write their own rows. The admin passcode is stored as a bcrypt hash in a table the website can't read.
