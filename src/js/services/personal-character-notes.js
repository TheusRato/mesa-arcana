    // PIN edition: names select versions in the UI. This is not database access control.
    let personalCharacterDraft = null;

    function personalCharacterVersion(character, owner) {
      const version = character?.playerVersions?.[owner];
      return { description: version?.description ?? character?.notes ?? "", secrets: safeList(version?.secrets) };
    }

    function personalCharacterDraftChanged() {
      return personalCharacterDraft && (
        document.querySelector("#personalCharacterDescription").value !== personalCharacterDraft.description ||
        document.querySelector("#personalCharacterSecrets").value !== personalCharacterDraft.secrets);
    }

    function renderPersonalCharacterNotes(character, selectedOwner = "") {
      if (!character) return;
      const table = getActiveTable();
      const isMaster = table?.role === "master";
      const owners = isMaster ? playerSheetProfiles().map(profile => profile.name) : [table?.playerName].filter(Boolean);
      const owner = isMaster ? (owners.includes(selectedOwner) ? selectedOwner : owners[0] || "") : table?.playerName || "";
      const select = document.querySelector("#personalCharacterOwner");
      select.innerHTML = owners.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
      select.value = owner;
      select.classList.toggle("hidden", !isMaster);
      document.querySelector("#personalCharacterOwnerLabel").textContent = isMaster ? "Versão do jogador" : `Minha versão · ${owner || "Jogador não identificado"}`;
      const version = personalCharacterVersion(character, owner);
      const description = document.querySelector("#personalCharacterDescription");
      const secrets = document.querySelector("#personalCharacterSecrets");
      description.value = version.description;
      secrets.value = version.secrets.join("\n");
      description.disabled = secrets.disabled = !owner;
      document.querySelector("#savePersonalCharacterNotes").disabled = !owner;
      document.querySelector("#savePersonalCharacterNotes").textContent = isMaster ? "Salvar versão do jogador" : "Salvar minha versão";
      document.querySelector("#personalCharacterStatus").textContent = owner
        ? (isMaster ? `Descrição e segredos de ${owner}.` : "Sua versão fica separada das versões dos outros jogadores no app.")
        : "Nenhum jogador cadastrado nesta mesa.";
      personalCharacterDraft = { characterId: character.id, owner, description: description.value, secrets: secrets.value };
      document.querySelector("#editCharacterFromModal").classList.toggle("hidden", !isMaster);
      document.querySelector("#deleteCharacterFromModal").classList.toggle("hidden", !isMaster);
    }

    function savePersonalCharacterNotes() {
      const table = getActiveTable();
      const character = getCharacter(activeCharacterId);
      if (!table || !character || personalCharacterDraft?.characterId !== character.id) return;
      // Ignore a forged select value for player views; use the table's PIN identity.
      const owner = table.role === "master" ? personalCharacterDraft.owner : table.playerName;
      if (!owner) return;
      const description = document.querySelector("#personalCharacterDescription").value;
      const secrets = document.querySelector("#personalCharacterSecrets").value.split("\n").map(value => value.trim()).filter(Boolean);
      const version = { description, secrets };
      character.playerVersions = { ...(character.playerVersions || {}), [owner]: version };
      table.pendingPlayerVersions = { ...(table.pendingPlayerVersions || {}), [character.id]: {
        ...(table.pendingPlayerVersions?.[character.id] || {}), [owner]: version
      } };
      if (!persistLocalData()) {
        document.querySelector("#personalCharacterStatus").textContent = "Não foi possível salvar no dispositivo. Mantenha esta tela aberta e tente novamente.";
        return;
      }
      personalCharacterDraft.description = description;
      personalCharacterDraft.secrets = document.querySelector("#personalCharacterSecrets").value;
      scheduleCloudTableSave();
      document.querySelector("#personalCharacterStatus").textContent = table.onlineId
        ? "Versão salva neste dispositivo. Acompanhe o status da sincronização para confirmar o envio à nuvem."
        : "Versão salva neste dispositivo.";
    }

    function mergePersonalCharacterVersions(remoteCharacters, localCharacters, pending = {}, owner = null) {
      const remoteById = new Map(safeList(remoteCharacters).map(character => [character.id, character]));
      return safeList(localCharacters).map(character => {
        const remote = remoteById.get(character.id);
        const versions = { ...((remote ? remote.playerVersions : character.playerVersions) || {}) };
        const changes = pending[character.id] || {};
        Object.entries(changes).forEach(([name, version]) => {
          if (owner === null || owner === name) versions[name] = version;
        });
        return { ...character, playerVersions: versions };
      });
    }

    function acknowledgePersonalCharacterVersions(table, sent) {
      Object.entries(sent).forEach(([id, versions]) => {
        Object.entries(versions).forEach(([owner, version]) => {
          if (JSON.stringify(table.pendingPlayerVersions?.[id]?.[owner]) === JSON.stringify(version)) {
            delete table.pendingPlayerVersions[id][owner];
            if (!Object.keys(table.pendingPlayerVersions[id]).length) delete table.pendingPlayerVersions[id];
          }
        });
      });
    }
