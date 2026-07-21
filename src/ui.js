// ═══════════════════════════════════════════════════════════
// ui.js — Rendering de mensajes, paneles, animaciones, debug
// ═══════════════════════════════════════════════════════════
import { ARQUETIPOS } from './brain.js';
import { apiFetch } from './auth.js';

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

// ── Sound Effects (Web Audio API — no external files) ───────
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
    } catch (e) { /* audio not available */ }
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
    } catch (e) { /* audio not available */ }
}

// ── Panel manager ───────────────────────────────────────────
export function initPanels(brain) {
    const allPanels = ['config-panel', 'bond-panel', 'brain-panel', 'inspector-panel'];

    function closeAllPanels() {
        allPanels.forEach(id => {
            const p = document.getElementById(id);
            if (p) p.classList.add('hidden');
        });
        const overlay = document.getElementById('panel-overlay');
        if (overlay) overlay.classList.add('hidden');
    }

    function togglePanel(panelId) {
        const panel = document.getElementById(panelId);
        if (!panel) return;
        const isHidden = panel.classList.contains('hidden');
        closeAllPanels();
        if (isHidden) {
            panel.classList.remove('hidden');
            const overlay = document.getElementById('panel-overlay');
            if (overlay) overlay.classList.remove('hidden');
            if (panelId === 'bond-panel') brain.updateBrainUI();
        }
    }

    const overlay = document.getElementById('panel-overlay');
    if (overlay) overlay.addEventListener('click', closeAllPanels);
    document.querySelectorAll('.panel-close-btn').forEach(btn => {
        btn.addEventListener('click', closeAllPanels);
    });

    const configBtn = document.getElementById('config-btn');
    const bondBtn = document.getElementById('bond-btn');
    const brainBtn = document.getElementById('brain-btn');
    const inspectorBtn = document.getElementById('inspector-btn');
    if (configBtn) configBtn.addEventListener('click', () => togglePanel('config-panel'));
    if (bondBtn) bondBtn.addEventListener('click', () => togglePanel('bond-panel'));
    if (brainBtn) brainBtn.addEventListener('click', () => togglePanel('brain-panel'));
    if (inspectorBtn) inspectorBtn.addEventListener('click', () => togglePanel('inspector-panel'));

    const mobConfigBtn = document.getElementById('mob-config-btn');
    const mobBondBtn = document.getElementById('mob-bond-btn');
    const mobBrainBtn = document.getElementById('mob-brain-btn');
    const mobInspectorBtn = document.getElementById('mob-inspector-btn');
    if (mobConfigBtn) mobConfigBtn.addEventListener('click', () => togglePanel('config-panel'));
    if (mobBondBtn) mobBondBtn.addEventListener('click', () => togglePanel('bond-panel'));
    if (mobBrainBtn) mobBrainBtn.addEventListener('click', () => togglePanel('brain-panel'));
    if (mobInspectorBtn) mobInspectorBtn.addEventListener('click', () => togglePanel('inspector-panel'));

    return { closeAllPanels, togglePanel };
}

// ── Config panel wiring ─────────────────────────────────────
export function initConfigPanel(brain, closeAllPanels, messagesBox) {
    const promptInput = document.getElementById('prompt-input');
    const memoryInput = document.getElementById('memory-input');
    if (promptInput) promptInput.value = brain.systemPrompt;
    if (memoryInput) memoryInput.value = brain.maxMemory;

    const saveConfigBtn = document.getElementById('save-config-btn');
    if (saveConfigBtn) {
        saveConfigBtn.addEventListener('click', () => {
            brain.updateConfig(promptInput.value, parseInt(memoryInput.value, 10) || 10);
            closeAllPanels();
            brain.saveState();
            brain.updateBrainUI();
            window.dispatchEvent(new CustomEvent('emotionsChanged', { detail: { afinidad: brain.afinidad, enojo: brain.enojo } }));
        });
    }

    const clearConfigBtn = document.getElementById('clear-config-btn');
    if (clearConfigBtn) {
        clearConfigBtn.addEventListener('click', () => {
            if (confirm('¿Estás seguro de borrar ABSOLUTAMENTE TODA la memoria, historial y emociones de la IA? Esto es irreversible.')) {
                brain.clearMemory();
                messagesBox.innerHTML = '';
                closeAllPanels();
                brain.updateBrainUI();
                window.dispatchEvent(new CustomEvent('emotionsChanged', { detail: { afinidad: brain.afinidad, enojo: brain.enojo } }));
                window.logInspector('MEMORIA', 'Borrado de memoria completo ejecutado.');
            }
        });
    }
}

