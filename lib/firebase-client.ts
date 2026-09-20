"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { getMessaging, getToken, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyBPJKXelwEac06zdo8hwGr7OQuSuKQL9NA",
  authDomain: "barbearia-almeida-ada7f.firebaseapp.com",
  projectId: "barbearia-almeida-ada7f",
  storageBucket: "barbearia-almeida-ada7f.firebasestorage.app",
  messagingSenderId: "1036605751111",
  appId: "1:1036605751111:web:ff419188efe1ea12a81662",
};

const vapidKey = "BI-8rODReGFZQO5Mrj7FH8QWQLYU8r22zImHWl6XBdrrIYB5eaimExBn4WKMUk9-Psg4YaNvdDcGCWgM1QJWyHM";

export async function requestPushToken() {
  if (!(await isSupported()) || !("serviceWorker" in navigator)) {
    throw new Error("Este aparelho ou navegador não aceita notificações push.");
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Autorize as notificações nas configurações do navegador.");
  }
  const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const token = await getToken(getMessaging(app), { vapidKey, serviceWorkerRegistration: registration });
  if (!token) throw new Error("Não foi possível registrar este aparelho.");
  return token;
}
