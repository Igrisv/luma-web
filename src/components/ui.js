// ═══════════════════════════════════════════════════════════
// components/ui.js — UI Controller & Component Aggregator
// ═══════════════════════════════════════════════════════════
import { ARQUETIPOS } from '../core/brain.js';
import { apiFetch } from '../services/auth.js';
import { parseCharacterCardPNG, getEmotionalBadge } from '../services/cardParser.js';
import { renderGallery } from './gallery.js';
import { renderSidebarChatList } from './sidebar.js';
import { initCreatorWizard } from './wizard.js';
import { initCardImporter } from './importer.js';
import { adManager } from '../services/adService.js';
import { getTier } from '../services/tierGate.js';
import { secureStorage } from '../core/secureStorage.js';

export {
    parseCharacterCardPNG,
    getEmotionalBadge,
    renderGallery,
    renderSidebarChatList,
    initCreatorWizard,
    initCardImporter
};

window.logInspector = function (type, content) {
    const box = document.getElementById('inspector-log');
    if (!box) return;
    const item = document.createElement('div');
    item.className = 'log-item';
    let text = typeof content === 'object' ? JSON.stringify(content, null, 2) : String(content);
    text = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    item.innerHTML = `<strong>${type}</strong><pre>${text}</pre>`;
    box.appendChild(item);
    box.scrollTop = box.scrollHeight;
};

// ── Sound Effects ───────────────────────────────────────────
let audioCtx = null;
function getAudioCtx() {
    if (!audioCtx) {
        const AudioCtxCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtxCtor) return null;
        audioCtx = new AudioCtxCtor();
    }
    return audioCtx;
}

export function playPopSound() {
    if (localStorage.getItem('lumaSoundEnabled') === 'false') return;
    try {
        const ctx = getAudioCtx();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.15);
    } catch (e) { }
}

export function playWhooshSound() {
    if (localStorage.getItem('lumaSoundEnabled') === 'false') return;
    try {
        const ctx = getAudioCtx();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.1);
    } catch (e) { }
}

export function playClickDropSound() {
    if (localStorage.getItem('lumaSoundEnabled') === 'false') return;
    try {
        const ctx = getAudioCtx();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.08);
    } catch (e) { }
}

export function playHoverTickSound() {
    if (localStorage.getItem('lumaSoundEnabled') === 'false') return;
    try {
        const ctx = getAudioCtx();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(1200, ctx.currentTime);
        gain.gain.setValueAtTime(0.02, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.03);
    } catch (e) { }
}

// ── View Switcher ───────────────────────────────────────────
export function switchView(viewName) {
    console.log('[DEBUG UI] switchView called with:', viewName);
    const galleryView = document.getElementById('galleryView');
    const chatView = document.getElementById('chatView');
    const btnGallery = document.getElementById('navSegmentGallery');
    const btnChat = document.getElementById('navSegmentChat');

    console.log('[DEBUG UI] Elements found:', { galleryView: !!galleryView, chatView: !!chatView });

    if (viewName === 'gallery') {
        if (galleryView) galleryView.style.display = 'flex';
        if (chatView) chatView.style.display = 'none';
        if (btnGallery) btnGallery.classList.add('active');
        if (btnChat) btnChat.classList.remove('active');
    } else {
        if (galleryView) galleryView.style.display = 'none';
        if (chatView) chatView.style.display = 'flex';
        if (btnChat) btnChat.classList.add('active');
        if (btnGallery) btnGallery.classList.remove('active');
    }
}

// ── Toast Notification System ───────────────────────────────
export function showToast(message, type = 'info', duration = 4000) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const iconMap = { error: '⚠️', success: '✅', warning: '⚡', info: 'ℹ️' };
    toast.innerHTML = `<span class="toast-icon">${iconMap[type] || 'ℹ️'}</span><span class="toast-message">${message}</span>`;

    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ── Panels & Modals Manager ──────────────────────────────────