// ── Archetype grid builder ──────────────────────────────────
export function buildArchetypeUI(brain, selectedId) {
    const grid = document.getElementById('archetype-grid');
    if (grid) {
        grid.innerHTML = '';
        Object.entries(ARQUETIPOS).forEach(([id, arc]) => {
            const card = document.createElement('div');
            card.className = 'archetype-card' + (id === selectedId ? ' selected' : '');
            card.dataset.id = id;
            card.innerHTML = `<span class="arc-emoji">${arc.emoji}</span><span class="arc-name">${arc.nombre}</span><p class="arc-desc">${arc.descripcion}</p>`;
            card.addEventListener('click', () => {
                grid.querySelectorAll('.archetype-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
            });
            grid.appendChild(card);
        });
    }
    const sel = document.getElementById('arquetipo-select');
    if (sel) {
        sel.innerHTML = Object.entries(ARQUETIPOS).map(([id, arc]) =>
            `<option value="${id}" ${id === selectedId ? 'selected' : ''}>${arc.emoji} ${arc.nombre}</option>`
        ).join('');
        if (!sel._wired) {
            sel._wired = true;
            sel.addEventListener('change', () => {
                if (window.switchCharacter) {
                    window.switchCharacter(sel.value);
                }
            });
        }
    }
}

// ── Chat minimize/expand ────────────────────────────────────
export function initChatMinimize(messagesBox) {
    const chatContainer = document.getElementById('chat-container');
    const chatBar = document.getElementById('chat-bar');
    const chatMinimizeBtn = document.getElementById('chat-minimize-btn');
    const chatExpandBtn = document.getElementById('chat-expand-btn');
    const chatBarLast = document.getElementById('chat-bar-last');
    let chatMinimized = false;

    function minimizeChat() {
        chatMinimized = true;
        if (chatContainer) chatContainer.classList.add('hidden');
        if (chatBar) chatBar.classList.remove('hidden');
    }

    function expandChat() {
        chatMinimized = false;
        if (chatContainer) chatContainer.classList.remove('hidden');
        if (chatBar) chatBar.classList.add('hidden');
        if (chatBar) chatBar.classList.remove('has-new');
        messagesBox.scrollTop = messagesBox.scrollHeight;
    }

    if (chatMinimizeBtn) chatMinimizeBtn.addEventListener('click', minimizeChat);
    if (chatExpandBtn) chatExpandBtn.addEventListener('click', expandChat);

    const chatHeader = document.getElementById('chat-header');
    if (chatHeader) {
        let touchStartY = 0;
        chatHeader.addEventListener('touchstart', e => { touchStartY = e.touches[0].clientY; }, { passive: true });
        chatHeader.addEventListener('touchend', e => {
            if (e.changedTouches[0].clientY - touchStartY > 40) minimizeChat();
        }, { passive: true });
    }

    if (chatBar) {
        let touchStartY2 = 0;
        chatBar.addEventListener('touchstart', e => { touchStartY2 = e.touches[0].clientY; }, { passive: true });
        chatBar.addEventListener('touchend', e => {
            if (e.changedTouches[0].clientY - touchStartY2 < -30) expandChat();
        }, { passive: true });
    }

    return { chatMinimized: () => chatMinimized, chatBar, chatBarLast };
}

// ── Debug mode (5 taps on title) ────────────────────────────
export function initDebugMode(closeAllPanels) {
    let debugTapCount = 0;
    let debugTapTimer = null;
    let debugMode = localStorage.getItem('debugMode') === 'true';

    function applyDebugMode() {
        const badge = document.getElementById('debug-badge');
        const debugEls = document.querySelectorAll('.debug-only');
        if (debugMode) {
            if (badge) badge.classList.remove('hidden');
            debugEls.forEach(el => el.classList.remove('hidden'));
        } else {
            if (badge) badge.classList.add('hidden');
            debugEls.forEach(el => el.classList.add('hidden'));
        }
    }
    applyDebugMode();

    const appTitle = document.getElementById('app-title');
    if (appTitle) {
        appTitle.addEventListener('click', () => {
            debugTapCount++;
            if (debugTapTimer) clearTimeout(debugTapTimer);
            debugTapTimer = setTimeout(() => { debugTapCount = 0; }, 2000);
            if (debugTapCount >= 5) {
                debugTapCount = 0;
                debugMode = !debugMode;
                localStorage.setItem('debugMode', debugMode);
                applyDebugMode();
                if (!debugMode) {
                    ['brain-panel', 'inspector-panel'].forEach(id => {
                        const p = document.getElementById(id);
                        if (p && !p.classList.contains('hidden')) closeAllPanels();
                    });
                }
            }
        });
    }
}

// ── Message element factory ─────────────────────────────────
export function createMessageElement(text, sender) {
    const cssSender = sender === 'assistant' ? 'ai' : sender;
    const div = document.createElement('div');
    div.className = `message ${cssSender}`;
    div.title = 'Doble click para responder';

    let finalRenderText = text;
    const citaMatch = finalRenderText.match(/<cita>([\s\S]*?)<\/cita>/);
    if (citaMatch) {
        const citaDiv = document.createElement('div');
        citaDiv.style.background = 'rgba(0,0,0,0.3)';
        citaDiv.style.borderLeft = '3px solid #ec4899';
        citaDiv.style.padding = '4px 8px';
        citaDiv.style.marginBottom = '4px';
        citaDiv.style.fontSize = '0.85em';
        citaDiv.style.fontStyle = 'italic';
        citaDiv.textContent = citaMatch[1];
        div.appendChild(citaDiv);
        finalRenderText = finalRenderText.replace(citaMatch[0], '').trim();
    }

    const textNode = document.createTextNode(finalRenderText.replace(/\|\|/g, ' '));
    div.appendChild(textNode);

    if (sender === 'user') {
        const statusSpan = document.createElement('span');
        statusSpan.className = 'msg-status';
        statusSpan.textContent = ' ✔️';
        statusSpan.style.cssText = 'font-size:0.75em;opacity:0.7;margin-left:8px;float:right;margin-top:4px;';
        div.appendChild(statusSpan);
    }

    const replyBoxRef = document.getElementById('reply-box');
    const replyTextRef = document.getElementById('reply-text');
    div.addEventListener('dblclick', () => {
        window.replyingTo = finalRenderText.replace(/\|\|/g, ' ');
        if (replyBoxRef) {
            replyBoxRef.classList.remove('hidden');
            replyTextRef.textContent = `Respondiendo a: ${window.replyingTo.substring(0, 30)}...`;
        }
    });

    const isSystemMessage = finalRenderText.startsWith('[Sistema') || finalRenderText.startsWith('[Error') || finalRenderText.startsWith('[Nota');
    if (sender === 'assistant' && !isSystemMessage && 'speechSynthesis' in window) {
        const voiceBtn = document.createElement('button');
        voiceBtn.className = 'voice-note-btn';
        voiceBtn.innerHTML = '🔊 <span>Escuchar voz</span>';
        voiceBtn.style.cssText = 'display:inline-flex;align-items:center;gap:4px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:var(--text);border-radius:12px;padding:3px 8px;font-size:0.75rem;cursor:pointer;margin-top:6px;';
        voiceBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            window.speechSynthesis.cancel();
            const cleanMessage = finalRenderText.replace(/\|\|/g, ' ').replace(/<[^>]+>/g, '');
            const utter = new SpeechSynthesisUtterance(cleanMessage);
            utter.lang = 'es-MX';
            utter.rate = 1.0;
            utter.pitch = 1.05;
            window.speechSynthesis.speak(utter);
        });
        div.appendChild(voiceBtn);
    }

    const timeSpan = document.createElement('span');
    const now = new Date();
    timeSpan.textContent = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    timeSpan.style.cssText = 'font-size:0.7em;opacity:0.5;margin-left:8px;float:right;margin-top:4px;';
    div.appendChild(timeSpan);

    return div;
}

