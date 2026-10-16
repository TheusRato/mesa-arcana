    initializeApp();

    if ("serviceWorker" in navigator && ["https:", "http:"].includes(window.location.protocol)) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("./service-worker.js").catch(error => {
          console.warn("Não foi possível ativar o modo app/offline.", error);
        });
      });
    }

