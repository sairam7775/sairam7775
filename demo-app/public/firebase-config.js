// Firebase Console -> Project settings -> General -> Your apps -> Web app (</>)
// Use the SAME Firebase project as firebase-campaign-tool.
export const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT_ID.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
};

// Firebase Console -> Project settings -> Cloud Messaging -> Web Push certificates
// -> Generate key pair
export const vapidKey = 'YOUR_VAPID_KEY';
