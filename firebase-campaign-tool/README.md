# Firebase Campaign Tool

A CLI tool that reads an Excel workbook and:

- Sends **push notifications** via Firebase Cloud Messaging (FCM), targeted by topic —
  every field FCM's Admin SDK supports (core notification, Android, iOS/APNs, Web push, Analytics label).
- Publishes **Modal-type in-app messages** to Firebase Remote Config, for your app to render.

Built for sending many notifications at once, each with its own timing and its own
tracking ID, pulled straight from the spreadsheet.

## Why in-app messages go through Remote Config

Firebase's In-App Messaging product has **no public API to create campaigns** —
Google only supports authoring them by hand in the Firebase Console. To make in-app
messaging scriptable from Excel like push notifications, this tool writes message
content as JSON into Remote Config parameters (`iam_<key>`). Your app then reads those
parameters at runtime and renders its own modal UI. See
[Client-side integration](#client-side-integration) below.

Only the **Modal** message type is supported (matching what you actually use) — the
Excel sheet only has Modal's fields; Firebase's other in-app types (Banner, Image only,
Card) aren't modeled.

## Setup

1. Install dependencies:
   ```
   npm install
   ```
2. Get a Firebase service account key: Firebase Console → Project settings →
   Service accounts → Generate new private key. Save the JSON file somewhere safe
   (it is gitignored if named `service-account.json` in this directory).
3. Copy `.env.example` to `.env` and set `FIREBASE_SERVICE_ACCOUNT_PATH` to that file's path.
4. Generate a starter Excel template:
   ```
   npm run generate-template
   ```
   This creates `templates/campaign-template.xlsx` — four sheets: **Instructions**,
   **Lists** (dropdown source values), **PushNotifications**, **InAppMessages**, each
   with two example rows and dropdown/length validation already wired up.

## Excel format

The workbook needs one or both of the `PushNotifications` / `InAppMessages` sheets
(exact names). Every row is one notification — add as many rows as you need.

### `Lists` sheet — dropdown source values

Columns `Priority`, `Boolean`, `Topics`, and `Conditions` back the dropdowns on the
other two sheets. `Priority` and `Boolean` are fixed and don't need editing.
**`Topics` and `Conditions` are placeholders — edit this sheet** to list your app's
actual FCM topics and your actual Remote Config condition names (Firebase has no API
to enumerate either of these for us, so they can't be auto-populated).

### `PushNotifications` sheet

Core fields:

| Column     | Required | Dropdown? | Description                                                        |
|------------|----------|-----------|----------------------------------------------------------------------|
| EventId    | **yes**  |           | Unique ID per notification. Used to avoid double-sending on a re-run, and stamped into the push payload's `data.event_id`. |
| Topic      | yes      | ✓ (Lists!Topics) | FCM topic name devices are subscribed to (no `/topics/` prefix).   |
| Title      | yes      |           | Notification title. Warns past 65 characters.                     |
| Body       | yes      |           | Notification body text. Warns past 240 characters.                |
| ImageURL   | no       |           | Image shown with the notification.                                 |
| Data       | no       |           | JSON object string for custom data payload, e.g. `{"deepLink":"..."}` |
| SendAt     | no       |           | ISO 8601 UTC datetime, e.g. `2026-09-15T09:00:00Z`. Leave blank to send as soon as you run the command. See [Scheduling](#scheduling-multiple-times-and-dates) below. |

Advanced / platform-specific fields (all optional — leave blank to use FCM's default):

| Column         | Platform      | Maps to (FCM Admin SDK)              | Description |
|----------------|---------------|----------------------------------------|--------------|
| Priority       | Android       | `android.priority`                     | `high` or `normal` delivery priority. Dropdown.        |
| ChannelId      | Android       | `android.notification.channelId`       | Notification channel ID configured in your app.        |
| Sound          | Android + iOS | `android.notification.sound` / `apns.payload.aps.sound` | Sound file name, or `default`. |
| ClickAction    | Android + Web | `android.notification.clickAction` / `webpush.fcmOptions.link` | What opens when the notification is tapped — an Android intent-filter action string, or a URL for Web push. |
| CollapseKey    | Android       | `android.collapseKey`                  | Groups messages so only the latest is delivered when a device reconnects. |
| Tag            | Android       | `android.notification.tag`             | Replaces a previously-shown notification with the same tag. |
| Badge          | iOS           | `apns.payload.aps.badge`               | App icon badge count. Whole number, 0–9999.             |
| MutableContent | iOS           | `apns.payload.aps.mutableContent`      | TRUE/FALSE — needed for the image to render via a Notification Service Extension. Dropdown. |
| TTL            | Android       | `android.ttl` (converted to ms)        | Time-to-live in seconds. Whole number, 0 to 2,419,200 (FCM's 4-week max). |
| AnalyticsLabel | All           | `fcmOptions.analyticsLabel`            | Label attached to this message in Firebase Analytics reporting ("Notification name" in the console). |

Fields intentionally left out as too rare/advanced to justify a column (ask if you
need one added): title/body localization keys, Android vibration/light settings,
Web push action buttons, APNs category/thread-id/silent-push, `restrictedPackageName`.

### `InAppMessages` sheet (Modal type only)

| Column                | Required | Dropdown? | Description                                                                 |
|------------------------|----------|-----------|-------------------------------------------------------------------------------|
| CustomId               | **yes**  |           | Unique ID per message, stamped into the payload as `customId` for your own analytics/tracking. |
| Key                    | yes      |           | Becomes the Remote Config parameter name `iam_<key>`.                       |
| Title                  | yes      |           | Message title. Warns past 65 characters.                                    |
| Body                   | no       |           | Message body text. Warns past 300 characters (optional, matching Firebase's own Modal type). |
| ImageURL               | no       |           | Image shown in the modal.                                                   |
| BackgroundColor        | no       |           | Hex color, e.g. `#FFFFFF`.                                                   |
| TextColor              | no       |           | Hex color for title/body text, e.g. `#111111`.                              |
| ButtonText             | no       |           | Action button label. Leave blank for a plain dismissible modal with no button. Warns past 20 characters. |
| ButtonTextColor        | no       |           | Hex color.                                                                   |
| ButtonBackgroundColor  | no       |           | Hex color.                                                                   |
| ActionUrl              | no       |           | URL opened when the button (or modal) is tapped — Firebase console's "Go to URL" action. |
| Condition              | no       | ✓ (Lists!Conditions) | Name of an **existing** Remote Config condition to target — e.g. a Country/Region condition for location. Leave blank to publish as the default value for everyone. |
| TriggerEvent           | no       |           | Analytics event name that should trigger showing this message. Blank defaults to `app_foreground` (Firebase's own default trigger). |
| ConversionEvent        | no       |           | Analytics event name to attribute as a conversion for this campaign (reporting only — passed through, not enforced). |
| MaxImpressionsPerUser  | no       |           | Whole number, how many times a single user should see this. Leave blank for unlimited. **Your app must enforce this** — Remote Config has no built-in impression counter, this is only passed through in the payload. |
| StartDate              | no       |           | ISO 8601 UTC datetime the message should start showing.                    |
| EndDate                | no       |           | ISO 8601 UTC datetime the message should stop showing.                     |
| Active                 | no       | ✓ (TRUE/FALSE) | Defaults to TRUE. Combined with StartDate/EndDate — see below.        |

`Condition` must already exist in Firebase Console → Remote Config → Conditions —
this tool does not create conditions, only reads them for targeting (see the
location-targeting walkthrough further down). It approximates real IAM's Analytics
audience targeting, which this workaround can't replicate exactly.

**Uniqueness:** the tool rejects the whole row (with a clear error naming the
duplicate and its first occurrence) if `EventId` or `CustomId` repeats within its
sheet — don't reuse them across unrelated notifications.

**Dates as text, not Excel dates:** `SendAt`/`StartDate`/`EndDate` columns are
formatted as Text in the template. Type ISO 8601 UTC strings directly
(`2026-09-15T09:00:00Z`) — don't let Excel reformat the cell as a Date, since Excel
dates carry no timezone and would silently shift the meaning to your local time.

**How in-app `active` is computed:** the published payload's `active` field is
`Active AND (now is within [StartDate, EndDate])`, evaluated **at the moment you run
the command**. This is not a live timer — Remote Config doesn't auto-flip values on a
schedule — so for a message that should turn on/off at specific times you must either
(a) re-run the command (e.g. via cron) at the start/end times, or (b) have your client
also compare the current time against the `startDate`/`endDate` fields in the payload
(shown in the snippet below), so it self-corrects between publishes.

## Running

```
node src/cli.js send templates/campaign-template.xlsx
```

Flags:

- `--dry-run` — parse and validate everything, print what would be sent/published, but make no changes.
- `--push-only` — only process the `PushNotifications` sheet.
- `--iam-only` — only process the `InAppMessages` sheet.

Example:

```
node src/cli.js send my-campaign.xlsx --dry-run
```

Each row prints one of: `OK` (sent/published), `DRY-RUN`, `SCHEDULED` (SendAt is in
the future), `ALREADY SENT` (EventId was sent on a previous run), `SKIPPED` (missing/
duplicate required field), or `ERROR`.

## Scheduling multiple times and dates

Push notifications fire once, immediately, when `messaging().send()` is called — FCM
has no "send later" API. To hit specific times per row, this tool instead makes
re-running safe and cheap:

- Rows whose `SendAt` is in the future are reported as `SCHEDULED` and skipped — nothing is sent.
- Rows whose `SendAt` is blank, or has passed, are sent normally.
- Every successful send is recorded (by `EventId`) in a local state file
  (`.state/sent-push-events.json`, gitignored — override the path with the
  `PUSH_STATE_FILE_PATH` env var). Re-running the same file **never re-sends** a
  row whose `EventId` is already recorded, even if you run it a hundred times.

So one Excel file with many rows at many different `SendAt` times becomes a schedule
by running the command on a recurring cron job that's more frequent than your tightest
timing needs, e.g. every 5 minutes:

```cron
*/5 * * * * cd /path/to/firebase-campaign-tool && node src/cli.js send my-campaign.xlsx >> send.log 2>&1
```

Each tick only sends the rows that just became due; everything else is a no-op.
In-app messages don't need this — see the `active`-computation note above; re-running
the command for those simply refreshes Remote Config to the current window state,
which is safe to do repeatedly.

## Client-side integration

Since real in-app messages are just Remote Config values, your app needs a small
piece of code to fetch and render them. Conceptually, on app start / foreground:

```js
// Pseudocode — adapt to your platform's Remote Config SDK
await remoteConfig.fetchAndActivate();
const now = new Date();

for (const key of remoteConfig.getKeysByPrefix('iam_')) {
  const message = JSON.parse(remoteConfig.getValue(key).asString());

  const started = !message.startDate || new Date(message.startDate) <= now;
  const notEnded = !message.endDate || new Date(message.endDate) >= now;
  const underImpressionCap =
    !message.maxImpressionsPerUser || getLocalImpressionCount(message.customId) < message.maxImpressionsPerUser;

  const shouldShowNow = message.triggerEvent === 'app_foreground'
    ? true // check this on foreground
    : lastAnalyticsEventName === message.triggerEvent; // or hook into your event bus

  if (message.active && started && notEnded && underImpressionCap && shouldShowNow) {
    showModal(message); // title, body, imageUrl, backgroundColor, textColor,
                         // buttonText, buttonTextColor, buttonBackgroundColor, actionUrl
    incrementLocalImpressionCount(message.customId);
    logAnalyticsEvent('iam_impression', { customId: message.customId, key });
    if (message.conversionEvent) {
      // fire message.conversionEvent when the user completes the intended action
    }
  }
}
```

Firebase Remote Config SDKs exist for Android (Kotlin/Java), iOS (Swift), Web,
Flutter, and Unity — the fetch/read pattern above is the same shape on each.

## Example: location-targeted modal with timing and a custom ID

Say you want to show a **modal** in-app message only to users in **India**, from
Sep 10 to Sep 17, with a custom title/image, a `custom-mumbai-001` tracking ID, and a
button that opens a URL.

1. **Create the location condition once, in Firebase Console** (not this tool —
   Remote Config conditions aren't creatable via API): Remote Config → Conditions →
   Add condition → name it `India Users` → rule type **Country/Region** → select India → Save.
   (For finer-than-country targeting — a specific city or store — Remote Config has no
   built-in rule; you'd need your app to set a custom user property, e.g. `store_city`,
   and build the condition on that instead.)
2. **Add the condition name to the `Lists` sheet** (Conditions column) so it shows up
   in the `Condition` dropdown on `InAppMessages`.
3. **Add a row to the `InAppMessages` sheet** — this exact row is already in
   `templates/campaign-template.xlsx` (`npm run generate-template`), copy/edit it
   rather than retyping:

   | CustomId | Key | Title | ButtonText | ActionUrl | Condition | StartDate | EndDate | Active |
   |---|---|---|---|---|---|---|---|---|
   | custom-mumbai-001 | mumbai-store-launch | We just opened in Mumbai! | Get Directions | https://example.com/stores/mumbai | India Users | 2026-09-10T09:00:00Z | 2026-09-17T23:59:59Z | TRUE |

4. **Run it:**
   ```
   node src/cli.js send my-campaign.xlsx --iam-only --dry-run   # preview first
   node src/cli.js send my-campaign.xlsx --iam-only             # publish for real
   ```
5. Result: Remote Config parameter `iam_mumbai_store_launch` gets a conditional value
   scoped to `India Users`, containing the title/body/image/colors/button/dates as
   JSON. Only devices matching that condition receive this value when they call
   `fetchAndActivate()`; everyone else falls back to the default (`{"active":false}`).
   Your client renders it as a modal only while `now` is inside the Start/EndDate
   window, and tags any impression/click analytics with `customId`.

## Notes

- FCM topic messaging requires devices to already be subscribed to the topic
  client-side (`messaging.subscribeToTopic(...)`).
- Title/Body/ButtonText length validations in the template are **warnings**, not hard
  blocks — actual truncation behavior varies by OS/device and is governed by FCM's
  overall payload size limit, not a fixed per-field limit, so unusually long copy can
  still be entered deliberately. Badge/TTL/MaxImpressionsPerUser are hard-validated as
  whole numbers in range, since those genuinely must be integers.
