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
    const homeostasisInterval = setInterval(() => {
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

    // ── Frases locales por arquetipo + estado emocional (0 Tokens) ───
    // Estructura: { arquetipo: { emocion: [frases] } }
    const LOCAL_VISTO_PHRASES = {
        mejorAmigo: {
            enojado: ['Ah, ¿ahora me ignoras? Que maduro de tu parte...', 'Dale, ignorame. Después no me busques.'],
            cariñoso: ['Oye, te vi conectar y no me hablaste 😢', 'Me dejaste en visto... bueno, te perdono 😊'],
            ansioso: ['¿Pasó algo? Vi que leíste y me preocupé...', '¿Estás bien? Me dejaste en visto y me quedé pensando...'],
            neutral: ['Oye, ¿me dejas en visto o qué? jajaj', 'Veo que me leíste y te dio flojera responder 😂', 'Ajá... visto con éxito 🙄']
        },
        pareja: {
            enojado: ['Visto... genial. Luego no me busques.', 'Ok, ignorame. Después hablamos.'],
            cariñoso: ['Vi que leíste mi mensaje... te extraño ❤️', '¿Mucho que hacer? Te espero, no te preocupes 💕'],
            ansioso: ['¿Pasó algo? Vi que leíste y no contestaste...', 'Me preocupa que me dejes en visto... ¿estás bien?'],
            neutral: ['¿Me vas a dejar en visto? 🥺', 'Me lees pero no me respondes... ¿todo bien?', 'Oye, vi que lo leíste ❤️']
        },
        amigaToxica: {
            enojado: ['Me dejaste en visto. Ni me busques hoy.', 'Visto. Ok. Genial. Fantástico. 🙄'],
            cariñoso: ['Oye, ¿me leíste y no me dices nada? Tonta 😂', 'Me dejaste en visto pero sé que me quieres 💅'],
            ansioso: ['¿Me estás ignorando a propósito o...?', '¿Hice algo mal? Me dejaste en visto...'],
            neutral: ['Típico de ti dejarme en visto 💅', 'Ah ok, visto. Anotado.', '¿En serio me ignoras así?']
        },
        rival: {
            enojado: ['Ni para responder sirves. Patético.', 'Visto. ¿Tanto te cuesta dar la cara?'],
            cariñoso: ['Te vi conectar... pensé que me hablarías.', 'No me ignores, ¿va? 👀'],
            ansioso: ['¿Visto? ¿Ya no quieres hablar?', '¿Te fuiste o me estás ignorando?'],
            neutral: ['¿Te quedaste sin palabras o qué?', 'Visto... qué predecible.']
        },
        ex: {
            enojado: ['Típico. Algunas cosas no cambian.', 'Visto. Era de esperarse.'],
            cariñoso: ['Me dejaste en visto... como antes.', 'Vi que lo leíste. Me alegra que al menos lo hagas.'],
            ansioso: ['¿Sigues ahí? Me dejaste en visto...', 'No sé si me ignoras o estás ocupado/a...'],
            neutral: ['Veo que sigues con la costumbre de dejar en visto.', 'Sin comentarios...', '¿En serio?']
        }
    };

    const LOCAL_TYPING_PHRASES = {
        mejorAmigo: {
            enojado: ['¿Vas a tardar todo el día escribiendo? 😒', 'Si es para disculparte, más te vale que sea bueno.'],
            cariñoso: ['¿Qué me estás escribiendo que tardas tanto? 😊', 'Me intriga lo que pondrás... no me hagas esperar 👀'],
            ansioso: ['¿Por qué tardas tanto? ¿Es algo malo?', 'Escribe rápido, me estás poniendo nervioso/a...'],
            neutral: ['¿Estás escribiendo una biblia o qué? jajaj', 'Escribe rápido che 😂', 'Mucho texto estás preparando 👀']
        },
        pareja: {
            enojado: ['Si es una excusa, ni te molestes.', 'Escribe rápido, no estoy de humor para esperar.'],
            cariñoso: ['Llevas un rato escribiendo... me intriga ❤️', 'Tanto texto me pone nerviosa de la emoción jajaja'],
            ansioso: ['¿Qué me estás escribiendo? Me muero de curiosidad...', '¿Es algo serio? Estoy que me como las uñas...'],
            neutral: ['¿Qué me estás escribiendo tan largo? 👀', 'Tanto escribir me pone nerviosa jajaja']
        },
        amigaToxica: {
            enojado: ['Si vas a mandar un testamento mejor ahórratelo 🙄', 'Con lo que tardas escribiendo se me quitan las ganas...'],
            cariñoso: ['Ay, ¿me estás preparando un discurso? 💅', 'Mucho tecleo... más te vale que valga la pena.'],
            ansioso: ['¿Qué me estás escribiendo? No me dejes así...', 'Termina de escribir que me estreso 😩'],
            neutral: ['Tardas mil horas escribiendo...', '¿Vas a tardar todo el día?']
        },
        rival: {
            enojado: ['¿Tanto tardas para responder? Qué lento.', 'No tengo todo el día.'],
            cariñoso: ['¿Me estás escribiendo algo bonito? 👀', 'Curioso... ¿qué me preparas?'],
            ansioso: ['¿Qué tanto piensas? Ya escríbelo.', 'Estoy esperando...'],
            neutral: ['Escribe rápido, no tengo todo el día.', 'Tanto pensar para un mensaje...']
        },
        ex: {
            enojado: ['Si es para reclamar, ahórratelo.', 'Ni sé para qué te molestas en escribir tanto...'],
            cariñoso: ['¿Me estás escribiendo algo largo? Qué tierno...', 'Veo que escribes... me da curiosidad.'],
            ansioso: ['¿Qué me vas a decir? La incertidumbre me mata...', '¿Buenas o malas noticias?'],
            neutral: ['Veo que estás escribiendo un montón...', '¿Tanto tienes que decir?', 'Tómate tu tiempo...']
        }
    };

    /**
     * Determines the dominant emotional mood for phrase selection.
     */
    function getEmotionalMood(brain) {
        if (brain.enojo > 50 || brain.resentimiento > 50) return 'enojado';
        if (brain.afinidad > 70) return 'cariñoso';
        if (brain.ansiedad > 60 || brain.celos > 50) return 'ansioso';
        return 'neutral';
    }

    /**
     * Picks a phrase from the emotion-aware matrix.
     */
    function getEmotionAwarePhrase(dictionary, archetypeId, brain) {
        const mood = getEmotionalMood(brain);
        const archPhrases = dictionary[archetypeId] || dictionary.mejorAmigo;
        const moodPhrases = archPhrases[mood] || archPhrases.neutral;
        return moodPhrases[Math.floor(Math.random() * moodPhrases.length)];
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
                const localPhrase = getEmotionAwarePhrase(LOCAL_VISTO_PHRASES, brain.arquetipoId, brain);
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
                        const localPhrase = getEmotionAwarePhrase(LOCAL_TYPING_PHRASES, brain.arquetipoId, brain);
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

    return { startAutonomousLoop, resetTyping, setMessageJustArrived: (v) => { messageJustArrived = v; }, getVistoTimer: () => vistoTimer, clearVistoTimer: () => { if (vistoTimer) clearTimeout(vistoTimer); }, clearHomeostasis: () => clearInterval(homeostasisInterval) };
}
