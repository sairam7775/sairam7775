// Handles push notifications while this tab/app is in the background or closed.
// Service workers can't use ES module imports, so the Firebase config is read
// from the registration URL's query string instead of being duplicated here —
// app.js appends it automatically. Only edit public/firebase-config.js.
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

const params = new URLSearchParams(location.search);
firebase.initializeApp({
  apiKey: params.get('apiKey'),
  authDomain: params.get('authDomain'),
  projectId: params.get('projectId'),
  storageBucket: params.get('storageBucket'),
  messagingSenderId: params.get('messagingSenderId'),
  appId: params.get('appId'),
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body, image } = payload.notification || {};
  self.registration.showNotification(title || 'New notification', {
    body,
    icon: image,
    data: payload.data,
  });
});
