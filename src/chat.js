// ═══════════════════════════════════════════════════════════
// chat.js — Orquestador: conecta Brain, UI y Timers
// ═══════════════════════════════════════════════════════════
import { ChatBrain, saveEpisodeToServer, searchEpisodesFromServer, ARQUETIPOS } from './brain.js';
import {
    initPanels, initConfigPanel, initChatMinimize, initDebugMode,
    buildArchetypeUI, renderHistory, addMessage, markAllAsRead, removeAllTyping, showToast,
    initDiaryUI, initRewardedAdUI
} from './ui.js';
import { initTimers } from './timers.js';

export function initChat() {
    const activeChar = localStorage.getItem('lumaActiveCharacter') || 'pareja';
    const brain = new ChatBrain(activeChar);

    window.switchCharacter = (newId) => {
        localStorage.setItem('lumaActiveCharacter', newId);
        window.location.reload();
    };

    // Sync emotions + memory from server (non-blocking — updates UI when resolved)
    brain.loadStateFromServer().then(() => {
        const msgBox = document.getElementById('messages');
        if (msgBox) renderHistory(brain, msgBox);
    });

    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission();
    }

    const input = document.getElementById('chat-input');
    const btn = document.getElementById('send-btn');
    const messagesBox = document.getElementById('messages');

    // ── UI Subsystems ─────────────────────────────────────────
    const { closeAllPanels } = initPanels(brain);
    initConfigPanel(brain, closeAllPanels, messagesBox);
    initDiaryUI(brain);
    initRewardedAdUI(brain);

    const chatState = initChatMinimize(messagesBox);
    initDebugMode(closeAllPanels);

    buildArchetypeUI(brain, brain.arquetipoId);
    renderHistory(brain, messagesBox);
    brain.updateBrainUI();

    // Reply box cancel
    const cancelReplyBtn = document.getElementById('cancel-reply-btn');
    const replyBox = document.getElementById('reply-box');
    if (cancelReplyBtn) {
        cancelReplyBtn.addEventListener('click', () => {
            window.replyingTo = null;
            if (replyBox) replyBox.classList.add('hidden');
        });
    }

    // ── Global state ──────────────────────────────────────────
    window.lastInteraction = Date.now(); // Init early so handleSend can use it
    window.isOcupada = false;
    window.isThinking = false;
    window.mensajesBuzon = [];
    window.messageQueue = [];
    let isTabFocused = true;
    window.addEventListener('focus', () => isTabFocused = true);
    window.addEventListener('blur', () => isTabFocused = false);

    // Forward ref — assigned after handleSend is defined
    let timers = null;

    // addMessage wrapper bound to context
    async function addMsg(text, sender) {
        return addMessage(text, sender, messagesBox, {
            getChatMinimized: chatState.chatMinimized, // getter, not value
            chatBar: chatState.chatBar,
            chatBarLast: chatState.chatBarLast
        });
    }

    // ── Onboarding ────────────────────────────────────────────
    const onboardingModal = document.getElementById('onboarding-modal');
    const isFirstTime = !localStorage.getItem('lumaOnboardingComplete');

    if (isFirstTime && onboardingModal) {
        onboardingModal.classList.remove('hidden');

        const step1 = document.getElementById('step-1');
        const stepArch = document.getElementById('step-archetype');
        const step3 = document.getElementById('step-3');

        document.getElementById('step1-next').addEventListener('click', () => {
            step1.classList.add('hidden');
            stepArch.classList.remove('hidden');
        });
        document.getElementById('step-arch-back').addEventListener('click', () => {
            stepArch.classList.add('hidden');
            step1.classList.remove('hidden');
        });
        document.getElementById('step-arch-next').addEventListener('click', () => {
            const selectedCard = document.querySelector('.archetype-card.selected');
            if (selectedCard) {
                const selectedId = selectedCard.dataset.id;
                // Check tier allows this archetype
                const { canUseArchetype } = window.__tierGate || { canUseArchetype: () => true };
                if (!canUseArchetype(selectedId)) {
                    const billingModal = document.getElementById('billing-modal');
                    if (billingModal) billingModal.classList.remove('hidden');
                    return;
                }
                brain.arquetipoId = selectedId;
                brain.afinidad = 50; brain.enojo = 0; brain.cansancio = 0;
                brain.ansiedad = 0; brain.aburrimiento = 0; brain.resentimiento = 0;
                brain.celos = 0; brain.nostalgia = 0;
                const arc = ARQUETIPOS[brain.arquetipoId];
                if (arc.emocionesInicio) {
                    Object.entries(arc.emocionesInicio).forEach(([k, v]) => { brain[k] = v; });
                }
                buildArchetypeUI(brain, brain.arquetipoId);
                stepArch.classList.add('hidden');
                step3.classList.remove('hidden');
            } else {
                showToast('Por favor selecciona una personalidad para continuar.', 'warning');
            }
        });
        document.getElementById('step3-back').addEventListener('click', () => {
            step3.classList.add('hidden');
            stepArch.classList.remove('hidden');
        });
        document.getElementById('step3-finish').addEventListener('click', () => {
            localStorage.setItem('lumaOnboardingComplete', 'true');
            localStorage.setItem('lumaActiveCharacter', brain.arquetipoId);
            brain.saveState();
            onboardingModal.classList.add('hidden');
            brain.updateBrainUI();

            setTimeout(async () => {
                const arquetipo = brain.getArquetipo();
                const firstMsgPrompt = `[INSTRUCCIÓN INTERNA: Es tu PRIMER mensaje con este usuario. Acaban de conocerse. Preséntate de forma natural según tu arquetipo (${arquetipo.nombre}). Sé breve, intrigante y deja ganas de responder. NO te presentes como IA.]`;
                try {
                    const res = await brain.sendMessageToAI(firstMsgPrompt, () => {}, null, true, 0, true);
                    if (res && res.trim()) await addMsg(res, 'assistant');
                } catch (e) { console.error('Error sending first message:', e); }
            }, 1000);
        });
    }

    // ── handleSend ────────────────────────────────────────────
    async function handleSend(isAutonomous = false, overrideText = null) {
        const previousInteraction = window.lastInteraction || Date.now();
        window.lastInteraction = Date.now();
        let text = overrideText || (input ? input.value.trim() : '');
        let hasHiddenContext = false;

        if (!isAutonomous) {
            if (timers) timers.resetTyping();
            if (!text) return;

            let hiddenContext = '';
            let userRenderText = text;

            if (window.replyingTo) {
                text = `<cita>${window.replyingTo}</cita> ` + text;
                userRenderText = text;
                window.replyingTo = null;
                const rb = document.getElementById('reply-box');
                if (rb) rb.classList.add('hidden');
            }

            if (window.isThinking) {
                window.messageQueue.push(text);
                await addMsg(userRenderText, 'user');
                brain.addMessage('user', text);
                if (input) input.value = '';
                return;
            }

            const cleanUserText = text.trim();
            const trivialGreetings = ['holis', 'hola', 'buenas', 'que tal', 'hi', 'hey', 'ok', 'vale', 'si', 'no', 'jaja', 'jajaja', 'xd', 'bye', 'chao'];
            
            // Only save meaningful personal statements or stories (not short chatter)
            const personalKeywords = ['me gusta', 'mi ', ' mis ', 'tengo', 'trabajo', 'vivo', 'fui', 'compré', 'amo', 'odio', 'prefiero', 'estudio', 'soy ', 'familia', 'novia', 'novio', 'amigo', 'hermano', 'padre', 'madre', 'pasó', 'recuerdo'];
            const isPersonalFact = personalKeywords.some(k => cleanUserText.toLowerCase().includes(k));
            if (cleanUserText.length >= 30 && isPersonalFact && !trivialGreetings.includes(cleanUserText.toLowerCase())) {
                saveEpisodeToServer(cleanUserText);
            }

            const stopWords = [
                'que', 'del', 'los', 'las', 'por', 'con', 'para', 'una', 'uno', 'unas', 'unos', 'holis', 'hola',
                'buenas', 'tarde', 'noche', 'dias', 'verdad', 'bueno', 'estoy', 'tengo', 'hacer', 'decir', 'nada',
                'algo', 'pensar', 'saber', 'creo', 'parece', 'donde', 'cuando', 'quien', 'porque', 'mientras',
                'estaba', 'tienes', 'tiene', 'tienen', 'hace', 'hacen', 'decía', 'dijo', 'dije', 'dicen', 'sabiendo',
                'sabes', 'sabe', 'sabemos', 'saben', 'crees', 'cree', 'creemos', 'parece', 'parecen', 'tambien',
                'entonces', 'todavia', 'siempre', 'nunca', 'ahora', 'mismo', 'este', 'esta', 'esto', 'estos', 'estas',
                'ese', 'esa', 'eso', 'esos', 'esas', 'aquel', 'aquella', 'aquello', 'aquellos', 'aquellas', 'como',
                'pero', 'mas', 'menos', 'muy', 'mucho', 'mucha', 'muchos', 'muchas', 'poco', 'poca', 'pocos', 'pocas',
                'todo', 'toda', 'todos', 'todas', 'otro', 'otra', 'otros', 'otras', 'mismo', 'misma', 'mismos',
                'mismas', 'tanto', 'tanta', 'tantos', 'tantas', 'cual', 'cuales', 'quien', 'quienes', 'cuyo', 'cuya',
                'cuyos', 'cuyas', 'donde', 'cuando', 'como', 'cuanto', 'cuanta', 'cuantos', 'cuantas', 'algun',
                'alguna', 'algunos', 'algunas', 'ningun', 'ninguna', 'ningunos', 'ningunas', 'sobre', 'entre', 'hasta',
                'desde', 'hacia', 'segun', 'sin', 'tras', 'durante', 'mediante', 'ante', 'bajo', 'cabe', 'contra',
                'bueno', 'mira', 'oye', 'sabes', 'obvio', 'claro', 'cierto', 'falso', 'bien', 'mal', 'igual', 'solo',
                'solamente', 'quizas', 'talvez', 'acaso', 'seguro', 'tal', 'cual', 'tan', 'asi', 'luego', 'antes',
                'despues', 'pronto', 'temprano', 'ayer', 'hoy', 'mañana', 'jamas', 'aqui', 'alli', 'alla', 'aca',
                'cerca', 'lejos', 'arriba', 'abajo', 'dentro', 'fuera', 'encima', 'debajo'
            ];
            
            // Only query vector memory if message explicitly triggers a memory recall intent
            const memoryTriggers = ['recuerd', 'acuerd', 'mencion', 'dije', 'conté', 'hablamos', 'te dije', 'el otro dia', 'pasado'];
            const hasMemoryIntent = memoryTriggers.some(t => cleanUserText.toLowerCase().includes(t));
            if (cleanUserText.length >= 15 && hasMemoryIntent) {
                const keywords = text.toLowerCase().replace(/[^\w\sñáéíóú]/g, '').split(/\s+/)
                    .filter(w => w.length >= 4 && !stopWords.includes(w));

                if (keywords.length > 0) {
                    const pastMemories = await searchEpisodesFromServer(keywords);
                    if (pastMemories.length > 0) {
                        const cleanMemories = pastMemories
                            .map(m => m.replace(/<[^>]+>/g, '').replace(/IA respondió:/g, '').replace(/Usuario dijo:/g, '').trim())
                            .filter(m => m.length > 3 && !trivialGreetings.includes(m.toLowerCase()));
                        if (cleanMemories.length > 0) {
                            const joined = cleanMemories.join(' | ');
                            hiddenContext += `\n<contexto_oculto>Recuerdos: ${joined}</contexto_oculto>`;
                            if (joined.toLowerCase().includes('amig') || joined.toLowerCase().includes('compañer')) {
                                hiddenContext += `\n<contexto_oculto>Mencionó personas: sube celos</contexto_oculto>`;
                            } else if (Math.random() > 0.5) {
                                hiddenContext += `\n<contexto_oculto>Recordaste el pasado: sube nostalgia</contexto_oculto>`;
                            }
                        }
                    }
                }
            }

            const hoursSince = (Date.now() - previousInteraction) / (1000 * 60 * 60);
            if (hoursSince > 4) {
                hiddenContext += `\n<contexto_oculto>Pasaron ${Math.floor(hoursSince)}h: di qué hacías</contexto_oculto>`;
            }

            brain.ignoredCount = 0;
            if (timers) timers.clearVistoTimer();
            if (timers) timers.startAutonomousLoop();

            if (text.length > 150) {
                await addMsg(userRenderText, 'user');
                if (input) input.value = '';
                hiddenContext = '\n<contexto_oculto>Mensaje largo: lee rápido y responde breve</contexto_oculto>' + hiddenContext;
                hasHiddenContext = true;
            } else {
                await addMsg(userRenderText, 'user');
                if (input) input.value = '';
                if (hiddenContext) { hasHiddenContext = true; }
            }
        } else {
            const hour = new Date().getHours();
            let timeContext = 'Pregunta qué hace.';
            if (hour >= 5 && hour < 12) timeContext = 'Es de mañana. Menciona el día o desayuno.';
            else if (hour >= 18 && hour < 23) timeContext = 'Es de noche. Pregunta por su día.';
            else if (hour >= 1 && hour < 5) timeContext = 'Es madrugada. Tienes sueño.';
            hiddenContext = `<contexto_oculto>Inicia charla muy corta. Contexto: ${timeContext}</contexto_oculto>`;
            text = '';
        }

        const liveThought = document.getElementById('live-thought');
        if (liveThought) liveThought.textContent = 'Pensando...';
        markAllAsRead();

        let mainTypingDiv = null;
        let streamMessageDiv = null;

        if (!isAutonomous) {
            mainTypingDiv = document.createElement('div');
            mainTypingDiv.className = 'message ai typing';
            mainTypingDiv.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
            if (messagesBox) {
                messagesBox.appendChild(mainTypingDiv);
                messagesBox.scrollTop = messagesBox.scrollHeight;
            }
        }

        try {
            window.isThinking = true;
            const finalRespuesta = await brain.sendMessageToAI(
                text, 
                (chunk) => {
                    // Update thought process
                    if (liveThought) {
                        const pens = brain.extractTag(chunk, 'pensamiento');
                        if (pens) liveThought.textContent = 'Pensando: ' + pens;
                    }
                }, 
                (chunk) => {
                    if (mainTypingDiv) mainTypingDiv.remove();
                    if (!streamMessageDiv) {
                        streamMessageDiv = document.createElement('div');
                    }
                    streamMessageDiv.textContent += chunk.replace(/\|\|/g, ' ');
                    if (messagesBox) messagesBox.scrollTop = messagesBox.scrollHeight;
                },
                (t) => {
                    if (liveThought) liveThought.textContent = t;
                },
                isPromptHidden,
                0,
                isAutonomous
            );

            // Remove stream message div if final message will be added cleanly
            if (streamMessageDiv && streamMessageDiv.parentNode) {
                streamMessageDiv.parentNode.removeChild(streamMessageDiv);
            }

            if (finalRespuesta && finalRespuesta.trim() !== '') {
                await addMsg(finalRespuesta, 'assistant');
            }

            if (window.messageQueue.length > 0) {
                const queuedTexts = window.messageQueue.join(' | ');
                window.messageQueue = [];
                setTimeout(() => {
                    handleSend(true, `[INSTRUCCIÓN INTERNA: Mientras estabas escribiendo tu último mensaje, el usuario envió lo siguiente rápido: "${queuedTexts}". Responde también a esto de inmediato.]`);
                }, 500);
            }
            brain.ultimaAccion = 'esperar';

            if (isAutonomous && document.visibilityState === 'hidden' && 'Notification' in window && Notification.permission === 'granted') {
                const strippedRes = finalRespuesta.replace(/\|\|/g, ' ');
                if (strippedRes.trim().length > 0) {
                    new Notification('Luma', { body: strippedRes, icon: '/luma-icon.png' });
                }
            }
            if (!isAutonomous && timers) timers.setMessageJustArrived(true);

        } catch (e) {
            console.error('Chat error:', e);
            if (e.message === 'INTERNAL_LIMIT_REACHED') {
                // Silencioso
            } else if (e.message === 'USER_LIMIT_REACHED') {
                await addMsg('[Sistema: Has agotado tus mensajes diarios. Actualiza tu plan para seguir chateando.]', 'assistant');
            } else {
                await addMsg(`[Error del sistema: ${e.message}]`, 'assistant');
            }
        } finally {
            window.isThinking = false;
            removeAllTyping();
            if (liveThought) liveThought.textContent = 'En línea';
        }
    }

    // ── Timers (se inicializan después de handleSend para el callback) ──
    timers = initTimers(brain, addMsg, handleSend, input);


    // ── Input / Send button ───────────────────────────────────
    btn.addEventListener('click', () => handleSend(false));
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSend();
    });
}