export function initPanels(brain) {
    const allPanels = ['config-panel', 'bond-panel'];
    const dock = document.querySelector('.chat-floating-actions-dock');

    function closeAllPanels() {
        allPanels.forEach(id => {
            const p = document.getElementById(id);
            if (p) p.classList.add('hidden');
        });
        if (dock) dock.classList.remove('hidden');
    }

    function togglePanel(panelId) {
        const panel = document.getElementById(panelId);
        if (!panel) return;
        const isHidden = panel.classList.contains('hidden');
        closeAllPanels();
        if (isHidden) {
            panel.classList.remove('hidden');
            if (dock) dock.classList.add('hidden');
            if (panelId === 'bond-panel') brain.updateBrainUI();
        }
    }

    document.querySelectorAll('.panel-close-btn').forEach(btn => {
        btn.addEventListener('click', closeAllPanels);
    });

    const configBtn = document.getElementById('configBtn');
    const bondBtn = document.getElementById('bondBtn');
    const chatBondBtn = document.getElementById('chatBondToggleBtn');

    const dockBondBtn = document.getElementById('dockBondBtn');
    const dockDiaryBtn = document.getElementById('dockDiaryBtn');
    const dockConfigBtn = document.getElementById('dockConfigBtn');

    if (configBtn) configBtn.addEventListener('click', () => togglePanel('config-panel'));
    if (bondBtn) bondBtn.addEventListener('click', () => togglePanel('bond-panel'));
    if (chatBondBtn) chatBondBtn.addEventListener('click', () => togglePanel('bond-panel'));

    if (dockBondBtn) dockBondBtn.addEventListener('click', () => togglePanel('bond-panel'));
    if (dockConfigBtn) dockConfigBtn.addEventListener('click', () => togglePanel('config-panel'));
    if (dockDiaryBtn) {
        dockDiaryBtn.addEventListener('click', () => {
            closeAllPanels();
            const diaryModal = document.getElementById('diary-modal');
            if (diaryModal) diaryModal.classList.remove('hidden');
        });
    }

    const bondHeroCard = document.getElementById('bond-hero-card') || document.querySelector('.bond-hero-card');
    if (bondHeroCard) {
        bondHeroCard.addEventListener('click', () => {
            renderBondJourneyUI(brain);
            const journeyModal = document.getElementById('bond-journey-modal');
            if (journeyModal) journeyModal.classList.remove('hidden');
        });
    }

    const closeJourneyBtn = document.getElementById('close-bond-journey-btn');
    if (closeJourneyBtn) {
        closeJourneyBtn.addEventListener('click', () => {
            const journeyModal = document.getElementById('bond-journey-modal');
            if (journeyModal) journeyModal.classList.add('hidden');
        });
    }

    // Click-Outside Listener for Side Panels (config-panel, bond-panel)
    document.addEventListener('click', (e) => {
        const configPanel = document.getElementById('config-panel');
        const bondPanel = document.getElementById('bond-panel');

        const isClickInsideConfig = configPanel && configPanel.contains(e.target);
        const isClickInsideBond = bondPanel && bondPanel.contains(e.target);

        const isConfigTrigger = e.target.closest('#configBtn, #dockConfigBtn');
        const isBondTrigger = e.target.closest('#bondBtn, #dockBondBtn, #chatBondToggleBtn');

        if (configPanel && !configPanel.classList.contains('hidden') && !isClickInsideConfig && !isConfigTrigger) {
            closeAllPanels();
        }
        if (bondPanel && !bondPanel.classList.contains('hidden') && !isClickInsideBond && !isBondTrigger) {
            closeAllPanels();
        }
    });

    // Click-Outside Listener for Modal Backdrops (reward-modal, billing-modal, diary-modal, bond-journey-modal, etc.)
    const modalIds = ['reward-modal', 'billingModal', 'billing-modal', 'diary-modal', 'creator-wizard-modal', 'card-importer-modal', 'bond-journey-modal'];
    modalIds.forEach(id => {
        const modalEl = document.getElementById(id);
        if (modalEl) {
            modalEl.addEventListener('click', (e) => {
                // If user clicks directly on the backdrop container, close the modal
                if (e.target === modalEl || e.target.classList.contains('modal-overlay')) {
                    modalEl.classList.add('hidden');
                }
            });
        }
    });

    return { closeAllPanels, togglePanel };
}

