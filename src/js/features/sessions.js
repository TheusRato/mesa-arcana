    function ensureSessions() {
      if (!Array.isArray(data.sessions)) data.sessions = [];
    }

    function formatSessionDate(value) {
      if (!value) return "Sem data";
      const parts = value.split("-");
      return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value;
    }

    function renderSessions() {
      ensureSessions();
      const list = document.getElementById("sessionList");
      if (!list) return;
      if (!data.sessions.length) {
        list.innerHTML = '<div class="empty">Nenhuma sessão registrada ainda. Use + para criar a primeira.</div>';
        return;
      }
      list.innerHTML = data.sessions.map((session, index) => `
        <button class="session-row" data-session-id="${session.id}">
          <span class="session-number">${String(index + 1).padStart(2, "0")}</span>
          <span>
            <strong>${escapeHtml(session.title || `Sessão ${index + 1}`)}</strong>
            <small>${formatSessionDate(session.date)}${sessionHasDiary(session) ? " · Diário iniciado" : ""}</small>
          </span>
          <span class="session-arrow">›</span>
        </button>
      `).join("");
      list.querySelectorAll("[data-session-id]").forEach(button => {
        button.addEventListener("click", () => openSession(button.dataset.sessionId));
      });
    }

    let sessionDraft = null;

    function sessionDiaryOwner() {
      const table = getActiveTable();
      return table?.role === "player" ? table.playerName || "" : sessionDraft?.owner || "";
    }

    function sessionDiaryOwners(session) {
      return [...new Set([
        ...playerSheetProfiles().map(profile => profile.name),
        ...Object.keys(session?.playerDiaries || {}),
        ...Object.keys(sessionDraft?.diaryDrafts || {})
      ].filter(Boolean))];
    }

    function renderSessionDiarySelector(session) {
      const master = getActiveTable()?.role === "master";
      const owners = sessionDiaryOwners(session);
      if (master && sessionDraft && !owners.includes(sessionDraft.owner)) sessionDraft.owner = owners[0] || "";
      const owner = sessionDiaryOwner();
      const select = document.getElementById("sessionDiaryPlayerSelect");
      select.innerHTML = owners.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
      select.value = owner;
      document.getElementById("sessionDiaryPlayerBox").style.display = master && owners.length ? "block" : "none";
      document.getElementById("sessionDiaryLabel").textContent = master ? (owner ? `Diário de ${owner}` : "Diário do jogador") : "Diário do personagem";
      const field = document.getElementById("sessionDiaryInput");
      field.disabled = !owner;
      field.placeholder = owner ? `Diário de ${owner} nesta sessão.` : "Os diários aparecerão quando houver jogadores nesta mesa.";
    }

    function loadSelectedSessionDiary(session) {
      const owner = sessionDiaryOwner();
      if (!sessionDraft || !owner) { document.getElementById("sessionDiaryInput").value = ""; return; }
      if (!Object.hasOwn(sessionDraft.loadedDiaries, owner)) sessionDraft.loadedDiaries[owner] = session.playerDiaries?.[owner] ?? "";
      document.getElementById("sessionDiaryInput").value = sessionDraft.diaryDrafts[owner] ?? session.playerDiaries?.[owner] ?? "";
    }

    function captureSessionDiaryDraft() {
      const owner = sessionDiaryOwner();
      if (!sessionDraft || !owner) return;
      const text = document.getElementById("sessionDiaryInput").value;
      if (text !== (sessionDraft.loadedDiaries[owner] ?? "")) sessionDraft.diaryDrafts[owner] = text;
      else delete sessionDraft.diaryDrafts[owner];
    }

    function openSession(id) {
      ensureSessions();
      const session = data.sessions.find(item => item.id === id);
      if (!session) return;
      activeSessionId = id;
      sessionDraft = { owner: "", base: { title: session.title || "", date: session.date || "", diary: session.diary || "" }, loadedDiaries: {}, diaryDrafts: {} };
      const master = getActiveTable()?.role === "master";
      document.getElementById("sessionModalTitle").textContent = session.title || "Sessão";
      document.getElementById("sessionModalDateLabel").textContent = formatSessionDate(session.date);
      for (const [key, id] of [["title", "sessionTitleInput"], ["date", "sessionDateInput"], ["diary", "sessionSummaryInput"]]) {
        const field = document.getElementById(id);
        field.value = sessionDraft.base[key];
        field.readOnly = !master;
      }
      document.getElementById("deleteSessionBtn").classList.toggle("hidden", !master);
      document.getElementById("sessionSaveStatus").textContent = "";
      renderSessionDiarySelector(session);
      loadSelectedSessionDiary(session);
      document.getElementById("sessionModal").classList.remove("hidden");
    }

    function refreshOpenSession() {
      if (!activeSessionId || !sessionDraft) return;
      const session = data.sessions.find(item => item.id === activeSessionId);
      if (!session) {
        document.getElementById("sessionSaveStatus").textContent = "Esta sessão foi removida em outro dispositivo. Copie seu rascunho antes de fechar.";
        return;
      }
      captureSessionDiaryDraft();
      for (const [key, id] of [["title", "sessionTitleInput"], ["date", "sessionDateInput"], ["diary", "sessionSummaryInput"]]) {
        const field = document.getElementById(id);
        if (getActiveTable()?.role === "player" || field.value === sessionDraft.base[key]) {
          field.value = session[key] || "";
          sessionDraft.base[key] = field.value;
        }
      }
      renderSessionDiarySelector(session);
      const owner = sessionDiaryOwner();
      if (owner && !Object.hasOwn(sessionDraft.diaryDrafts, owner)) sessionDraft.loadedDiaries[owner] = session.playerDiaries?.[owner] ?? "";
      loadSelectedSessionDiary(session);
      document.getElementById("sessionModalTitle").textContent = session.title || "Sessão";
      document.getElementById("sessionModalDateLabel").textContent = formatSessionDate(session.date);
    }

    function closeSession() {
      document.getElementById("sessionModal").classList.add("hidden");
      activeSessionId = null;
      sessionDraft = null;
    }

    function persistSessionEdit() {
      if (!persistLocalData()) {
        document.getElementById("sessionSaveStatus").textContent = "Não foi possível salvar neste dispositivo. Seu rascunho continua aberto; tente novamente.";
        return false;
      }
      scheduleCloudTableSave();
      renderSessions();
      // Start the upload now; pending changes also survive a reload before it completes.
      if (getActiveTable()?.onlineId) saveOnlineTable();
      return true;
    }

    document.getElementById("addSessionBtn")?.addEventListener("click", () => {
      if (getActiveTable()?.role !== "master") return;
      ensureSessions();
      const session = { id: createId(), title: `Sessão ${String(data.sessions.length + 1).padStart(2, "0")}`, date: "", diary: "", playerDiaries: {} };
      data.sessions.push(session);
      queueSessionChange(session.id, {}, {}, { created: { ...session } });
      if (persistSessionEdit()) openSession(session.id);
    });

    document.getElementById("saveSessionBtn")?.addEventListener("click", () => {
      const session = data.sessions.find(item => item.id === activeSessionId);
      if (!session || !sessionDraft) return;
      captureSessionDiaryDraft();
      const fields = {};
      if (getActiveTable()?.role === "master") {
        for (const [key, id] of [["title", "sessionTitleInput"], ["date", "sessionDateInput"], ["diary", "sessionSummaryInput"]]) {
          const value = document.getElementById(id).value;
          if (value !== sessionDraft.base[key]) fields[key] = key === "title" ? value.trim() || "Sessão" : value;
        }
      }
      const diaries = { ...sessionDraft.diaryDrafts };
      Object.assign(session, fields);
      session.playerDiaries = { ...(session.playerDiaries || {}), ...diaries };
      queueSessionChange(session.id, fields, diaries);
      if (persistSessionEdit()) closeSession();
    });

    document.getElementById("sessionDiaryPlayerSelect")?.addEventListener("change", event => {
      if (getActiveTable()?.role !== "master" || !sessionDraft) return;
      const session = data.sessions.find(item => item.id === activeSessionId);
      if (!session) return;
      captureSessionDiaryDraft();
      const owner = event.target.value;
      if (!sessionDiaryOwners(session).includes(owner)) return;
      sessionDraft.owner = owner;
      renderSessionDiarySelector(session);
      loadSelectedSessionDiary(session);
      autoResizeTextarea(document.getElementById("sessionDiaryInput"));
    });

    document.getElementById("deleteSessionBtn")?.addEventListener("click", () => {
      if (!activeSessionId || getActiveTable()?.role !== "master") return;
      const id = activeSessionId;
      data.sessions = data.sessions.filter(item => item.id !== id);
      queueSessionChange(id, {}, {}, { deleted: true });
      if (persistSessionEdit()) closeSession();
    });

    document.getElementById("closeSessionModal")?.addEventListener("click", closeSession);
    document.getElementById("sessionModal")?.addEventListener("click", event => {
      if (event.target.id === "sessionModal") closeSession();
    });
