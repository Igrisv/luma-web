// ═══════════════════════════════════════════════════════════
// sidebar.js — Sidebar Multi-Chat List Component with Lock Badges
// ═══════════════════════════════════════════════════════════
import { getEmotionalBadge } from '../services/cardParser.js';
import { isCharacterLocked } from '../services/tierGate.js';
import { secureStorage } from '../core/secureStorage.js';

export function renderSidebarChatList(activeCharacters, activeCharId, onSelectCharacter, onDeleteCharacter) {
    const chatList = document.getElementById('chatList');
    if (!chatList) return;

    let list = [];
    if (Array.isArray(activeCharacters)) {
        list = activeCharacters;
    } else if (activeCharacters && typeof activeCharacters === 'object') {
        const off = Array.isArray(activeCharacters.official) ? activeCharacters.official : [];
        const cust = Array.isArray(activeCharacters.custom) ? activeCharacters.custom : [];
        list = [...off, ...cust];
    }

    if (!list || list.length === 0) {
        chatList.innerHTML = '<div style="font-size: 0.78rem; color: var(--text-muted); padding: 0.75rem; text-align: center;">Sin conversaciones activas.</div>';
        return;
    }

    chatList.innerHTML = list.map(c => {
        const charKey = c.id || c.arquetipo_id;
        const isActive = charKey === activeCharId || c.id === activeCharId || c.arquetipo_id === activeCharId;
        const configKey = `chatConfig_${charKey}`;
        const savedConfigRaw = secureStorage.getItem(configKey);
        const savedConfig = savedConfigRaw ? JSON.parse(savedConfigRaw) : {};
        const afinidad = savedConfig.afinidad !== undefined ? savedConfig.afinidad : (c.emociones_inicio ? c.emociones_inicio.afinidad : 50);

        const isLocked = isCharacterLocked(c);

        const badgeInfo = getEmotionalBadge(savedConfig);

        return `
            <div class="chat-item ${isActive ? 'active' : ''} ${isLocked ? 'locked' : ''}" data-id="${charKey}">
                <div class="avatar-wrapper">
                    <img class="avatar-sm" src="${c.avatar_url}" alt="${c.name}">
                    <span class="status-dot" style="background:${badgeInfo.color}; box-shadow: 0 0 6px ${badgeInfo.color}"></span>
                </div>
                <div class="chat-item-info">
                    <div class="chat-item-name" style="display:flex; align-items:center; justify-content:space-between;">
                        <span>${c.name}</span>
                        <div style="display:flex; align-items:center; gap:4px;">
                            ${isLocked ? `<span style="font-size:0.7rem; color:var(--accent-rose);">🔒</span>` : ''}
                            <button class="btn-delete-chat-item" data-id="${charKey}" title="Eliminar conversación">🗑️</button>
                        </div>
                    </div>
                    <div class="chat-item-sub">
                        <span>Afinidad: ${afinidad}%</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    chatList.querySelectorAll('.btn-delete-chat-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const charId = btn.dataset.id;
            if (onDeleteCharacter && charId) onDeleteCharacter(charId);
        });
    });

    chatList.querySelectorAll('.chat-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.closest('.btn-delete-chat-item')) return;
            const charId = item.dataset.id;
            const targetChar = activeCharacters.find(c => (c.id || c.arquetipo_id) === charId || c.id === charId || c.arquetipo_id === charId);
            if (targetChar && onSelectCharacter) {
                onSelectCharacter(targetChar);
            }
        });
    });
}