/**
 * Secret Diary UI Controller
 */
export function initDiaryUI(brain) {
    const modal = document.getElementById('diary-modal');
    const closeBtn = document.getElementById('diary-close-btn');
    const openBtn = document.getElementById('open-diary-btn');
    const mobBtn = document.getElementById('mob-diary-btn');
    const listContainer = document.getElementById('diary-entries-list');

    function renderDiary() {
        if (!listContainer) return;
        const entries = brain.memoryState.diario_entries || [];
        if (entries.length === 0) {
            listContainer.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);font-style:italic;">Luma aún no ha escrito ninguna confesión en su diario hoy. ¡Vuelve más tarde!</div>';
            return;
        }

        listContainer.innerHTML = entries.map((entry, idx) => {
            const isUnlocked = entry.unlocked || idx === 0; // First entry free preview
            return `
                <div class="diary-card" style="background:rgba(255,255,255,0.03);border:1px solid var(--glass-border);border-radius:16px;padding:16px;position:relative;">
                    <div style="font-size:0.75rem;color:var(--primary);margin-bottom:6px;font-weight:600;">📅 ${entry.date} ${entry.time}</div>
                    <div class="diary-text ${isUnlocked ? '' : 'blurred-entry'}" style="${isUnlocked ? '' : 'filter:blur(6px);user-select:none;'} font-size:0.95rem;line-height:1.5;">
                        "${entry.text}"
                    </div>
                    ${!isUnlocked ? `
                        <div style="position:absolute;inset:0;margin:auto;height:fit-content;width:fit-content;display:flex;flex-direction:column;align-items:center;gap:6px;">
                            <button class="auth-btn primary unlock-diary-btn" data-id="${entry.id}" style="padding:6px 14px;font-size:0.8rem;">🔒 Espiar Diario (Ver Anuncio)</button>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');

        listContainer.querySelectorAll('.unlock-diary-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                window.pendingDiaryUnlockId = btn.dataset.id;
                const rewardModal = document.getElementById('reward-modal');
                if (rewardModal) rewardModal.classList.remove('hidden');
            });
        });
    }

    if (openBtn && modal) openBtn.addEventListener('click', () => { renderDiary(); modal.classList.remove('hidden'); });
    if (mobBtn && modal) mobBtn.addEventListener('click', () => { renderDiary(); modal.classList.remove('hidden'); });
    if (closeBtn && modal) closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
    
    // Expose renderDiary for re-renders after ad unlock
    window.renderDiaryModal = renderDiary;
}

