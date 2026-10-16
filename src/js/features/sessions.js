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

    function openSession(id) {
      ensureSessions();
      const session = data.sessions.find(item => item.id === id);
      if (!session) return;
      activeSessionId = id;
      document.getElementById("sessionModalTitle").textContent = session.title || "Sessão";
      document.getElementById("sessionModalDateLabel").textContent = formatSessionDate(session.date);
      document.getElementById("sessionTitleInput").value = session.title || "";
      document.getElementById("sessionDateInput").value = session.date || "";
      document.getElementById("sessionSummaryInput").value = session.diary || "";
      renderSessionDiaryPlayerSelect(session);
      document.getElementById("sessionDiaryInput").value = getSessionDiary(session);
      document.getElementById("sessionModal").classList.remove("hidden");
    }

    function closeSession() {
      document.getElementById("sessionModal").classList.add("hidden");
      activeSessionId = null;
    }

    document.getElementById("addSessionBtn")?.addEventListener("click", () => {
      ensureSessions();
      const number = data.sessions.length + 1;
      const session = {
        id: createId(),
        title: `Sessão ${String(number).padStart(2, "0")}`,
        date: "",
        diary: "",
        playerDiaries: {}
      };
      data.sessions.push(session);
      save();
      renderSessions();
      openSession(session.id);
    });

    document.getElementById("saveSessionBtn")?.addEventListener("click", () => {
      const session = data.sessions.find(item => item.id === activeSessionId);
      if (!session) return;
      session.title = document.getElementById("sessionTitleInput").value.trim() || "Sessão";
      session.date = document.getElementById("sessionDateInput").value;
      session.diary = document.getElementById("sessionSummaryInput").value;
      setSessionDiary(session, document.getElementById("sessionDiaryInput").value);
      save();
      renderSessions();
      closeSession();
    });

    document.getElementById("sessionDiaryPlayerSelect")?.addEventListener("change", event => {
      const session = data.sessions.find(item => item.id === activeSessionId);
      if (!session) return;
      activeMasterPlayerName = event.target.value;
      renderSessionDiaryPlayerSelect(session);
      const diaryField = document.getElementById("sessionDiaryInput");
      diaryField.value = getSessionDiary(session);
      autoResizeTextarea(diaryField);
    });

    document.getElementById("deleteSessionBtn")?.addEventListener("click", () => {
      if (!activeSessionId) return;
      data.sessions = data.sessions.filter(item => item.id !== activeSessionId);
      save();
      renderSessions();
      closeSession();
    });

    document.getElementById("closeSessionModal")?.addEventListener("click", closeSession);
    document.getElementById("sessionModal")?.addEventListener("click", event => {
      if (event.target.id === "sessionModal") closeSession();
    });

