require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const admin = require('firebase-admin');

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
if (!serviceAccountPath) {
  console.error('Set FIREBASE_SERVICE_ACCOUNT_PATH in .env (the same service account key used by firebase-campaign-tool).');
  process.exit(1);
}

const resolvedPath = path.resolve(__dirname, serviceAccountPath);
if (!fs.existsSync(resolvedPath)) {
  console.error(`Service account file not found at ${resolvedPath}`);
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(fs.readFileSync(resolvedPath, 'utf8'))),
});

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// The web SDK can't subscribe itself to an FCM topic — that call requires the
// Admin SDK, so this tiny endpoint stands in for "your app's backend" doing it.
app.post('/api/subscribe', async (req, res) => {
  const { token, topic } = req.body || {};
  if (!token || !topic) {
    return res.status(400).json({ error: 'token and topic are both required' });
  }
  try {
    await admin.messaging().subscribeToTopic(token, topic);
    res.json({ ok: true, topic });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const port = process.env.PORT || 5173;
app.listen(port, () => {
  console.log(`Demo app running at http://localhost:${port}`);
});
