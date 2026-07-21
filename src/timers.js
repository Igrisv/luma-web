// ═══════════════════════════════════════════════════════════
// timers.js — Lógica autónoma, temporizadores, homeostasis
// ═══════════════════════════════════════════════════════════

/**
 * @param {import('./brain.js').ChatBrain} brain
 * @param {Function} addMessageFn   — ui.addMessage bound con messagesBox y chatState
 * @param {Function} handleSendFn  — chat.handleSend
 * @param {HTMLInputElement} input
 */
export function initTimers(brain, addMessageFn, handleSendFn, input) {

    // ── Homeostasis emocional ───────────────────────────────
    setInterval(() => {
        if (!brain) return;
        if (brain.enojo > 0) brain.enojo = Math.max(0, brain.enojo - 5);
        if (brain.cansancio > 0) brain.cansancio = Math.max(0, brain.cansancio - 2);
        if (brain.aburrimiento > 0) brain.aburrimiento = Math.max(0, brain.aburrimiento - 5);

        const hoursSinceInteraction = (Date.now() - (window.lastInteraction || Date.now())) / (1000 * 60 * 60);
        if (hoursSinceInteraction > 1) {
            brain.ansiedad = Math.min(100, brain.ansiedad + 2);
            if (brain.ignoredCount > 0) {
                brain.resentimiento = Math.min(100, brain.resentimiento + 1);
            }
        }
        brain.saveState();
        brain.updateBrainUI();
    }, 3600000); // 1 hora

    // ── Loop autónomo anti-spam ─────────────────────────────
    // lastInteraction is initialized early in chat.js; just ensure it exists
    if (!window.lastInteraction) window.lastInteraction = Date.now();
    let autonomousTimer;
    let vistoTimer;
    let messageJustArrived = false;

    async function handleReflection() {
        const text = '[Reflexión: actualiza emociones. Deja <respuesta> VACÍA.]';
        const liveThought = document.getElementById('live-thought');
        if (liveThought) liveThought.textContent = 'Reflexionando en silencio...';
        try {
            await brain.sendMessageToAI(text, () => {}, (t) => {
                if (liveThought) liveThought.textContent = t;
            }, true);
            if (liveThought) liveThought.textContent = 'Reflexión terminada.';
        } catch (e) { console.error(e); }
    }

    function startAutonomousLoop(customWait = null) {
        if (autonomousTimer) clearTimeout(autonomousTimer);
        if (brain.ignoredCount >= 2) return;

        const waitTime = customWait || 300000; // 5 min de inactividad

        autonomousTimer = setTimeout(async () => {
            brain.ignoredCount++;
            window.lastInteraction = Date.now();

            if (brain.ignoredCount === 1) {
                window.logInspector('SISTEMA', 'Fase 1: Reflexión asíncrona...');
                await handleReflection();
            } else if (brain.ignoredCount === 2) {
                window.logInspector('SISTEMA', 'Fase 2: Último mensaje autónomo...');
                await handleSendFn(true);
            }
            startAutonomousLoop();
        }, waitTime);
    }

    startAutonomousLoop();

    // Pause loop when tab is hidden to avoid instant firing on return
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            if (autonomousTimer) {
                clearTimeout(autonomousTimer);
                autonomousTimer = null;
            }
        } else {
            if (!autonomousTimer) {
                startAutonomousLoop();
            }
        }
    });

    // Eventos para detectar "visto" (usuario interactúa pero no responde)
    const handleVistoEvent = () => {
        if (!messageJustArrived) return;
        messageJustArrived = false;
        if (vistoTimer) clearTimeout(vistoTimer);
        
        vistoTimer = setTimeout(async () => {
            if (brain.ignoredCount === 0 && !window.isThinking) {
                brain.ignoredCount++;
                const textInt = '[Nota interna: El usuario te ha dejado en visto. Ha interactuado con la pantalla pero no te ha respondido. Reacciona a esto de forma acorde a tu personalidad.]';
                const res = await brain.sendMessageToAI(textInt, () => {}, () => {}, true, 0, true).catch(() => null);
                if (res && res.trim()) await addMessageFn(res, 'assistant');
            }
        }, 180000); // 3 minutos para ofenderse por visto
    };

    window.addEventListener('mousemove', handleVistoEvent);
    window.addEventListener('touchstart', handleVistoEvent, { passive: true });

    // ── Typing interrupt ────────────────────────────────────
    let isTyping = false;
    let typingTimer = null;

    function resetTyping() {
        isTyping = false;
        if (typingTimer) clearTimeout(typingTimer);
    }

    if (input) {
        input.addEventListener('input', () => {
            const len = input.value.length;
            window.dispatchEvent(new CustomEvent('userTyping', { detail: { length: len } }));
            window.lastInteraction = Date.now();
            startAutonomousLoop();

            if (typingTimer) clearTimeout(typingTimer);

            if (len > 0) {
                isTyping = true;
                typingTimer = setTimeout(() => {
                    if (isTyping && input.value.length > 20 && !window.isThinking) {
                        let actitud = 'Sé sarcástica o apúralo un poco.';
                        if (brain.afinidad > 70) actitud = 'Sé dulce y dile que te intriga la biblia que te está escribiendo.';
                        else if (brain.ansiedad > 70) actitud = 'Sé ansiosa, dile que tanto escribir te pone nerviosa y pregúntale qué está pasando.';
                        else if (brain.enojo > 60) actitud = 'Sé agresiva y dile que si va a mandar un testamento mejor ni lo haga.';
                        else if (brain.aburrimiento > 70) actitud = 'Dile que ya te estás durmiendo de tanto esperarlo.';

                        const textInt = `[Nota interna: El usuario lleva tecleando un rato sin enviar. Interrúmpelo de la nada. Actitud: ${actitud}]`;
                        window.isThinking = true;
                        (async () => {
                            try {
                                const res = await brain.sendMessageToAI(textInt, () => {}, (t) => {
                                    const liveThought = document.getElementById('live-thought');
                                    if (liveThought) liveThought.textContent = t;
                                }, true);
                                window.isThinking = false;
                                if (res && res.trim()) await addMessageFn(res, 'assistant');
                            } catch (e) {
                                window.isThinking = false;
                                if (e.message !== 'INTERNAL_LIMIT_REACHED') console.error(e);
                            }
                        })();
                    }
                }, 10000);
            } else {
                resetTyping();
            }
        });
    }

    return { startAutonomousLoop, resetTyping, setMessageJustArrived: (v) => { messageJustArrived = v; }, getVistoTimer: () => vistoTimer, clearVistoTimer: () => { if (vistoTimer) clearTimeout(vistoTimer); } };
}