export function initConfigPanel(brain, closeAllPanels, messagesBox) {
    const openBillingBtn = document.getElementById('open-billing-btn');
    if (openBillingBtn) {
        openBillingBtn.addEventListener('click', () => {
            closeAllPanels();
            const billingModal = document.getElementById('billingModal') || document.getElementById('billing-modal');
            if (billingModal) billingModal.classList.remove('hidden');
        });
    }

    function updateUserSettingsProfile() {
        const currentTier = getTier();
        const settingsTierLabel = document.getElementById('settingsTierLabel');
        const userSettingsTierBadge = document.getElementById('userSettingsTierBadge');
        const statUserMessages = document.getElementById('statUserMessages');
        const statUserBots = document.getElementById('statUserBots');
        const statUserAffinity = document.getElementById('statUserAffinity');

        if (settingsTierLabel) settingsTierLabel.textContent = `Plan ${currentTier.toUpperCase()}`;
        if (userSettingsTierBadge) userSettingsTierBadge.textContent = `Plan ${currentTier.toUpperCase()}`;

        const customCount = JSON.parse(localStorage.getItem('lumaCustomCharacters') || '[]').length;
        if (statUserBots) statUserBots.textContent = `${customCount + 1} Bots`;

        const usedToday = window.lumaDailyCount || 0;
        const maxMsgs = currentTier === 'free' ? 15 : '∞';
        if (statUserMessages) statUserMessages.textContent = `${usedToday}/${maxMsgs}`;
        if (statUserAffinity) statUserAffinity.textContent = `${brain ? brain.afinidad : 70}%`;
    }

    updateUserSettingsProfile();

    const configBtn = document.getElementById('configBtn');
    const dockConfigBtn = document.getElementById('dockConfigBtn');
    if (configBtn) configBtn.addEventListener('click', updateUserSettingsProfile);
    if (dockConfigBtn) dockConfigBtn.addEventListener('click', updateUserSettingsProfile);

    const soundToggle = document.getElementById('settingSoundEffects');
    if (soundToggle) {
        soundToggle.checked = localStorage.getItem('lumaSoundEnabled') !== 'false';
        soundToggle.addEventListener('change', () => {
            localStorage.setItem('lumaSoundEnabled', soundToggle.checked);
            showToast(soundToggle.checked ? 'Efectos de sonido activados 🔊' : 'Sonidos desactivados 🔇', 'info');
        });
    }

    const ttsToggle = document.getElementById('settingTTS');
    if (ttsToggle) {
        ttsToggle.checked = localStorage.getItem('lumaTTSEnabled') === 'true';
        ttsToggle.addEventListener('change', () => {
            localStorage.setItem('lumaTTSEnabled', ttsToggle.checked);
            showToast(ttsToggle.checked ? 'Lectura por voz activada 🎙️' : 'Voz sintetizada desactivada 🔇', 'info');
        });
    }

    const autoToggle = document.getElementById('settingAutoMessages');
    if (autoToggle) {
        autoToggle.checked = localStorage.getItem('lumaAutoMessagesEnabled') !== 'false';
        autoToggle.addEventListener('change', () => {
            localStorage.setItem('lumaAutoMessagesEnabled', autoToggle.checked);
            showToast(autoToggle.checked ? 'Mensajes autónomos activados ⚡' : 'Mensajes autónomos pausados', 'info');
        });
    }

    const devToggle = document.getElementById('settingDevMode');
    const inspectorLog = document.getElementById('inspector-log');
    if (devToggle) {
        const isDev = localStorage.getItem('lumaDevModeEnabled') === 'true';
        devToggle.checked = isDev;
        if (inspectorLog) inspectorLog.style.display = isDev ? 'block' : 'none';

        devToggle.addEventListener('change', () => {
            localStorage.setItem('lumaDevModeEnabled', devToggle.checked);
            if (inspectorLog) inspectorLog.style.display = devToggle.checked ? 'block' : 'none';
            showToast(devToggle.checked ? '🛠️ Modo Desarrollador y Telemetría Activados' : 'Modo Desarrollador Desactivado', 'info');
        });
    }

    const clearConfigBtn = document.getElementById('clear-config-btn');
    if (clearConfigBtn) {
        clearConfigBtn.addEventListener('click', () => {
            if (confirm('¿Estás seguro de reiniciar la historia con este personaje? Se borrará la memoria y podrás elegir el modo de relación inicial nuevamente.')) {
                const charId = brain.characterId;
                secureStorage.removeItem(`chatConfig_${charId}`);
                secureStorage.removeItem(`chatHistory_${charId}`);
                brain.history = [];
                if (messagesBox) messagesBox.innerHTML = '';
                closeAllPanels();
                showToast('Historial y memoria borrados.', 'info');
                window.location.reload();
            }
        });
    }
}

