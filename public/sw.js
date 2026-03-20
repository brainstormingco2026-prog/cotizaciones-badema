self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? "CRM Badema", {
      body: data.body ?? "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url ?? "/dashboard" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((list) => {
      const url = event.notification.data?.url ?? "/dashboard";
      const match = list.find((c) => c.url.includes("/dashboard") && "focus" in c);
      if (match) return match.focus();
      return clients.openWindow(url);
    })
  );
});
