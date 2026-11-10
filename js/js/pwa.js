(() => {
  const connection = document.getElementById("connectionStatus");
  const panel = document.getElementById("installPanel");
  const installButton = document.getElementById("installButton");
  const installStatus = document.getElementById("installStatus");
  const notifyButton = document.getElementById("notificationButton");
  const notifyStatus = document.getElementById("notificationStatus");
  const offlineReady = document.getElementById("offlineReady");
  let installPrompt = null;
  let registration = null;

  function updateConnection() {
    connection.hidden = navigator.onLine;
    connection.textContent = navigator.onLine ? "" :
      "You are offline. Search a previously loaded date range to view saved entries. Only saved photos are available; videos need a connection.";
  }
  window.addEventListener("online", updateConnection);
  window.addEventListener("offline", updateConnection);
  updateConnection();

  const standalone = window.matchMedia("(display-mode: standalone)");
  function updateInstalled() {
    panel.hidden = standalone.matches || navigator.standalone === true;
  }
  standalone.addEventListener("change", updateInstalled);
  updateInstalled();

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    installButton.hidden = false;
    installStatus.textContent = "Install the app to open it in its own window.";
  });

  installButton.addEventListener("click", async () => {
    if (!installPrompt) return;
    const prompt = installPrompt;
    installPrompt = null;
    installButton.hidden = true;
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      installStatus.textContent = choice.outcome === "accepted"
        ? "Installation accepted. Follow your browser's instructions."
        : "Installation dismissed. You can still install from your browser's menu.";
    } catch {
      installStatus.textContent = "Use your browser's Install app or Add to Home Screen menu.";
    }
  });

  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    installButton.hidden = true;
    panel.hidden = true;
  });

  function updateNotifications() {
    if (!("Notification" in window)) {
      notifyButton.disabled = true;
      notifyStatus.textContent = "Notifications are not supported here. On iPhone or iPad, try opening the installed Home Screen app.";
      return;
    }
    const permission = Notification.permission;
    notifyButton.disabled = !registration || permission === "denied";
    notifyButton.textContent = permission === "granted"
      ? "Send test notification" : "Enable notifications";
    notifyStatus.textContent = permission === "denied"
      ? "Notifications are blocked. You can change this in your browser's site settings."
      : permission === "granted"
        ? "Notifications are allowed. Send a test whenever you like."
        : "Choose Enable notifications to request permission.";
  }

  notifyButton.addEventListener("click", async () => {
    if (!registration || !("Notification" in window)) return;
    notifyButton.disabled = true;
    try {
      // Request directly from the click, before any other awaited work.
      const permission = Notification.permission === "default"
        ? await Notification.requestPermission() : Notification.permission;
      updateNotifications();
      if (permission === "granted") {
        await registration.showNotification("NASA Space Explorer", {
          body: "Ready to explore? Your next space discovery awaits.",
          icon: new URL("img/icon-192.png", document.baseURI).href,
          tag: "space-explorer-test"
        });
        notifyStatus.textContent = "Test notification sent. If it does not appear, check your device's notification settings.";
      } else if (permission === "default") {
        notifyStatus.textContent = "Permission was dismissed. You can try again when ready.";
      }
    } catch {
      updateNotifications();
      notifyStatus.textContent = "Could not show a notification. Check your browser and device notification settings.";
    }
  });

  async function prepareOffline() {
    if (!window.isSecureContext || !("serviceWorker" in navigator)) {
      offlineReady.textContent = "Offline access requires HTTPS or localhost and a browser with service worker support.";
      notifyStatus.textContent = "Notifications are unavailable in this browser or connection.";
      return;
    }
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.type === "NASA_CACHE_FALLBACK") {
        connection.hidden = false;
        connection.textContent = event.data.cached
          ? "NASA could not be reached. Showing saved data, which may be out of date."
          : "NASA could not be reached and this date range is not saved. Reconnect and try again.";
      } else if (event.data?.type === "NASA_NETWORK_OK") {
        updateConnection();
      }
    });
    try {
      await navigator.serviceWorker.register("./sw.js");
      registration = await navigator.serviceWorker.ready;
      offlineReady.textContent = "App ready offline. Load a date range online to save its entries and viewed photos.";
      updateNotifications();
    } catch {
      offlineReady.textContent = "Offline setup failed. Reload while connected to try again.";
      notifyStatus.textContent = "Notifications need the app's offline setup to finish.";
    }
  }
  prepareOffline();
})();