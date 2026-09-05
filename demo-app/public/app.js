import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js';
import { getMessaging, getToken, onMessage } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging.js';
import { getRemoteConfig, fetchAndActivate, getAll } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-remote-config.js';
import { firebaseConfig, vapidKey } from './firebase-config.js';

const app = initializeApp(firebaseConfig);

const remoteConfig = getRemoteConfig(app);
// Demo only: always fetch fresh so a campaign you just published shows up
// immediately instead of waiting out the default 12-hour cache.
remoteConfig.settings.minimumFetchIntervalMillis = 0;

const el = (id) => document.getElementById(id);
const permissionStatus = el('permission-status');
const enableBtn = el('enable-btn');
const tokenRow = el('token-row');
const tokenValue = el('token-value');
const subscribeForm = el('subscribe-form');
const subscribeStatus = el('subscribe-status');
const pushLog = el('push-log');
const refreshIamBtn = el('refresh-iam-btn');
const iamStatus = el('iam-status');

let currentToken = null;

function setPermissionPill(state) {
  permissionStatus.textContent = state;
  permissionStatus.className = 'pill ' + (state === 'granted' ? 'pill-ok' : state === 'denied' ? 'pill-bad' : 'pill-pending');
}

function addPushLogEntry(payload) {
  const empty = pushLog.querySelector('.push-log-empty');
  if (empty) empty.remove();
  const li = document.createElement('li');
  const title = payload.notification?.title || '(no title)';
  const body = payload.notification?.body || '';
  const time = new Date().toLocaleTimeString();
  li.innerHTML = `<strong>${title}</strong><span>${body}</span><time>${time}</time>`;
  pushLog.prepend(li);
}

async function enableNotifications() {
  const permission = await Notification.requestPermission();
  setPermissionPill(permission);
  if (permission !== 'granted') return;

  const registration = await navigator.serviceWorker.register(
    '/firebase-messaging-sw.js?' + new URLSearchParams(firebaseConfig).toString()
  );

  const messaging = getMessaging(app);
  currentToken = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });

  tokenValue.textContent = currentToken;
  tokenRow.hidden = false;
  subscribeForm.hidden = false;
  enableBtn.disabled = true;
  enableBtn.textContent = 'Notifications enabled';

  onMessage(messaging, addPushLogEntry);
}

async function subscribeToTopic(topic) {
  subscribeStatus.textContent = 'Subscribing…';
  try {
    const res = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: currentToken, topic }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Subscribe failed');
    subscribeStatus.textContent = `Subscribed to "${topic}" — send a PushNotifications row with this Topic.`;
  } catch (err) {
    subscribeStatus.textContent = `Error: ${err.message}`;
  }
}

// --- In-app message (Modal) ---

const modalBackdrop = el('modal-backdrop');
const modalCard = el('modal-card');
const modalImage = el('modal-image');
const modalTitle = el('modal-title');
const modalBody = el('modal-body');
const modalButton = el('modal-button');
const modalDismiss = el('modal-dismiss');

function impressionCountKey(customId) {
  return `iam-impressions:${customId}`;
}

function getImpressionCount(customId) {
  return Number(localStorage.getItem(impressionCountKey(customId)) || 0);
}

function recordImpression(customId) {
  localStorage.setItem(impressionCountKey(customId), String(getImpressionCount(customId) + 1));
}

function isEligible(message) {
  const now = new Date();
  const started = !message.startDate || new Date(message.startDate) <= now;
  const notEnded = !message.endDate || new Date(message.endDate) >= now;
  const underCap =
    !message.maxImpressionsPerUser || getImpressionCount(message.customId) < message.maxImpressionsPerUser;
  return Boolean(message.active) && started && notEnded && underCap;
}

function showModal(message) {
  modalCard.style.background = message.backgroundColor || '#ffffff';
  modalCard.style.color = message.textColor || '#111111';
  modalTitle.textContent = message.title || '';
  if (message.body) {
    modalBody.textContent = message.body;
    modalBody.hidden = false;
  } else {
    modalBody.hidden = true;
  }
  if (message.imageUrl) {
    modalImage.src = message.imageUrl;
    modalImage.hidden = false;
  } else {
    modalImage.hidden = true;
  }
  if (message.buttonText) {
    modalButton.textContent = message.buttonText;
    modalButton.style.background = message.buttonBackgroundColor || '#111111';
    modalButton.style.color = message.buttonTextColor || '#ffffff';
    modalButton.href = message.actionUrl || '#';
    modalButton.hidden = false;
  } else {
    modalButton.hidden = true;
  }
  modalBackdrop.hidden = false;
  recordImpression(message.customId);
}

modalDismiss.addEventListener('click', () => {
  modalBackdrop.hidden = true;
});
modalBackdrop.addEventListener('click', (e) => {
  if (e.target === modalBackdrop) modalBackdrop.hidden = true;
});

async function checkInAppMessages() {
  iamStatus.textContent = 'Checking Remote Config…';
  try {
    await fetchAndActivate(remoteConfig);
  } catch (err) {
    iamStatus.textContent = `Error fetching Remote Config: ${err.message}`;
    return;
  }

  const all = getAll(remoteConfig);
  const candidates = Object.entries(all)
    .filter(([key]) => key.startsWith('iam_'))
    .map(([key, value]) => {
      try {
        return { key, message: JSON.parse(value.asString()) };
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  const eligible = candidates.find(({ message }) => isEligible(message));

  if (eligible) {
    showModal(eligible.message);
    iamStatus.textContent = `Showing "${eligible.key}".`;
  } else {
    iamStatus.textContent = `No eligible in-app message right now (checked ${candidates.length}).`;
  }
}

enableBtn.addEventListener('click', enableNotifications);
subscribeForm.addEventListener('submit', (e) => {
  e.preventDefault();
  subscribeToTopic(el('topic-input').value.trim());
});
refreshIamBtn.addEventListener('click', checkInAppMessages);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') checkInAppMessages();
});

checkInAppMessages();
