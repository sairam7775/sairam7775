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
| Condition  | no       | Name of an **existing** Remote Config condition (audience/version/etc.) to target. Leave blank to publish as the default value for all users. |
| Active     | no       | `TRUE`/`FALSE`. Defaults to `TRUE`.                                         |

`Condition` must already exist in Firebase Console → Remote Config → Conditions —
this tool does not create conditions, only reads them for targeting.

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

for (const key of remoteConfig.getKeysByPrefix('iam_')) {
  const message = JSON.parse(remoteConfig.getValue(key).asString());
  if (message.active) {
    showInAppBanner(message); // title, body, imageUrl, ctaText, ctaUrl
  }
}
```

Firebase Remote Config SDKs exist for Android (Kotlin/Java), iOS (Swift), Web,
Flutter, and Unity — the fetch/read pattern above is the same shape on each.

## Notes

- Push notifications are sent immediately when the command runs; there is no
  built-in scheduling. Use cron / a task scheduler to run the CLI at a chosen time.
- FCM topic messaging requires devices to already be subscribed to the topic
  client-side (`messaging.subscribeToTopic(...)`).
