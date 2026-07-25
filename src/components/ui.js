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
    } catch (e) {}
}

export function playWhooshSound() {
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
    } catch (e) {}
}

// ── View Switcher ───────────────────────────────────────────
export function switchView(viewName) {
    const galleryView = document.getElementById('galleryView');
    const chatView = document.getElementById('chatView');

    if (viewName === 'gallery') {
        if (galleryView) galleryView.style.display = 'flex';
        if (chatView) chatView.style.display = 'none';
    } else {
        if (galleryView) galleryView.style.display = 'none';
        if (chatView) chatView.style.display = 'flex';
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

    function closeAllPanels() {
        allPanels.forEach(id => {
            const p = document.getElementById(id);
            if (p) p.classList.add('hidden');
        });
    }

    function togglePanel(panelId) {
        const panel = document.getElementById(panelId);
        if (!panel) return;
        const isHidden = panel.classList.contains('hidden');
        closeAllPanels();
        if (isHidden) {
            panel.classList.remove('hidden');
            if (panelId === 'bond-panel') brain.updateBrainUI();
        }
    }

    document.querySelectorAll('.panel-close-btn').forEach(btn => {
        btn.addEventListener('click', closeAllPanels);
    });

    const configBtn = document.getElementById('configBtn');
    const bondBtn = document.getElementById('bondBtn');
    const chatBondBtn = document.getElementById('chatBondToggleBtn');

    if (configBtn) configBtn.addEventListener('click', () => togglePanel('config-panel'));
    if (bondBtn) bondBtn.addEventListener('click', () => togglePanel('bond-panel'));
    if (chatBondBtn) chatBondBtn.addEventListener('click', () => togglePanel('bond-panel'));

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

    const clearConfigBtn = document.getElementById('clear-config-btn');
    if (clearConfigBtn) {
        clearConfigBtn.addEventListener('click', () => {
            if (confirm('¿Estás seguro de borrar el historial de conversación con este personaje?')) {
                brain.history = [];
                brain.saveState();
                if (messagesBox) messagesBox.innerHTML = '';
                closeAllPanels();
                brain.updateBrainUI();
                showToast('Historial del personaje reiniciado.', 'info');
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
    messagesBox.innerHTML = '';
    brain.history.forEach(msg => {
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
        messagesBox.appendChild(div);
    });
    messagesBox.scrollTop = messagesBox.scrollHeight;
}

export function initDiaryUI(brain) {
    const modal = document.getElementById('diary-modal');
    const closeBtn = document.getElementById('diary-close-btn');
    const openBtn = document.getElementById('open-diary-btn');
    const listContainer = document.getElementById('diary-entries-list');

    function renderDiary() {
        if (!listContainer) return;
        const entries = brain.memoryState ? (brain.memoryState.diario_entries || []) : [];
        if (entries.length === 0) {
            listContainer.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);font-style:italic;">Aún no hay confesiones registradas en el diario hoy.</div>';
            return;
        }

        listContainer.innerHTML = entries.map(entry => `
            <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border-color);border-radius:12px;padding:12px;">
                <div style="font-size:0.75rem;color:var(--accent-violet);margin-bottom:4px;">📅 ${entry.date}</div>
                <div style="font-size:0.9rem;">"${entry.text}"</div>
            </div>
        `).join('');
    }

    if (openBtn && modal) openBtn.addEventListener('click', () => { renderDiary(); modal.classList.remove('hidden'); });
    if (closeBtn && modal) closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
}

export function initRewardedAdUI(brain) {
    const modal = document.getElementById('reward-modal');
    const openBtn = document.getElementById('open-ad-btn');
    const closeBtn = document.getElementById('close-ad-btn');
    const startBtn = document.getElementById('start-ad-btn');
    const videoSim = document.getElementById('ad-video-sim');
    const timerSpan = document.getElementById('ad-timer');

    if (openBtn && modal) openBtn.addEventListener('click', () => modal.classList.remove('hidden'));
    if (closeBtn && modal) closeBtn.addEventListener('click', () => modal.classList.add('hidden'));

    if (startBtn) {
        startBtn.addEventListener('click', () => {
            startBtn.classList.add('hidden');
            if (videoSim) videoSim.classList.remove('hidden');
            let timeLeft = 5;
            if (timerSpan) timerSpan.textContent = timeLeft;

            const interval = setInterval(() => {
                timeLeft--;
                if (timerSpan) timerSpan.textContent = timeLeft;
                if (timeLeft <= 0) {
                    clearInterval(interval);
                    if (videoSim) videoSim.classList.add('hidden');
                    startBtn.classList.remove('hidden');
                    if (modal) modal.classList.add('hidden');
                    brain.dailyMessageCount = 0;
                    brain.saveState();
                    brain.updateBrainUI();
                    showToast('¡Premio otorgado! Tu saldo de mensajes ha sido recargado 🎉', 'success');
                }
            }, 1000);
        });
    }
}
