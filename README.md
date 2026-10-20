# isn-gbtb-app: Flower Dome Stamp Rally

A mobile web app for a group stamp rally at Gardens by the Bay. Participants join a
group on their own phone (no install, no login), collect a stamp at each checkpoint
by taking a photo or scanning a QR code, and everything syncs live to the organisers.
It keeps working with patchy signal: stamps and photos are saved on the phone and
upload automatically when the connection returns.

**Status:** Stage 1 (group joining, photo/QR stamps, questions, leader manual stamps,
offline queue, QR printing). Stage 2 adds the admin dashboard, Stage 3 photos and
gallery, and Stage 4 the programme and closing screens plus the event-day checklist.

Stack: Vite + React + TypeScript + Tailwind, Supabase (Postgres, Realtime, Storage, Auth),
hosted on Vercel. All free tiers.

---

## 1. Set up Supabase (about 10 minutes)

1. Create a free account at <https://supabase.com> and click **New project**.
   Pick the **Southeast Asia (Singapore)** region. Save the database password somewhere safe.
2. When the project is ready, open **SQL Editor → New query**, paste the whole of
   [`supabase/schema.sql`](supabase/schema.sql), and click **Run**. You should see "Success".
3. In a new query, paste [`supabase/seed.sql`](supabase/seed.sql) and **Run**. The result
   table lists each sample group's **join code** and **leader PIN**.
4. **Create your organiser login:**
   - Go to **Authentication → Users → Add user → Create new user**. Enter your email and a
     strong password, and tick **Auto Confirm User**.
   - Back in the **SQL Editor**, run (with your email):
     ```sql
     insert into admins (user_id) select id from auth.users where email = 'you@example.com';
     ```
5. **Turn off public sign-ups** so nobody else can create an account:
   **Authentication → Sign In / Providers → Email**, then switch off **Allow new users to sign up**.
   (The setting is named slightly differently in some dashboard versions; look under
   Authentication → Settings.)
6. Get your keys: **Project Settings → API** (or **Data API**). Copy the **Project URL** and the
   **anon / public** key. Never use the `service_role` key in this app.

> **Free-tier pause:** Supabase pauses free projects after 7 days without activity.
> Open the app (or the Supabase dashboard) at least once in the week before the event.
> If it's paused, click **Restore project** in the dashboard.

To wipe everything and start again: run [`supabase/reset.sql`](supabase/reset.sql), then
`schema.sql` and `seed.sql`, then re-add your organiser (step 4, the SQL part only).

## 2. Run it on your computer

