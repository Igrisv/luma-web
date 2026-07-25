// ═══════════════════════════════════════════════════════════
// sidebar.js — Sidebar Multi-Chat List Component with Lock Badges
// ═══════════════════════════════════════════════════════════
import { getEmotionalBadge } from '../services/cardParser.js';
import { canUseArchetype, getTier } from '../services/tierGate.js';

export function renderSidebarChatList(charactersData, activeCharId, onSelectCharacter) {
    const chatList = document.getElementById('chatList');
    if (!chatList) return;

    const allChars = [...(charactersData.official || []), ...(charactersData.custom || [])];
    const currentTier = getTier();

    if (allChars.length === 0) {
        chatList.innerHTML = '<div style="font-size: 0.78rem; color: var(--text-muted); padding: 0.5rem;">Sin conversaciones activas.</div>';
        return;
    }

    chatList.innerHTML = allChars.map(c => {
        const isActive = c.id === activeCharId || c.arquetipo_id === activeCharId;
        const configKey = `chatConfig_${c.id || c.arquetipo_id}`;
        const savedConfig = JSON.parse(localStorage.getItem(configKey) || '{}');
        const afinidad = savedConfig.afinidad !== undefined ? savedConfig.afinidad : (c.emociones_inicio ? c.emociones_inicio.afinidad : 50);

        const isLocked = (c.tier_required === 'premium' && currentTier === 'free') ||
                         (c.tier_required === 'obsesion' && currentTier !== 'obsesion') ||
                         (!canUseArchetype(c.arquetipo_id) && currentTier === 'free');

        const badgeInfo = getEmotionalBadge(savedConfig);

        return `
            <div class="chat-item ${isActive ? 'active' : ''} ${isLocked ? 'locked' : ''}" data-id="${c.id}">
                <div class="avatar-wrapper">
                    <img class="avatar-sm" src="${c.avatar_url}" alt="${c.name}">
                    <span class="status-dot" style="background:${badgeInfo.color}; box-shadow: 0 0 6px ${badgeInfo.color}"></span>
                </div>
                <div class="chat-item-info">
                    <div class="chat-item-name" style="display:flex; align-items:center; justify-content:space-between;">
                        <span>${c.name}</span>
                        ${isLocked ? `<span style="font-size:0.7rem; color:var(--accent-rose);">🔒</span>` : ''}
                    </div>
                    <div class="chat-item-sub">
                        <span>Afinidad: ${afinidad}%</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    chatList.querySelectorAll('.chat-item').forEach(item => {
        item.addEventListener('click', () => {
            const charId = item.dataset.id;
            const targetChar = allChars.find(c => c.id === charId);
            if (targetChar && onSelectCharacter) {
                onSelectCharacter(targetChar);
            }
        });
    });
}
