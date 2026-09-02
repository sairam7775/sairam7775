const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');

function initFirebase() {
  if (admin.apps.length) return admin;

  const credPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (!credPath) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_PATH is not set. Copy .env.example to .env and point it at your ' +
        'Firebase service account JSON key (Firebase Console > Project settings > Service accounts).'
    );
  }

  const resolvedPath = path.resolve(process.cwd(), credPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Service account file not found at ${resolvedPath}`);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  return admin;
}

module.exports = { initFirebase };
