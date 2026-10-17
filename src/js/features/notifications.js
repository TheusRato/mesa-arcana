    let pushOperationBusy = false;
    let pushOperationError = "";
    let pushOperationIdentity = "";
    function pushStorageKey(table = getActiveTable()) {
      return `mesa-arcana-push:${supabaseConfig.url}:${table?.onlineId}:${table?.role}:${table?.playerName || ""}`;
    }

    function renderPushSettings() {
      const table = getActiveTable();
      const saved = readLocalValue(pushStorageKey());
      const supported = window.isSecureContext && "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
      document.querySelector("#enablePush").disabled = pushOperationBusy || !supported || !table?.onlineId;
      document.querySelector("#disablePush").disabled = pushOperationBusy;
      document.querySelector("#enablePush").classList.toggle("hidden", Boolean(saved));
      document.querySelector("#disablePush").classList.toggle("hidden", !saved);
      document.querySelector("#pushStatus").textContent = pushOperationIdentity === pushStorageKey() && pushOperationError ? pushOperationError : !supported
        ? "Notificações exigem HTTPS e um navegador compatível. No iPhone, abra o app instalado na tela inicial."
        : !table?.onlineId ? "Entre em uma mesa online para ativar notificações."
        : saved && Notification.permission === "granted" ? "Notificações ativadas nesta mesa e neste dispositivo. O texto poderá aparecer na tela bloqueada."
        : "Ative para receber o nome e a mensagem de quem enviou, inclusive na tela bloqueada.";
    }

    async function callPushService(payload) {
      const response = await fetch(`${supabaseConfig.url}/functions/v1/mesa-push`, {
        method: "POST", headers: { "Content-Type": "application/json", apikey: supabaseConfig.key },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(result.error || "O serviço de notificações ainda precisa ser configurado no Supabase.");
        error.status = response.status;
        throw error;
      }
      return result;
    }

    function pushPublicKey(value) {
      const binary = atob(value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - value.length % 4) % 4));
      return Uint8Array.from(binary, char => char.charCodeAt(0));
    }

    async function requestMasterPushKey(table) {
      const value = await askInput({
        title: "Confirmar acesso do Mestre",
        message: "Cole seu convite de Mestre para ativar as notificações neste dispositivo.",
        inputLabel: "Convite ou chave mestra", inputType: "password", confirmText: "Ativar"
      });
      if (value === null) return null;
      const trimmed = value.trim();
      if (!trimmed) throw new Error("Informe o convite de Mestre para continuar.");
      if (!trimmed.startsWith("MESA-ARCANA")) return trimmed;
      const invite = readInviteCode(trimmed);
      if (invite?.role !== "master" || !invite.masterKey || invite.tableId !== table.onlineId || (invite.supabaseUrl && invite.supabaseUrl !== supabaseConfig.url)) {
        throw new Error("Use um convite de Mestre válido para esta mesa.");
      }
      return invite.masterKey;
    }

    document.querySelector("#enablePush").addEventListener("click", async () => {
      const table = getActiveTable();
      if (!table?.onlineId || pushOperationBusy) return;
      const identity = pushStorageKey(table);
      pushOperationIdentity = identity;
      pushOperationBusy = true;
      pushOperationError = "";
      renderPushSettings();
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") throw new Error("Notificações não autorizadas. Você pode permitir nas configurações do navegador.");
        const config = await callPushService({ action: "config" });
        if (!config.publicKey) throw new Error("O serviço de notificações ainda precisa ser configurado no Supabase.");
        let secret = table.role === "master" ? table.masterKey || await requestMasterPushKey(table) : await askInput({
          title: "Ativar notificações", inputLabel: "Confirme seu PIN", inputType: "password", confirmText: "Ativar"
        });
        if (!secret) return;
        const registration = await navigator.serviceWorker.ready;
        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: pushPublicKey(config.publicKey) });
        const subscribe = () => callPushService({ action: "subscribe", tableId: table.onlineId, role: table.role, playerName: table.playerName || "", secret, subscription: subscription.toJSON() });
        let result;
        try { result = await subscribe(); }
        catch (error) {
          if (table.role !== "master" || error.status !== 403) throw error;
          secret = await requestMasterPushKey(table);
          if (!secret) return;
          result = await subscribe();
        }
        if (table.role === "master") {
          table.masterKey = secret;
          saveTableRegistry();
        }
        writeLocalValue(identity, JSON.stringify({ token: result.token }));
        renderPushSettings();
      } catch (error) {
        pushOperationError = error.message;
      } finally { pushOperationBusy = false; renderPushSettings(); }
    });

    document.querySelector("#disablePush").addEventListener("click", async () => {
      try {
        pushOperationIdentity = pushStorageKey();
        pushOperationError = "";
        const saved = JSON.parse(readLocalValue(pushStorageKey()) || "{}");
        await callPushService({ action: "unsubscribe", tableId: getActiveTable()?.onlineId, token: saved.token });
        removeLocalValue(pushStorageKey());
        renderPushSettings();
      } catch (error) { pushOperationError = error.message; renderPushSettings(); }
    });

    async function openPushConversation() {
      const url = new URL(window.location.href);
      const onlineId = url.searchParams.get("pushTable");
      const conversationKey = url.searchParams.get("pushConversation");
      if (!onlineId || !conversationKey) return;
      url.searchParams.delete("pushTable"); url.searchParams.delete("pushConversation");
      history.replaceState(null, "", url);
      const table = tableRegistry.find(item => item.onlineId === onlineId && (item.role === "master" || conversationKey.endsWith(`:${item.playerName}`)));
      if (!table) return;
      openTable(table.id);
      await refreshOnlineTable({ force: true, silent: true });
      if (table.role === "master") activeMasterPlayerName = "";
      const target = getMessageTargets().find(item => item.conversationKey === conversationKey);
      if (!target) return;
      activeMasterPlayerName = target.playerName;
      selectView("messages");
      await selectMessageTarget(target);
    }
