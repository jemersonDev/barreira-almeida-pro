importScripts("https://www.gstatic.com/firebasejs/12.2.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.2.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBPJKXelwEac06zdo8hwGr7OQuSuKQL9NA",
  authDomain: "barbearia-almeida-ada7f.firebaseapp.com",
  projectId: "barbearia-almeida-ada7f",
  storageBucket: "barbearia-almeida-ada7f.firebasestorage.app",
  messagingSenderId: "1036605751111",
  appId: "1:1036605751111:web:ff419188efe1ea12a81662",
});

const messaging = firebase.messaging();
messaging.onBackgroundMessage((payload) => {
  const notification = payload.notification || {};
  self.registration.showNotification(notification.title || "Barbearia Almeida", {
    body: notification.body || "Você tem uma atualização no seu agendamento.",
    icon: "/almeida-viking-192-v2.png",
    badge: "/almeida-viking-192-v2.png",
    data: payload.data || {},
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/";
  event.waitUntil(clients.openWindow(target));
});
