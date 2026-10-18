    // Individual secrets never enter `data`, tableRegistry, campaign JSON or the master vault.
    let secretPanelEpoch = 0;
    let secretPanel = null;

    async function verifiedCloudUser(interactive = false) {
      const client = getSupabaseClient();
      if (!client) throw new Error("Configure o Supabase primeiro.");
      let result = await client.auth.getUser();
      if (result.data?.user) return result.data.user;
      if (!interactive) throw new Error("Entre com sua conta verificada nas Configurações.");
      const email = await askInput({ title: "Entrar com e-mail", message: "Use sua conta pessoal. O PIN da mesa não autoriza acesso aos segredos.", inputLabel: "E-mail", confirmText: "Enviar código" });
      if (!email) throw new Error("Autenticação cancelada.");
      const sent = await client.auth.signInWithOtp({ email: email.trim() });
      if (sent.error) throw sent.error;
      const token = await askInput({ title: "Verificar e-mail", message: "Informe o código recebido por e-mail.", inputLabel: "Código", confirmText: "Entrar" });
      if (!token) throw new Error("Autenticação cancelada.");
      const verified = await client.auth.verifyOtp({ email: email.trim(), token: token.trim(), type: "email" });
      if (verified.error) throw verified.error;
      result = await client.auth.getUser();
      if (result.error || !result.data?.user) throw new Error("Não foi possível verificar a conta.");
      return result.data.user;
    }

    async function campaignIdentity(tableId, interactive = false) {
      const user = await verifiedCloudUser(interactive);
      const client = getSupabaseClient();
      const campaign = await client.from("mesa_arcana_tables").select("owner_id").eq("id", tableId).single();
      if (campaign.error) throw new Error("Conta sem acesso à campanha. Peça ao mestre para vincular seu e-mail.");
      if (campaign.data.owner_id === user.id) return { user, role: "master", name: "Mestre" };
      const member = await client.from("mesa_arcana_members").select("user_id,display_name").eq("table_id", tableId).eq("user_id", user.id).single();
      if (member.error || !member.data) throw new Error("Conta sem vínculo com esta campanha.");
      return { user, role: "player", name: member.data.display_name };
    }

    function clearIndividualSecrets() {
      secretPanelEpoch++;
      secretPanel = null;
      const input = document.querySelector("#individualSecretsInput");
      if (input) { input.value = ""; input.disabled = true; }
      const select = document.querySelector("#individualSecretsPlayer");
      if (select) select.innerHTML = "";
      const button = document.querySelector("#saveIndividualSecrets");
      if (button) button.disabled = true;
    }

    function offlineSecretsKey(table, recipient) {
      return `mesa-arcana:offline-secrets:${table.id}:${encodeURIComponent(recipient)}`;
    }

    async function loadIndividualSecrets(recipient = "", discard = false) {
      const input = document.querySelector("#individualSecretsInput");
      const select = document.querySelector("#individualSecretsPlayer");
      const status = document.querySelector("#individualSecretsStatus");
      if (!discard && secretPanel && input.value !== secretPanel.original) {
        const accepted = await askConfirm({ title: "Descartar alterações?", message: "Há segredos ainda não salvos. Descartar para carregar outra seleção?", confirmText: "Descartar" });
        if (!accepted) { select.value = secretPanel.recipient; return; }
      }
      clearIndividualSecrets();
      const epoch = secretPanelEpoch;
      const table = getActiveTable();
      const characterId = activeCharacterId;
      if (!table || !characterId) return;
      status.textContent = "Carregando segredos...";
      try {
        let recipients, identity;
        if (table.onlineId) {
          identity = await campaignIdentity(table.onlineId);
          if (identity.role === "master") {
            const result = await getSupabaseClient().from("mesa_arcana_members").select("user_id,display_name").eq("table_id", table.onlineId).order("display_name");
            if (result.error) throw result.error;
            recipients = result.data.map(member => ({ id: member.user_id, name: member.display_name }));
          } else recipients = [{ id: identity.user.id, name: identity.name }];
        } else {
          const profiles = table.role === "master" ? playerSheetProfiles().map(p => p.name) : [table.playerName];
          recipients = profiles.filter(Boolean).map(name => ({ id: name, name }));
        }
        if (epoch !== secretPanelEpoch || activeCharacterId !== characterId || getActiveTable() !== table) return;
        if (!recipients.length) throw new Error("Nenhum jogador vinculado. O mestre deve adicionar um jogador nas Configurações.");
        const selected = recipients.find(r => r.id === recipient) || recipients[0];
        select.innerHTML = recipients.map(r => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.name)}</option>`).join("");
        select.value = selected.id;
        select.disabled = recipients.length === 1;
        let record = null;
        if (table.onlineId) {
          const result = await getSupabaseClient().from("mesa_arcana_character_secrets").select("secrets,revision").eq("table_id", table.onlineId).eq("character_id", characterId).eq("player_id", selected.id).maybeSingle();
          if (result.error) throw result.error;
          record = result.data;
        } else {
          const local = JSON.parse(readLocalValue(offlineSecretsKey(table, selected.id)) || "{}");
          record = local[characterId];
        }
        if (epoch !== secretPanelEpoch || activeCharacterId !== characterId || getActiveTable() !== table) return;
        input.value = (record?.secrets || []).join("\n");
        input.disabled = false;
        secretPanel = { table, characterId, recipient: selected.id, userId: identity?.user.id, revision: record?.revision || 0, original: input.value, epoch };
        document.querySelector("#saveIndividualSecrets").disabled = false;
        status.textContent = table.onlineId
          ? `Segredos de ${selected.name}. Acesso exclusivo desta conta e do mestre da campanha.`
          : `Segredos locais de ${selected.name}. Sem sincronização; outros usuários deste navegador podem acessar o armazenamento local.`;
      } catch (error) {
        if (epoch === secretPanelEpoch) status.textContent = error.message || "Não foi possível carregar os segredos.";
      }
    }

    async function saveIndividualSecrets() {
      const panel = secretPanel;
      if (!panel || panel.saving) return;
      const input = document.querySelector("#individualSecretsInput");
      const status = document.querySelector("#individualSecretsStatus");
      const original = input.value;
      const secrets = original.split("\n").map(s => s.trim()).filter(Boolean);
      panel.saving = true;
      document.querySelector("#saveIndividualSecrets").disabled = true;
      document.querySelector("#individualSecretsPlayer").disabled = true;
      try {
        let revision = panel.revision + 1;
        if (panel.table.onlineId) {
          const identity = await campaignIdentity(panel.table.onlineId);
          if (identity.user.id !== panel.userId) throw new Error("A conta mudou. Reabra o personagem antes de salvar.");
          const result = await getSupabaseClient().rpc("mesa_save_character_secrets", {
            campaign: panel.table.onlineId, target_character: panel.characterId, recipient: panel.recipient,
            body: secrets, expected_revision: panel.revision
          });
          if (result.error) throw result.error;
          revision = result.data.revision;
        } else {
          const key = offlineSecretsKey(panel.table, panel.recipient);
          const records = JSON.parse(readLocalValue(key) || "{}");
          records[panel.characterId] = { secrets, revision };
          if (!writeLocalValue(key, JSON.stringify(records))) throw new Error("Não foi possível salvar neste dispositivo.");
        }
        if (secretPanel !== panel) return;
        panel.revision = revision;
        panel.original = original;
        status.textContent = panel.table.onlineId ? "Segredos salvos no Supabase." : "Segredos salvos somente neste dispositivo.";
      } catch (error) {
        if (secretPanel === panel) status.textContent = error.code === "40001"
          ? "Outra sessão alterou estes segredos. Copie seu texto e clique em Recarregar antes de salvar novamente. Seu rascunho foi mantido."
          : `Falha ao salvar. Rascunho mantido. ${error.message || "Verifique a conexão e sua autenticação."}`;
      } finally {
        panel.saving = false;
        if (secretPanel === panel) {
          document.querySelector("#saveIndividualSecrets").disabled = false;
          document.querySelector("#individualSecretsPlayer").disabled = document.querySelector("#individualSecretsPlayer").options.length < 2;
        }
      }
    }

    async function loginCloudAccount() {
      try {
        const user = await verifiedCloudUser(true);
        setSupabaseStatus(`Conta verificada: ${user.email}`, "synced");
        if (activeCharacterId) await loadIndividualSecrets("", true);
      } catch (error) { setSupabaseStatus(error.message, "error"); }
    }

    async function addVerifiedPlayer() {
      try {
        const table = getActiveTable();
        if (!table?.onlineId) throw new Error("Crie a mesa online primeiro.");
        const identity = await campaignIdentity(table.onlineId, true);
        if (identity.role !== "master") throw new Error("Apenas o mestre cadastrado pode vincular jogadores.");
        const email = await askInput({ title: "Vincular jogador", message: "O jogador precisa verificar o e-mail antes, usando Entrar com e-mail.", inputLabel: "E-mail do jogador", confirmText: "Continuar" });
        if (!email) return;
        const name = await askInput({ title: "Identidade na campanha", message: "Use o nome já usado pelo jogador nesta mesa para preservar fichas e anotações.", inputLabel: "Nome do jogador", confirmText: "Vincular" });
        if (!name) return;
        const result = await getSupabaseClient().rpc("mesa_add_member", { campaign: table.onlineId, player_email: email, player_name: name });
        if (result.error) throw result.error;
        setSupabaseStatus("Conta do jogador vinculada", "synced");
      } catch (error) { setSupabaseStatus(error.message, "error"); }
    }