// ── Message bubble creation with italicized actions ─────────
export function createMessageElement(text, sender) {
    const div = document.createElement('div');
    div.className = `msg-row ${sender === 'user' ? 'user' : 'bot'}`;

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';

    let formatted = text.replace(/\*([^*]+)\*/g, '<span class="msg-actions">*$1*</span>');
    bubble.innerHTML = formatted;

    div.appendChild(bubble);
    return div;
}

export function renderHistory(brain, messagesBox) {
    if (!messagesBox) return;
    const targetContainer = document.getElementById('messagesList') || messagesBox;
    targetContainer.innerHTML = '';

    brain.history
        .filter(msg => msg && msg.role !== 'system')
        .forEach(msg => {
            const role = msg.role === 'user' ? 'user' : 'bot';
            let renderText = msg.content;

            if (role === 'bot') {
                let extracted = brain.extractTag ? brain.extractTag(msg.content, 'respuesta') : null;
                if (!extracted) {
                    extracted = msg.content.replace(/<[^>]+>[\s\S]*?<\/[^>]+>/g, '').replace(/<[^>]+>/g, '').trim();
                }
                if (extracted) renderText = extracted;
            }

            const div = createMessageElement(renderText, role);
            targetContainer.appendChild(div);
        });
    messagesBox.scrollTop = messagesBox.scrollHeight;
}

