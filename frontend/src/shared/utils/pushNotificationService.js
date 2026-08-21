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
  try {
    const subRes = await fetch(`${import.meta.env.VITE_API_URL}/notifications/subscribe-web-push/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(subscription.toJSON()),
    });
    if (!subRes.ok && subRes.status !== 401) {
      console.warn(`Backend push registration response: ${subRes.status}`);
    }
  } catch (backendErr) {
    console.warn("Backend push registration warning:", backendErr);
  }

  return { success: true, permission: "granted", subscription };
}

export async function unsubscribeUserFromPush() {
  if (!isPushNotificationSupported()) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    if (!registration) return;

    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;

      // 1. Notify backend to remove this device endpoint
      try {
        await fetch(`${import.meta.env.VITE_API_URL}/notifications/unsubscribe-web-push/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ endpoint }),
        });
      } catch (e) {
        console.warn("Backend unsubscribe failed:", e);
      }

      // 2. Unsubscribe locally in browser push manager
      await subscription.unsubscribe();
      console.log("Successfully unsubscribed device from Web Push.");
    }
  } catch (err) {
    console.error("Error during push unsubscribe:", err);
  }
}

export function playNotificationSound() {
  if (typeof window === "undefined") return;
  try {
    if ('speechSynthesis' in window) {
      // Cancel any currently playing speech to start this one immediately
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance("Message for Mohith");
      utterance.rate = 0.95; // Slightly natural pace
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  } catch (err) {
    console.warn("Speech synthesis error:", err);
  }
}
