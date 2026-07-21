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

    // ── Frases locales por arquetipo (0 Tokens) ───────────────
    const LOCAL_VISTO_PHRASES = {
        mejorAmigo: ['Oye, ¿me dejas en visto o qué? jajaj', 'Veo que me leíste y te dio flojera responder 😂', 'Ajá... visto con éxito 🙄'],
        pareja: ['¿Me vas a dejar en visto? 🥺', 'Me lees pero no me respondes... ¿todo bien?', 'Oye, vi que lo leíste ❤️'],
        amigaToxica: ['Típico de ti dejarme en visto 💅', 'Ah ok, visto. Anotado.', '¿En serio me ignoras así?'],
        rival: ['¿Te quedaste sin palabras o qué?', 'Ni para responder sirves.', 'Visto... qué predecible.'],
        ex: ['Veo que sigues con la costumbre de dejar en visto.', 'Sin comentarios...', '¿En serio?']
    };

    const LOCAL_TYPING_PHRASES = {
        mejorAmigo: ['¿Estás escribiendo una biblia o qué? jajaj', 'Escribe rápido che, me vas a hacer viejo esperando 😂', 'Mucho texto estás preparando 👀'],
        pareja: ['Llevas un rato escribiendo... me intriga lo que pondrás ❤️', '¿Qué me estás escribiendo tan largo? 👀', 'Tanto escribir me pone nerviosa jajaja'],
        amigaToxica: ['Si vas a mandar un testamento mejor ni lo envíes 🙄', 'Tardas mil horas escribiendo...', '¿Vas a tardar todo el día?'],
        rival: ['Escribe rápido, no tengo todo el día.', 'Tanto pensar para un mensaje...', '¿Dificultades para redactar?'],
        ex: ['Veo que estás escribiendo un montón...', '¿Tanto tienes que decir?', 'Tómate tu tiempo...']
    };

    function getRandomLocalPhrase(dictionary, archetypeId) {
        const list = dictionary[archetypeId] || dictionary.mejorAmigo;
        return list[Math.floor(Math.random() * list.length)];
    }

    // ── Loop autónomo anti-spam ─────────────────────────────
    if (!window.lastInteraction) window.lastInteraction = Date.now();
    let autonomousTimer;
    let vistoTimer;
    let messageJustArrived = false;

    // Homeostasis local de reflexión (Cero llamadas a la API)
    function handleReflection() {
        if (!brain) return;
        brain.aburrimiento = Math.min(100, brain.aburrimiento + 10);
        brain.ansiedad = Math.min(100, brain.ansiedad + 5);
        brain.saveState();
        brain.updateBrainUI();
        window.logInspector('SISTEMA', 'Reflexión local completada (0 tokens).');
    }

    function startAutonomousLoop(customWait = null) {
        if (autonomousTimer) clearTimeout(autonomousTimer);
        if (brain.ignoredCount >= 2) return;

        const waitTime = customWait || 300000; // 5 min de inactividad

        autonomousTimer = setTimeout(async () => {
            brain.ignoredCount++;
            window.lastInteraction = Date.now();

            if (brain.ignoredCount === 1) {
                window.logInspector('SISTEMA', 'Fase 1: Reflexión local asíncrona...');
                handleReflection();
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

    // Eventos para detectar "visto" (usuario interactúa pero no responde) - Frase Local
    const handleVistoEvent = () => {
        if (!messageJustArrived) return;
        messageJustArrived = false;
        if (vistoTimer) clearTimeout(vistoTimer);
        
        vistoTimer = setTimeout(async () => {
            if (brain.ignoredCount === 0 && !window.isThinking) {
                brain.ignoredCount++;
                const localPhrase = getRandomLocalPhrase(LOCAL_VISTO_PHRASES, brain.arquetipoId);
                brain.addMessage('assistant', `<respuesta>${localPhrase}</respuesta>`);
                await addMessageFn(localPhrase, 'assistant');
            }
        }, 180000); // 3 minutos para ofenderse por visto
    };

    window.addEventListener('mousemove', handleVistoEvent);
    window.addEventListener('touchstart', handleVistoEvent, { passive: true });

    // ── Typing interrupt (Cero Tokens) ──────────────────────
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
                typingTimer = setTimeout(async () => {
                    if (isTyping && input.value.length > 20 && !window.isThinking) {
                        const localPhrase = getRandomLocalPhrase(LOCAL_TYPING_PHRASES, brain.arquetipoId);
                        brain.addMessage('assistant', `<respuesta>${localPhrase}</respuesta>`);
                        await addMessageFn(localPhrase, 'assistant');
                        resetTyping();
                    }
                }, 10000);
            } else {
                resetTyping();
            }
        });
    }

    return { startAutonomousLoop, resetTyping, setMessageJustArrived: (v) => { messageJustArrived = v; }, getVistoTimer: () => vistoTimer, clearVistoTimer: () => { if (vistoTimer) clearTimeout(vistoTimer); } };
}