/**
 * Rewarded Ads Simulator UI Controller
 */
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
            let timeLeft = 5; // 5s fast demo simulation
            if (timerSpan) timerSpan.textContent = timeLeft;

            const interval = setInterval(() => {
                timeLeft--;
                if (timerSpan) timerSpan.textContent = timeLeft;
                if (timeLeft <= 0) {
                    clearInterval(interval);
                    if (videoSim) videoSim.classList.add('hidden');
                    startBtn.classList.remove('hidden');
                    if (modal) modal.classList.add('hidden');
                    
                    // Check if ad was to unlock a diary entry
                    if (window.pendingDiaryUnlockId && brain.memoryState.diario_entries) {
                        const target = brain.memoryState.diario_entries.find(e => e.id === window.pendingDiaryUnlockId);
                        if (target) {
                            target.unlocked = true;
                            brain.saveState();
                            if (window.renderDiaryModal) window.renderDiaryModal();
                            showToast('¡Confesión del diario desbloqueada! 📖', 'success');
                        }
                        window.pendingDiaryUnlockId = null;
                    } else {
                        // Grant +5 messages reward to server database & client state
                        apiFetch('/api/user/reward', {
                            method: 'POST',
                            body: JSON.stringify({ amount: 5 })
                        }).then(r => r.json()).then(data => {
                            if (data.dailyMessageCount !== undefined) {
                                brain.dailyMessageCount = data.dailyMessageCount;
                            } else {
                                brain.dailyMessageCount = Math.max(0, brain.dailyMessageCount - 5);
                            }
                            brain.saveState();
                            brain.updateBrainUI();
                            showToast('¡Premio otorgado! +5 Mensajes añadidos a tu saldo 🎉', 'success');
                        }).catch(() => {
                            brain.dailyMessageCount = Math.max(0, brain.dailyMessageCount - 5);
                            brain.saveState();
                            brain.updateBrainUI();
                            showToast('¡Premio otorgado! +5 Mensajes añadidos a tu saldo 🎉', 'success');
                        });
                    }
                }
            }, 1000);
        });
    }
}

