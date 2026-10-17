export function recipientsForMessage(message, conversation, tableData, subscriptions) {
  if (!conversation || conversation.table_id !== message.table_id) return [];
  const key = conversation.npc_name || '';
  const [kind, id, ...parts] = key.split(':');
  const owner = parts.join(':');
  if (!owner || !['npc', 'group'].includes(kind)) return [];
  const target = kind === 'group'
    ? (tableData.messageGroups || []).find(group => group.id === id && (group.playerNames || []).includes(owner))
    : (tableData.players || []).find(character => character.id === id && character.kind === 'NPC');
  if (!target) return [];
  const allowed = kind === 'group' || (tableData.allowedContacts || []).some(rule => typeof rule === 'string' ? rule === id : (rule.targetId || rule.contactId || rule.id) === id && (!rule.playerName || rule.playerName === owner));
  return subscriptions.filter(subscription => {
    if (message.sender_role === 'player') return message.sender_name === owner && subscription.role === 'master';
    return ['npc', 'master'].includes(message.sender_role) && allowed && subscription.role === 'player' && subscription.player_name === owner;
  });
}

export function validPushEndpoint(endpoint) {
  try {
    const url = new URL(endpoint);
    const hosts = ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com'];
    return url.protocol === 'https:' && !url.username && !url.password && (!url.port || url.port === '443') && (hosts.includes(url.hostname) || url.hostname.endsWith('.notify.windows.com'));
  } catch { return false; }
}

export function legacyHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619);
  }
  return `fallback-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
