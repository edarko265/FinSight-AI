/*
 * FinSight-AI service worker: shows notifications sent by the server and opens
 * the app when one is tapped. It caches nothing and never sees customer data
 * beyond the text of the notification itself.
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "FinSight-AI", body: event.data ? event.data.text() : "" };
  }
  const title = payload.title || "FinSight-AI";
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, {
        body: payload.body || "",
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: payload.tag || "finsight",
        data: { url: payload.url || "/insights" },
      }),
      typeof payload.badge === "number" && self.navigator.setAppBadge
        ? self.navigator.setAppBadge(payload.badge).catch(() => undefined)
        : Promise.resolve(),
    ]),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/insights";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if ("focus" in client) {
          client.navigate(url).catch(() => undefined);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
