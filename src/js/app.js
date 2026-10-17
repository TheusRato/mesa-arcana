    initializeApp();
    openPushConversation();

    if ("serviceWorker" in navigator && ["https:", "http:"].includes(window.location.protocol)) {
      const hadController = Boolean(navigator.serviceWorker.controller);
      let reloadingForUpdate = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (hadController && !reloadingForUpdate) {
          reloadingForUpdate = true;
          window.location.reload();
        }
      });
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("./service-worker.js", { updateViaCache: "none" }).catch(error => {
          console.warn("Não foi possível ativar o modo app/offline.", error);
        });
      });
    }

    function refreshAfterResume() {
      if (document.visibilityState === "hidden") return;
      if ("serviceWorker" in navigator) navigator.serviceWorker.getRegistration().then(registration => registration?.update()).catch(() => {});
      if (getActiveTable()?.onlineId) refreshOnlineTable({ force: true, silent: true });
    }
    window.addEventListener("online", refreshAfterResume);
    document.addEventListener("visibilitychange", refreshAfterResume);