// ── Visto con delay ─────────────────────────────────────────
export function markAllAsRead() {
    const delay = 2000 + Math.random() * 3000;
    setTimeout(() => {
        document.querySelectorAll('.msg-status').forEach(el => {
            if (el.textContent === ' ✔️') {
                el.textContent = ' ✔️✔️';
                el.style.color = '#38bdf8';
                el.style.opacity = '1';
            }
        });
    }, delay);
}

export function removeAllTyping() {
    document.querySelectorAll('.typing').forEach(el => el.remove());
}

// ── addMessage con sonidos y animación ──────────────────────
export async function addMessage(text, sender, messagesBox, chatState) {
    if (sender === 'assistant') playPopSound();
    else if (sender === 'user') playWhooshSound();

    if (chatState.getChatMinimized && chatState.getChatMinimized() && sender === 'assistant') {
        const barText = text.replace(/\|\|/g, ' ').replace(/<[^>]+>/g, '').substring(0, 50);
        if (chatState.chatBarLast) chatState.chatBarLast.textContent = barText;
        if (chatState.chatBar) chatState.chatBar.classList.add('has-new');
    }

    const cleanText = text.replace(/\|\|/g, ' ').trim();
    const div = createMessageElement(cleanText, sender);
    messagesBox.appendChild(div);
    messagesBox.scrollTop = messagesBox.scrollHeight;
}

// ── History renderer ────────────────────────────────────────
export function renderHistory(brain, messagesBox) {
    if (brain.history.length === 0) return;
    messagesBox.innerHTML = '';
    brain.history.forEach(msg => {
        const role = msg.role === 'user' ? 'user' : 'assistant';
        let renderText = msg.content;

        if (role === 'user') {
            renderText = renderText
                .replace(/\n\[Recuerdos desenterrados[\s\S]*?\]/g, '')
                .replace(/\n\[ALERTA INTERNA[\s\S]*?\]/g, '')
                .replace(/\n\[ALERTA DE VIDA[\s\S]*?\]/g, '')
                .replace(/\n\[Nota interna[\s\S]*?\]/g, '');
        }

        if (role === 'assistant') {
            let extracted = brain.extractTag(msg.content, 'respuesta');
            if (!extracted) {
                extracted = msg.content.replace(/<[^>]+>[\s\S]*?<\/[^>]+>/g, '').replace(/<[^>]+>/g, '').trim();
            }
            const rawCita = brain.extractTag(msg.content, 'cita');
            if (rawCita && !extracted.includes('<cita>')) {
                extracted = `<cita>${rawCita}</cita> ` + extracted;
            }
            if (extracted) renderText = extracted;
        }

        const div = createMessageElement(renderText, role);
        messagesBox.appendChild(div);
    });
    messagesBox.scrollTop = messagesBox.scrollHeight;
}

/**
 * Toast Notification System
 */
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
    
    // Trigger CSS animation
    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

