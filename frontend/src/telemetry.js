/**
 * Rentlo / PropertyHub Frontend Telemetry & Observability
 * 
 * Works seamlessly on Vercel, Localhost, or Custom Domains.
 * Features:
 * - Real-time error capture with stack traces & user context
 * - Distributed trace propagation to Django backend
 * - Core Web Vitals (LCP, FID, CLS) performance monitoring
 * - Safe fallback if DSN is not configured
 */

let sentryInstance = null;

export const initTelemetry = async () => {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  const environment =
    import.meta.env.VITE_ENVIRONMENT ||
    (import.meta.env.PROD ? "vercel-production" : "development");
  const release = import.meta.env.VITE_RELEASE || "rentlo-web@1.0.0";

  if (!dsn) {
    if (import.meta.env.DEV) {
      console.info("[Telemetry] VITE_SENTRY_DSN not set. Running in local telemetry mock mode.");
    }
    return;
  }

  try {
    const Sentry = await import("@sentry/react");
    sentryInstance = Sentry;

    Sentry.init({
      dsn,
      environment,
      release,
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          maskAllText: false,
          blockAllMedia: false,
        }),
      ],
      // Tracing: sample 20% in production, 100% in staging/preview
      tracesSampleRate: import.meta.env.PROD ? 0.2 : 1.0,
      tracePropagationTargets: [
        "localhost",
        /^\//,
        /^https:\/\/.*\.onrender\.com/,
        /^https:\/\/.*propertyhub.*/,
        /^https:\/\/.*rentlo.*/,
      ],
      // Session Replay: capture on errors
      replaysSessionSampleRate: 0.05,
      replaysOnErrorSampleRate: 1.0,
    });

    console.info(`[Telemetry] Initialized for [${environment}] with release [${release}]`);
  } catch (err) {
    console.warn("[Telemetry] Could not load Sentry SDK:", err);
  }
};

/**
 * Capture an unhandled or handled exception with optional metadata
 */
export const captureException = (error, context = {}) => {
  if (sentryInstance) {
    sentryInstance.captureException(error, { extra: context });
  } else {
    console.error("[Telemetry:Error]", error, context);
  }
};

/**
 * Capture an operational event / breadcrumb
 */
export const captureEvent = (eventName, data = {}) => {
  if (sentryInstance) {
    sentryInstance.addBreadcrumb({
      category: "app.event",
      message: eventName,
      data,
      level: "info",
    });
  }
};

/**
 * Identify the current authenticated user for tracing
 */
export const setUserContext = (user) => {
  if (sentryInstance && user) {
    sentryInstance.setUser({
      id: user.id || user.user_id,
      email: user.email,
      username: user.username || user.name,
      role: user.role || user.user_type,
    });
  } else if (sentryInstance && !user) {
    sentryInstance.setUser(null);
  }
};
