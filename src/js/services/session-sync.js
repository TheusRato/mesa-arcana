    // Session changes are explicit: an unrelated/profile save must never re-send stale diaries.
    function queueSessionChange(id, fields = {}, diaries = {}, options = {}) {
      const table = getActiveTable();
      if (!table) return;
      const old = table.pendingSessions?.[id] || {};
      table.pendingSessions = { ...(table.pendingSessions || {}), [id]: {
        ...old, ...options, fields: { ...(old.fields || {}), ...fields },
        diaries: { ...(old.diaries || {}), ...diaries }
      } };
    }

    function mergePendingSessions(remoteSessions, localSessions, pending = {}, role = "player", owner = "") {
      const localById = new Map(safeList(localSessions).map(session => [session.id, session]));
      const result = safeList(remoteSessions).map(session => ({ ...session, playerDiaries: { ...(session.playerDiaries || {}) } }));
      if (role === "master") Object.entries(pending).forEach(([id, change]) => {
        if (change.created && !change.deleted && !result.some(session => session.id === id)) {
          const local = localById.get(id) || change.created;
          result.push({ ...local, playerDiaries: { ...(local.playerDiaries || {}) } });
        }
      });
      return result.filter(session => role !== "master" || !pending[session.id]?.deleted).map(session => {
        const change = pending[session.id];
        if (!change) return session;
        const next = { ...session, playerDiaries: { ...(session.playerDiaries || {}) } };
        if (role === "master") for (const key of ["title", "date", "diary"]) {
          if (Object.hasOwn(change.fields || {}, key)) next[key] = change.fields[key];
        }
        Object.entries(change.diaries || {}).forEach(([name, text]) => {
          if (name && (role === "master" || name === owner)) next.playerDiaries[name] = text;
        });
        return next;
      });
    }

    function acknowledgeSessionChanges(table, sent) {
      Object.entries(sent).forEach(([id, change]) => {
        const current = table.pendingSessions?.[id];
        if (!current) return;
        for (const category of ["fields", "diaries"]) Object.entries(change[category] || {}).forEach(([key, value]) => {
          if (current[category]?.[key] === value) delete current[category][key];
        });
        for (const key of ["created", "deleted"]) {
          if (JSON.stringify(current[key]) === JSON.stringify(change[key])) delete current[key];
        }
        if (!Object.keys(current.fields || {}).length && !Object.keys(current.diaries || {}).length && !current.created && !current.deleted) delete table.pendingSessions[id];
      });
    }