export function initDiaryUI(brain) {
    const modal = document.getElementById('diary-modal');
    const closeBtn = document.getElementById('diary-close-btn');
    const openBtn = document.getElementById('open-diary-btn');
    const generateBtn = document.getElementById('generateDiaryBtn');
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');

    const leftContent = document.getElementById('diaryPageLeftContent');
    const rightContent = document.getElementById('diaryPageRightContent');
    const leftPageNum = document.getElementById('diaryPageLeftNum');
    const rightPageNum = document.getElementById('diaryPageRightNum');
    const rightDate = document.getElementById('diaryPageRightDate');

    let currentEntryIndex = 0;

    function renderBookPages() {
        const entries = brain.memoryState ? (brain.memoryState.diario_entries || []) : [];

        if (entries.length === 0) {
            if (leftContent) leftContent.innerHTML = `<div class="diary-handwritten-text" style="color:var(--text-muted);font-style:italic;">Querido diario... aún no he escrito mis pensamientos sobre esta persona.</div>`;
            if (rightContent) rightContent.innerHTML = `<div class="diary-handwritten-text" style="color:var(--text-muted);font-style:italic;">Haz clic abajo en "✍️ Escribir Nueva Confesión" para redactar mi primer pensamiento de hoy.</div>`;
            if (leftPageNum) leftPageNum.textContent = 'Pág. 1';
            if (rightPageNum) rightPageNum.textContent = 'Pág. 2';
            if (rightDate) rightDate.textContent = 'Reciente';
            return;
        }

        const leftEntry = entries[currentEntryIndex];
        const rightEntry = entries[currentEntryIndex + 1];

        if (leftContent) {
            leftContent.innerHTML = leftEntry ? `
                <div style="font-size:0.75rem;color:var(--accent-violet);margin-bottom:6px;">📅 ${leftEntry.date}</div>
                <div class="diary-handwritten-text">"${leftEntry.text}"</div>
            ` : `<div class="diary-handwritten-text" style="color:var(--text-muted);">Página en blanco.</div>`;
        }

        if (rightContent) {
            rightContent.innerHTML = rightEntry ? `
                <div style="font-size:0.75rem;color:#ec4899;margin-bottom:6px;">📅 ${rightEntry.date}</div>
                <div class="diary-handwritten-text">"${rightEntry.text}"</div>
            ` : `<div class="diary-handwritten-text" style="color:var(--text-muted);">Fin de las reflexiones por ahora...</div>`;
        }

        if (leftPageNum) leftPageNum.textContent = `Pág. ${currentEntryIndex + 1}`;
        if (rightPageNum) rightPageNum.textContent = `Pág. ${currentEntryIndex + 2}`;
        if (rightDate) rightDate.textContent = leftEntry ? leftEntry.date : '---';
    }

    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', () => {
            if (currentEntryIndex > 0) {
                currentEntryIndex -= 2;
                if (currentEntryIndex < 0) currentEntryIndex = 0;
                playPopSound();
                renderBookPages();
            }
        });
    }

    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => {
            const entries = brain.memoryState ? (brain.memoryState.diario_entries || []) : [];
            if (currentEntryIndex + 2 < entries.length) {
                currentEntryIndex += 2;
                playPopSound();
                renderBookPages();
            }
        });
    }

    if (generateBtn) {
        generateBtn.addEventListener('click', async () => {
            generateBtn.disabled = true;
            generateBtn.textContent = '✒️ Mojando la pluma y escribiendo...';
            try {
                await brain.generateDiaryEntry();
                currentEntryIndex = 0;
                renderBookPages();
                playPopSound();
                if (showToast) showToast('Nueva confesión escrita en el diario 📖', 'success');
            } catch (e) {
                console.error(e);
            } finally {
                generateBtn.disabled = false;
                generateBtn.textContent = '✍️ Escribir Nueva Confesión (Reflexión de Hoy)';
            }
        });
    }

    if (openBtn && modal) openBtn.addEventListener('click', () => { currentEntryIndex = 0; renderBookPages(); modal.classList.remove('hidden'); });
    if (closeBtn && modal) closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
}

