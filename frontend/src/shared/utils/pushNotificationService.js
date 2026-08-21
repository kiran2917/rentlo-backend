/**
 * pushNotificationService.js
 * Utility helper for managing Service Worker and Web Push subscriptions
 */

export function isPushNotificationSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function getNotificationPermissionState() {
  if (!isPushNotificationSupported()) return "unsupported";
  return Notification.permission; // "default", "granted", "denied"
}

export async function subscribeUserToPush() {
  if (!isPushNotificationSupported()) {
    throw new Error("Push notifications are not supported in this browser.");
  }

  // 1. Request user permission
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { success: false, permission, message: "Notification permission not granted." };
  }

  // 2. Await active Service Worker registration
  const registration = await navigator.serviceWorker.ready;
  if (!registration) {
    throw new Error("Service Worker is not ready.");
  }

  // 3. Fetch VAPID public key from backend
  const keyRes = await fetch(`${import.meta.env.VITE_API_URL}/notifications/vapid-public-key/`, {
    credentials: "include",
  });
  if (!keyRes.ok) {
    throw new Error("Failed to fetch notification public key from server.");
  }

  const keyData = await keyRes.json();
  const publicKey = keyData.public_key?.trim();
  if (!publicKey) {
    throw new Error("Server returned an empty VAPID public key.");
  }

  // 4. Convert Base64 URL-safe string to Uint8Array
  const padding = "=".repeat((4 - (publicKey.length % 4)) % 4);
  const base64 = (publicKey + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const applicationServerKey = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    applicationServerKey[i] = rawData.charCodeAt(i);
  }

  // 5. Get or subscribe to push manager
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey,
    });
  }

  // 6. Register subscription with backend
  const subRes = await fetch(`${import.meta.env.VITE_API_URL}/notifications/subscribe-web-push/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(subscription.toJSON()),
  });

  if (!subRes.ok) {
    throw new Error(`Backend subscription registration returned status ${subRes.status}`);
  }

  return { success: true, permission: "granted", subscription };
}

export function playNotificationSound() {
  if (typeof window === "undefined") return;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const now = ctx.currentTime;

    // First pleasant chime tone (High G5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(783.99, now);
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    // Second pleasant chime tone (High C6)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1046.50, now + 0.12);
    gain2.gain.setValueAtTime(0.25, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.6);
  } catch (err) {
    // Ignore audio error if user hasn't interacted
  }
}
