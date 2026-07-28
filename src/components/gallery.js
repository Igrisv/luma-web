// ═══════════════════════════════════════════════════════════
// gallery.js — Hub / Character Gallery Component with Tier Gating
// ═══════════════════════════════════════════════════════════
import { isCharacterLocked } from '../services/tierGate.js';
import { showToast } from './ui.js';

export function renderGallery(charactersData, activeCategory = 'all', searchQuery = '', onSelectCharacter) {
    const grid = document.getElementById('characterGrid');
    if (!grid) return;

    const officialList = charactersData.official || [];
    const customList = charactersData.custom || [];
    const allChars = [...officialList, ...customList];

    const q = searchQuery.toLowerCase().trim();

    const filtered = allChars.filter(c => {
        if (activeCategory === 'official' && !c.is_official) return false;
        if (activeCategory === 'custom' && c.is_official) return false;
        if (activeCategory === 'pareja' && c.arquetipo_id !== 'pareja') return false;
        if (activeCategory === 'rival' && c.arquetipo_id !== 'rival') return false;

        if (q) {
            const nameMatch = c.name && c.name.toLowerCase().includes(q);
            const taglineMatch = c.tagline && c.tagline.toLowerCase().includes(q);
            const descMatch = c.description && c.description.toLowerCase().includes(q);
            return nameMatch || taglineMatch || descMatch;
        }

        return true;
    });

    if (filtered.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 4rem;">No se encontraron personajes en esta categoría.</div>`;
        return;
    }

    grid.innerHTML = filtered.map(c => {
        const isLockedByTier = isCharacterLocked(c);

        return `
            <div class="character-card ${isLockedByTier ? 'locked' : ''}" data-id="${c.id}" data-locked="${isLockedByTier}">
                <div class="card-img-wrapper">
                    <img class="card-img" src="${c.avatar_url}" alt="${c.name}">
                    ${isLockedByTier ? `<span class="lock-overlay-badge">🔒 Premium</span>` : ''}
                    <span class="card-badge ${c.is_official ? 'tier-premium' : 'tier-free'}">
                        ${c.is_official ? 'Oficial' : 'Creado'}
                    </span>
                </div>
                <div class="card-body">
                    <div class="card-title">${c.name}</div>
                    <div class="card-tagline">${c.tagline || ''}</div>
                    <div class="card-desc">${c.description || c.first_message || ''}</div>
                    <div class="card-footer">
                        <button class="btn ${isLockedByTier ? 'btn-secondary' : 'btn-primary'} start-chat-btn" style="width: 100%; font-size: 0.8rem; padding: 0.45rem;">
                            ${isLockedByTier ? 'Desbloquear con Premium' : 'Iniciar Chat'}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Attach click listeners
    grid.querySelectorAll('.character-card').forEach(card => {
        card.addEventListener('click', () => {
            const charId = card.dataset.id;
            const isLocked = card.dataset.locked === 'true';
            const targetChar = allChars.find(c => c.id === charId);

            if (isLocked) {
                const billingModal = document.getElementById('billingModal') || document.getElementById('billing-modal');
                if (billingModal) billingModal.classList.remove('hidden');
                showToast(`El personaje "${targetChar?.name || ''}" requiere Plan Premium. Mejora tu suscripción para chatear.`, 'warning');
                return;
            }

            if (targetChar && onSelectCharacter) {
                onSelectCharacter(targetChar);
            }
        });
    });
}