export function initRewardedAdUI(brain) {
    const modal = document.getElementById('reward-modal');
    const openBtn = document.getElementById('open-ad-btn');
    const closeBtn = document.getElementById('close-ad-btn');
    const startBtn = document.getElementById('start-ad-btn');
    const videoPlayer = document.getElementById('ad-video-player');
    const imaContainer = document.getElementById('ad-ima-container');
    const progressBar = document.getElementById('ad-progress-bar');
    const timerSpan = document.getElementById('ad-timer');
    const muteBtn = document.getElementById('ad-mute-btn');
    const sponsorTitle = document.getElementById('ad-sponsor-title');
    const sponsorSubtitle = document.getElementById('ad-sponsor-subtitle');
    const statusText = document.getElementById('ad-status-text');

    const descText = document.getElementById('ad-description-text');
    let isAdBlockActiveState = false;

    const openAdModal = async () => {
        if (!modal) return;
        modal.classList.remove('hidden');
        if (sponsorTitle) sponsorTitle.textContent = 'Verificando red publicitaria...';

        const ad = await adManager.loadAd();
        if (ad && ad.isAdBlocker) {
            isAdBlockActiveState = true;
            if (sponsorTitle) sponsorTitle.textContent = '🛡️ Bloqueador de Anuncios Detectado';
            if (sponsorSubtitle) sponsorSubtitle.textContent = 'Acción Requerida para Recargar Mensajes';
            if (descText) {
                descText.innerHTML = `
                    <div style="background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 12px; padding: 0.85rem; color: #fca5a5; font-size: 0.82rem; text-align: left; margin-bottom: 0.85rem; line-height: 1.45;">
                        <div style="font-weight: 700; font-size: 0.9rem; margin-bottom: 0.35rem; color: #ef4444;">🛡️ AdBlock / Brave Shields Activo</div>
                        No podemos cargar la red de anuncios porque tu navegador tiene un bloqueador activado.<br><br>
                        👉 <strong>Cómo resolverlo:</strong> Desactiva el bloqueador de anuncios para <strong>Melora AI</strong> y haz clic en <em>Reintentar Anuncio</em> para recibir tus <strong>+5 Mensajes Gratis</strong>.
                    </div>
                `;
            }
            if (statusText) statusText.textContent = 'Desactiva tu AdBlocker';
            if (startBtn) {
                startBtn.disabled = false;
                startBtn.textContent = '🔄 Reintentar Anuncio';
                startBtn.classList.remove('hidden');
            }
            return;
        }

        isAdBlockActiveState = false;
        if (descText) descText.textContent = 'Mira el video publicitario para recargar tu cuota diaria de mensajes inmediatamente.';
        if (ad) {
            if (sponsorTitle) sponsorTitle.textContent = ad.title || 'Anuncio Patrocinado';
            if (sponsorSubtitle) sponsorSubtitle.textContent = `Patrocinado por ${ad.sponsor || 'Red Publicitaria'}`;
        }
        if (startBtn) {
            startBtn.disabled = false;
            startBtn.textContent = '▶ Ver Anuncio Ahora';
            startBtn.classList.remove('hidden');
        }
        if (progressBar) progressBar.style.width = '0%';
        if (timerSpan) timerSpan.textContent = adManager.requiredSeconds;
    };

    const closeAdModal = () => {
        if (!modal) return;
        adManager.cancelAd();
        if (videoPlayer) {
            videoPlayer.pause();
            videoPlayer.src = '';
        }
        if (imaContainer) imaContainer.classList.add('hidden');
        modal.classList.add('hidden');
    };

    if (openBtn) openBtn.addEventListener('click', openAdModal);
    if (closeBtn) closeBtn.addEventListener('click', closeAdModal);

    if (muteBtn && videoPlayer) {
        muteBtn.addEventListener('click', () => {
            videoPlayer.muted = !videoPlayer.muted;
            muteBtn.textContent = videoPlayer.muted ? '🔇 En silencio' : '🔊 Con sonido';
        });
    }

    if (startBtn) {
        startBtn.addEventListener('click', async () => {
            if (isAdBlockActiveState) {
                showToast('Comprobando si el bloqueador de anuncios fue desactivado...', 'info');
                await openAdModal();
                if (isAdBlockActiveState) {
                    showToast('El bloqueador sigue activo. Por favor desactívalo para continuar.', 'warning');
                    return;
                }
            }

            startBtn.disabled = true;
            startBtn.textContent = '⏳ Reproduciendo anuncio...';

            adManager.startAdPlayback({
                videoElement: videoPlayer,
                imaContainerElement: imaContainer,
                onProgress: ({ remaining, percent }) => {
                    if (timerSpan) timerSpan.textContent = remaining;
                    if (progressBar) progressBar.style.width = `${percent}%`;
                    if (statusText) statusText.textContent = remaining > 0 ? `Visualizando anuncio (${remaining}s)...` : '¡Completado!';
                },
                onComplete: (data) => {
                    showToast('🎉 ¡Recompensa otorgada! Tu cuota de mensajes ha sido recargada.', 'success');
                    if (brain) {
                        brain.dailyMessageCount = 0;
                        window.lumaDailyCount = 0;
                        brain.saveState();
                        brain.updateBrainUI();
                    }
                    setTimeout(() => {
                        closeAdModal();
                    }, 1000);
                },
                onError: (err) => {
                    showToast('Error al procesar la recompensa. Inténtalo de nuevo.', 'error');
                    startBtn.disabled = false;
                    startBtn.textContent = '▶ Reintentar Anuncio';
                }
            });
        });
    }
}