Needs [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
cp .env.example .env.local      # then paste your Project URL and anon key into .env.local
npm run dev
```

Open <http://localhost:5173>. The organiser pages are at <http://localhost:5173/admin>.

## 3. Test on your phone

Phone browsers only allow the camera on **HTTPS** pages, so pick one:

- **Option A: deploy to Vercel** (most realistic, see section 4) and open the
  `https://…vercel.app` link on your phone.
- **Option B: same Wi-Fi as your computer.** Run `npm run dev:phone`. The terminal
  prints a `Network: https://192.168.x.x:5173` address. Open it on your phone and accept
  the "not secure / not private" warning (it's your own self-signed certificate):
  on iPhone tap **Show Details → visit this website**, on Android tap **Advanced → Proceed**.

### Test the full Stage 1 flow

The seed data starts in the **rally** phase, so stamps work straight away.

1. On your phone, open the app and enter group code **`FERN-01`**. You should see
   "Ferns 🌿, EXCO leader Alex Tan".
2. Tap **The Ancient Olive Trees → Take photo**. The stamp appears immediately.
3. **Offline test:** turn on Airplane mode, then do **Succulent Garden → Take photo**.
   It shows as stamped (dashed border) and the bar at the top says "1 waiting to upload".
   Turn Airplane mode off. Within a few seconds it uploads and becomes a solid stamp.
4. **Question:** open **Baobab Giants**, take a photo, then answer the question.
   Try a wrong answer first (3 tries), then `water`.
5. **QR stamp:** on your computer, sign in at `/admin`, go to **QR codes → Checkpoint QRs**
   and leave the Flower Field QR on screen. On your phone tap **Scan checkpoint QR** and point
   it at the screen. Scanning again says "already collected". You can also scan it with the
   phone's normal camera app: it opens the app and gives the stamp.
6. **Group QR:** on a second phone (or a private/incognito tab), scan a QR from
   **QR codes → Group QRs**. It joins that group.
7. **Leader mode:** tap the group name at the top → **I'm the EXCO leader**, and enter the
   group's PIN (from **QR codes → Leaders sheet**, or the seed.sql result). Open any
   unstamped checkpoint: there's now a **Give stamp manually** button.

Your test stamps are real data. Before the event, clear them with:
```sql
delete from question_attempts; delete from stamps; delete from photos;
update groups set finished_at = null;
```

## 4. Deploy to Vercel (free)

1. Push this repository to GitHub.
2. Go to <https://vercel.com>, sign in with GitHub, click **Add New → Project**, and import the repo.
   Vercel detects Vite automatically (build: `npm run build`, output: `dist`).
3. Under **Environment Variables** add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
   (same values as `.env.local`).
4. Click **Deploy**. Your app is live at `https://<project>.vercel.app`. Every push to `main`
   redeploys it.

**Print QR codes from the deployed site** (`https://<project>.vercel.app/admin/qr`), not
from localhost, because the QR codes contain the address of the page you print them from.

## 5. Printing QR codes

At `/admin/qr` there are three sheets. Each has a **Print** button (use your browser's
print dialog and choose A4, with "Headers and footers" turned off):

| Sheet | Who sees it | Contents |
|---|---|---|
| **Checkpoint QRs** | Placed at checkpoints | One page per QR-method checkpoint. Photo checkpoints need no QR. |
| **Group QRs** | Participants | One page per group: QR, join code, leader name. **No PINs.** |
| **Leaders sheet** | EXCO leaders only | Join code and **leader PIN** for each group. Cut into strips. |

---

## How it works

### Checkpoint methods
Each checkpoint is **photo** (default) or **qr**, and either one can also have a question.

- **Photo:** the group takes a photo of or with the feature. The stamp counts **as soon as the
  photo is saved on the phone**, so weak signal never blocks a group. The photo uploads in the
  background and goes into the gallery. Organisers can reject a wrong photo (Stage 2 live
  board), and the group then sees "Not accepted" and can retake it.
- **QR:** scan the sign at the checkpoint. Scans made with no signal are saved and checked when
  the connection returns.
- **Question (optional):** unlocks once the stamp is collected. 3 tries; correct = full points,
  out of tries = the stamp still counts but scores 0.
- **Leader manual stamp:** fallback for both methods, protected by the group's 6-digit PIN.

### Anti-cheating
- A checkpoint counts **once per group**, enforced by the database.
- Checkpoint QR codes contain a random 128-bit token, not a name or number, so they can't
  be guessed. Tokens, join codes, PINs and quiz answers are stored in tables only the
  organiser can read. Answers are checked on the server.
- Every write goes through a database function that checks the group's secret token.
- **Timing:** stamps saved offline use the phone's clock, limited to between rally start and
  the moment the server received it. Wrong phone clocks can't jump ahead, and a group that
  lost signal isn't penalised for uploading late. "Fastest finish" = rally start → the time of
  the group's final stamp.
- Stamps after the rally end time don't count (leaders can still give manual stamps).

### Offline behaviour
- The app files are cached by a service worker, so the app reopens with no signal.
- The last-loaded event data, checkpoints and stamps are cached on the phone.
- Stamps, photos and answers go into an on-phone queue (IndexedDB) and are sent in order,
  retrying on reconnect, when the app returns to the foreground, and every 30 seconds.
  Retries are safe: the server ignores duplicates.
- Photos are compressed on the phone to about 300 KB (max 1600 px) before upload.

### Project layout
```
supabase/schema.sql      tables, security rules, and all server functions
supabase/seed.sql        sample event data for testing
supabase/reset.sql       wipe everything
src/lib/outbox.ts        offline queue + retry
src/lib/data.tsx         live data (Supabase + Realtime + cache)
src/pages/               participant screens
src/pages/admin/         organiser screens
```
