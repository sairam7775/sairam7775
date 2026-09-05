# Campaign Tool Demo App

A minimal, real web app for demoing `firebase-campaign-tool` to clients. It's the
literal implementation of "your app's own code" from the flow diagrams:

- **Push notifications** arrive automatically once you send them — no code in this
  app handles that path at all, Firebase Cloud Messaging does it end-to-end.
- **The pop-up (Modal)** only appears because this app fetches Remote Config and
  draws it — that's the extra step the diagrams called out.

## What you'll see

Two sections on one page:

1. **Notifications** — click "Enable notifications", get a browser push token, type
   a topic name and subscribe. Any push you send to that topic shows up in the log
   (and as a real OS notification if the tab isn't focused).
2. **In-app message (Modal)** — automatically checks Remote Config on load and
   whenever the tab regains focus, and renders a pop-up styled with whatever
   colors/text/button you set in the `InAppMessages` sheet.

## 1. Link Firebase to this app

Use the **same Firebase project** as `firebase-campaign-tool` — there's nothing
separate to create for the backend.

1. **Register a web app**: Firebase Console → Project settings (gear icon) →
   General tab → "Your apps" → click the `</>` (web) icon → give it any nickname →
   Register app. Firebase shows you a `firebaseConfig` object.
2. **Copy that config into `public/firebase-config.js`** in this folder (replace the
   `YOUR_...` placeholders).
3. **Generate a Web Push certificate**: Project settings → Cloud Messaging tab →
   scroll to "Web configuration" → Web Push certificates → Generate key pair. Copy
   the key into `vapidKey` in the same `public/firebase-config.js` file.
4. **Reuse the campaign tool's service account**: copy `.env.example` to `.env` and
   point `FIREBASE_SERVICE_ACCOUNT_PATH` at the same service account JSON
   `firebase-campaign-tool` uses (this app's backend needs it only to subscribe a
   browser to a topic — the Admin SDK, not the web SDK, is required for that).
5. **Remote Config**: no extra setup — this app reads whatever
   `firebase-campaign-tool` has already published there.

That's it — one `firebaseConfig` edit, one VAPID key, one reused service account.

## 2. Run it

```
npm install
npm start
```

Open **http://localhost:5173**, click "Enable notifications" (allow the browser
prompt), then subscribe to a topic — `demo_users` is prefilled to match the
examples below.

## 3. Trigger it with the automation tool

With the demo app open and subscribed to `demo_users`, in a separate terminal:

**Push notification:**
1. In `firebase-campaign-tool`'s Excel file, add/edit a `PushNotifications` row with
   `Topic = demo_users` and any Title/Body.
2. Run:
   ```
   cd ../firebase-campaign-tool
   node src/cli.js send your-campaign.xlsx --push-only
   ```
3. Watch it land in the demo app's "Received pushes" log within a second or two
   (switch the tab away first to see it as a real OS notification instead).

**In-app modal:**
1. Add/edit an `InAppMessages` row — leave `Condition` blank so it targets
   everyone, set `Active = TRUE`, and leave `StartDate`/`EndDate` blank (or set a
   window that includes right now).
2. Run:
   ```
   node src/cli.js send your-campaign.xlsx --iam-only
   ```
3. Switch back to the demo app's tab (or click "Check now") — the modal appears
   styled exactly per the sheet's colors/button.

This is the whole client pitch in one script: edit a spreadsheet, run one command,
watch it show up live on screen.

## Notes

- This demo intentionally skips auth, a database, and a real UI shell — it's built
  to make one thing obvious (push is automatic, modal isn't), not to be a starting
  point for a production app.
- `remoteConfig.settings.minimumFetchIntervalMillis` is set to `0` here so changes
  show up instantly for a live demo. A real app should leave Firebase's default
  (12 hours) or something reasonable, not fetch on every check.