// Global Escape key listener to close active modal overlays
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modals = document.querySelectorAll('.modal-overlay:not(.hidden), #bond-journey-modal:not(.hidden), #reward-modal:not(.hidden)');
        if (modals.length > 0) {
            playClickDropSound();
            modals.forEach(modal => modal.classList.add('hidden'));
        }
    }
});

// ── Bond Journey & Empathy Badges Renderer ────────────────────
export function renderBondJourneyUI(brain) {
    if (!brain) return;

    const modal = document.getElementById('bond-journey-modal');
    if (!modal) return;

    const nivelInfo = brain.getNivelInfo();
    const dias = brain.diasActivos ? brain.diasActivos.length : 1;

    // 1. Header & Banner Updates
    const emojiEl = document.getElementById('journey-level-emoji');
    const nameEl = document.getElementById('journey-level-name');
    const daysEl = document.getElementById('journey-days-badge');
    const nextMilestoneEl = document.getElementById('journey-next-milestone-text');
    const progressFill = document.getElementById('journey-progress-fill');
    const progressPercent = document.getElementById('journey-progress-percent');

    if (emojiEl) emojiEl.textContent = nivelInfo.icono || '🌒';
    if (nameEl) nameEl.textContent = `Nivel: ${nivelInfo.nombre}`;
    if (daysEl) daysEl.textContent = `${dias} ${dias === 1 ? 'día compartido' : 'días compartidos'}`;

    let pct = 100;
    if (nivelInfo.siguiente) {
        const currentMin = nivelInfo.minDias;
        const nextMin = nivelInfo.siguiente.minDias;
        const remaining = nextMin - dias;
        pct = Math.round(((dias - currentMin) / (nextMin - currentMin)) * 100);
        pct = Math.min(100, Math.max(10, pct));
        if (nextMilestoneEl) {
            nextMilestoneEl.textContent = `Próximo hito: ${nivelInfo.siguiente.nombre} en ${remaining} ${remaining === 1 ? 'día' : 'días'}`;
        }
    } else {
        if (nextMilestoneEl) {
            nextMilestoneEl.textContent = '¡Has alcanzado el máximo vínculo de confianza!';
        }
    }

    if (progressFill) progressFill.style.width = `${pct}%`;
    if (progressPercent) progressPercent.textContent = `${pct}%`;

    // 2. Render Timeline (5 Levels)
    const timelineList = document.getElementById('roadmap-timeline-list');
    if (timelineList) {
        const levelsBenefits = [
            { level: 0, title: 'Extraños', minDias: 0, icon: '🌑', benefit: 'Inicio del viaje emocional. Conversación respetuosa descubriendo tus primeros gustos.' },
            { level: 1, title: 'Conocidos', minDias: 2, icon: '🌒', benefit: 'Mayor fluidez y calidez. Se interesa proactivamente por tus rutinas diarias.' },
            { level: 2, title: 'Amigos', minDias: 5, icon: '🌓', benefit: 'Uso de apodos afectuosos, humor compartido y recuerdos episódicos de pláticas pasadas.' },
            { level: 3, title: 'Cercanos', minDias: 10, icon: '🌔', benefit: 'Revelaciones personales profundas, empatía activa ante tu estado de ánimo y consejos íntimos.' },
            { level: 4, title: 'Íntimos', minDias: 20, icon: '🌕', benefit: 'Vínculo inquebrantable, complicidad total, confidencias secretas y máxima lealtad afectiva.' }
        ];

        timelineList.innerHTML = levelsBenefits.map(lvl => {
            const isCompleted = dias >= lvl.minDias;
            const isCurrent = nivelInfo.nivel === lvl.level;
            const statusClass = isCurrent ? 'current' : (isCompleted ? 'completed' : 'locked');
            const iconSymbol = isCurrent ? lvl.icon : (isCompleted ? '✓' : '🔒');

            return `
                <div class="roadmap-step-item ${statusClass}">
                    <div class="step-status-indicator">${iconSymbol}</div>
                    <div class="step-details">
                        <div class="step-header-row">
                            <span class="step-title">${lvl.title}</span>
                            <span class="step-days-badge">${lvl.minDias === 0 ? 'Día 1' : `${lvl.minDias}+ días`}</span>
                        </div>
                        <p class="step-benefit-text">${lvl.benefit}</p>
                    </div>
                </div>
            `;
        }).join('');
    }

    // 3. Render Empathy Badges Grid
    const badgeGrid = document.getElementById('empathy-badge-grid');
    if (badgeGrid) {
        const historyLen = brain.history ? brain.history.length : 0;
        const afinidad = brain.afinidad || 50;
        const episodiosCount = (brain.memoryState && brain.memoryState.episodios) ? brain.memoryState.episodios.length : 0;

        const badges = [
            {
                id: 'first_contact',
                icon: '⚡',
                name: 'Primer Encuentro',
                desc: 'Iniciar tus primeras conversaciones y dar el primer paso en la relación.',
                unlocked: historyLen > 0 || dias >= 1
            },
            {
                id: 'true_chemistry',
                icon: '💖',
                name: 'Química Real',
                desc: 'Lograr una afinidad igual o superior al 70% a través de empatía recíproca.',
                unlocked: afinidad >= 70
            },
            {
                id: 'morning_buddy',
                icon: '☕',
                name: 'Compañero de Mañanas',
                desc: 'Compartir charlas al comenzar el día y mantener una rutina activa.',
                unlocked: dias >= 2
            },
            {
                id: 'night_owl',
                icon: '🌙',
                name: 'Noctámbulo',
                desc: 'Tener conversaciones íntimas durante la madrugada o altas horas de la noche.',
                unlocked: dias >= 3 || historyLen >= 15
            },
            {
                id: 'intimate_reader',
                icon: '📖',
                name: 'Lector Íntimo',
                desc: 'Construir una memoria compartida con anécdotas y episodios en el diario.',
                unlocked: episodiosCount > 0 || historyLen >= 20
            },
            {
                id: 'unbreakable_bond',
                icon: '🛡️',
                name: 'Vínculo Inquebrantable',
                desc: 'Alcanzar los niveles más altos de confianza y cercanía emocional.',
                unlocked: nivelInfo.nivel >= 3
            }
        ];

        badgeGrid.innerHTML = badges.map(b => {
            const statusClass = b.unlocked ? 'unlocked' : 'locked';
            const statusText = b.unlocked ? 'Desbloqueada' : 'Bloqueada';

            return `
                <div class="empathy-badge-card ${statusClass}">
                    <div class="badge-icon-box">${b.icon}</div>
                    <div class="badge-info">
                        <div class="badge-name-row">
                            <span class="badge-name">${b.name}</span>
                            <span class="badge-status-tag ${statusClass}">${statusText}</span>
                        </div>
                        <p class="badge-desc">${b.desc}</p>
                    </div>
                </div>
            `;
        }).join('');
    }
}
