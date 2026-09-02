# Firebase Campaign Tool

A CLI tool that reads an Excel workbook and:

- Sends **push notifications** via Firebase Cloud Messaging (FCM), targeted by topic.
- Publishes **in-app message** content to Firebase Remote Config, for your app to render.

## Why in-app messages go through Remote Config

Firebase's In-App Messaging product has **no public API to create campaigns** —
Google only supports authoring them by hand in the Firebase Console. To make in-app
messaging scriptable from Excel like push notifications, this tool writes message
content as JSON into Remote Config parameters (`iam_<key>`). Your app then reads those
parameters at runtime and renders its own banner/modal UI. See
[Client-side integration](#client-side-integration) below.

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
   This creates `templates/campaign-template.xlsx` with two sheets and one example row each.

## Excel format

The workbook needs one or both of these sheets (exact names):

### `PushNotifications` sheet

| Column     | Required | Description                                                        |
|------------|----------|----------------------------------------------------------------------|
| Topic      | yes      | FCM topic name devices are subscribed to (no `/topics/` prefix).   |
| Title      | yes      | Notification title.                                                |
| Body       | yes      | Notification body text.                                            |
| ImageURL   | no       | Image shown with the notification.                                 |
| Data       | no       | JSON object string for custom data payload, e.g. `{"deepLink":"..."}` |
| Priority   | no       | `high` or `normal` (Android). Defaults to normal.                  |

### `InAppMessages` sheet

| Column     | Required | Description                                                                 |
|------------|----------|-------------------------------------------------------------------------------|
| Key        | yes      | Unique campaign key, becomes Remote Config parameter `iam_<key>`.           |
| Title      | yes      | Message title.                                                              |
| Body       | yes      | Message body text.                                                          |
| ImageURL   | no       | Image URL.                                                                  |
| CTAText    | no       | Call-to-action button text.                                                 |
| CTAUrl     | no       | Call-to-action deep link / URL.                                             |
| Condition  | no       | Name of an **existing** Remote Config condition to target (e.g. a Country/Region condition for location, or an app-version/audience condition). Leave blank to publish as the default value for all users. |
| CampaignId | no       | Free-text ID stamped into the payload, for your app to tag impression/click analytics events with. |
| Style      | no       | Rendering hint for your client code, e.g. `banner`, `modal`, `fullscreen`. Defaults to `banner`. |
| StartDate  | no       | ISO date/time (e.g. `2026-09-10T09:00:00Z`) the message should start showing. |
| EndDate    | no       | ISO date/time the message should stop showing.                             |
| Active     | no       | `TRUE`/`FALSE`. Defaults to `TRUE`. Combined with StartDate/EndDate — see below. |

`Condition` must already exist in Firebase Console → Remote Config → Conditions —
this tool does not create conditions, only reads them for targeting.

**How `active` is computed:** the published payload's `active` field is
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

  if (message.active && started && notEnded) {
    // style: 'banner' | 'modal' | 'fullscreen' — pick your renderer
    showInAppMessage(message); // title, body, imageUrl, ctaText, ctaUrl, campaignId, style
    logAnalyticsEvent('iam_impression', { campaignId: message.campaignId, key });
  }
}
```

Firebase Remote Config SDKs exist for Android (Kotlin/Java), iOS (Swift), Web,
Flutter, and Unity — the fetch/read pattern above is the same shape on each.

## Example: location-targeted modal with timing and a campaign ID

Say you want to show a **modal** in-app message only to users in **India**, from
Sep 10 to Sep 17, with a custom title/image, a `mumbai-launch-2026` campaign ID for
analytics, and a button that opens a URL.

1. **Create the location condition once, in Firebase Console** (not this tool —
   Remote Config conditions aren't creatable via API): Remote Config → Conditions →
   Add condition → name it `India Users` → rule type **Country/Region** → select India → Save.
   (For finer-than-country targeting — a specific city or store — Remote Config has no
   built-in rule; you'd need your app to set a custom user property, e.g. `store_city`,
   and build the condition on that instead.)
2. **Add a row to the `InAppMessages` sheet:**

   | Key                | Title                        | Body                                              | ImageURL                                  | CTAText        | CTAUrl                                 | Condition    | CampaignId          | Style | StartDate              | EndDate                 | Active |
   |--------------------|-------------------------------|----------------------------------------------------|--------------------------------------------|----------------|------------------------------------------|--------------|----------------------|-------|--------------------------|---------------------------|--------|
   | mumbai-store-launch | We just opened in Mumbai!    | Visit our new store and get 15% off your first purchase. | https://example.com/images/mumbai-launch.png | Get Directions | https://example.com/stores/mumbai | India Users  | mumbai-launch-2026   | modal | 2026-09-10T09:00:00Z    | 2026-09-17T23:59:59Z     | TRUE   |

   (This exact row is already in `templates/campaign-template.xlsx` after
   `npm run generate-template` — copy/edit it rather than retyping.)
3. **Run it:**
   ```
   node src/cli.js send my-campaign.xlsx --iam-only --dry-run   # preview first
   node src/cli.js send my-campaign.xlsx --iam-only             # publish for real
   ```
4. Result: Remote Config parameter `iam_mumbai_store_launch` gets a conditional value
   scoped to `India Users`, containing the title/body/image/campaignId/style/dates/CTA
   as JSON. Only devices matching that condition receive this value when they call
   `fetchAndActivate()`; everyone else falls back to the default (`{"active":false}`).
   Your client renders it as a modal (per `style`) only while `now` is inside the
   Start/EndDate window, and tags any impression/click analytics with `campaignId`.

## Notes

- Push notifications are sent immediately when the command runs; there is no
  built-in scheduling. Use cron / a task scheduler to run the CLI at a chosen time.
- FCM topic messaging requires devices to already be subscribed to the topic
  client-side (`messaging.subscribeToTopic(...)`).
