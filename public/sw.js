// public/sw.js

self.addEventListener("push", (event) => {
  const data = event.data.json(); // Obtenemos los datos enviados desde el servidor

  const title = data.title || "PlantCare";
  const options = {
    body: data.body,
    icon: "/plant-care.png", // Icono que aparecerá en la notificación
    badge: "/favicon.ico",
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Opcional: Manejar clic en la notificación
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // Abre la página del calendario al hacer clic en la notificación
  event.waitUntil(clients.openWindow("/calendar"));
});
