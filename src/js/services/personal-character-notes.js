    // PIN edition: names select versions in the UI, not database access control.
    let characterViewOwner = "";

    function personalCharacterVersion(character, owner) {
      const version = character?.playerVersions?.[owner] || {};
      return {
        kind: version.kind ?? character?.kind ?? "Jogador",
        name: version.name ?? character?.name ?? "",
        character: version.character ?? character?.character ?? "",
        focus: version.focus ?? character?.focus ?? "",
        state: version.state ?? character?.state ?? "Em dia",
        description: version.description ?? character?.notes ?? "",
        secrets: safeList(version.secrets)
      };
    }

    function characterVersionOwner() {
      const table = getActiveTable();
      return table?.role === "player" ? table.playerName || "" : characterViewOwner;
    }

    function characterForCurrentView(character) {
      const owner = characterVersionOwner();
      if (!owner) return character;
      const version = personalCharacterVersion(character, owner);
      return { ...character, ...version, notes: version.description };
    }

    function renderCharacterVersionSelect(character, requestedOwner = "") {
      const master = getActiveTable()?.role === "master";
      const owners = playerSheetProfiles().map(profile => profile.name);
      characterViewOwner = master ? (owners.includes(requestedOwner) ? requestedOwner : owners[0] || "") : "";
      const select = document.querySelector("#characterVersionPlayerSelect");
      select.innerHTML = owners.map(owner => `<option value="${escapeHtml(owner)}">${escapeHtml(owner)}</option>`).join("");
      select.value = characterViewOwner;
      document.querySelector("#characterVersionPlayerBox").classList.toggle("hidden", !master || !owners.length);
      document.querySelector("#deleteCharacterFromModal").classList.toggle("hidden", !master);
      document.querySelector("#editCharacterFromModal").classList.remove("hidden");
      document.querySelector("#characterPhotoUpload").classList.toggle("hidden", !master);
      document.querySelector('label[for="modalCharacterCover"]').classList.toggle("hidden", !master);
    }

    function storePersonalCharacterVersion(character, changes) {
      const table = getActiveTable();
      // Players always write their own version, regardless of DOM selection.
      const owner = table?.role === "player" ? table.playerName : "";
      if (!character || !owner) return false;
      const version = { ...personalCharacterVersion(character, owner), ...changes };
      character.playerVersions = { ...(character.playerVersions || {}), [owner]: version };
      table.pendingPlayerVersions = { ...(table.pendingPlayerVersions || {}), [character.id]: {
        ...(table.pendingPlayerVersions?.[character.id] || {}), [owner]: version
      } };
      if (!persistLocalData()) return false;
      scheduleCloudTableSave();
      return true;
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
