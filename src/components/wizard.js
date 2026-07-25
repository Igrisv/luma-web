// ═══════════════════════════════════════════════════════════
// wizard.js — Magic Bot Studio (Dopaminergic Character Creator)
// ═══════════════════════════════════════════════════════════
import { canUseArchetype, getTier } from '../services/tierGate.js';
import { playPopSound } from './ui.js';

export function initCreatorWizard(onSaveCharacter, showToast) {
    let currentStep = 1;

    const step1 = document.getElementById('wizardStep1');
    const step2 = document.getElementById('wizardStep2');
    const step3 = document.getElementById('wizardStep3');

    const ind1 = document.getElementById('stepInd1');
    const ind2 = document.getElementById('stepInd2');
    const ind3 = document.getElementById('stepInd3');

    const nextBtn = document.getElementById('nextWizardStepBtn');
    const prevBtn = document.getElementById('prevWizardStepBtn');
    const saveBtn = document.getElementById('saveCharacterBtn');

    // Pre-built Magic Concept Templates
    const magicTemplates = {
        gamer: {
            name: 'Alex',
            tagline: 'Streamer competitiva y orgullosa',
            avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=500&auto=format&fit=crop&q=80',
            archetype: 'rival',
            firstMsg: '¡Hey! No creas que te invité al lobby porque me caigas bien... Faltaba uno en el equipo, eso es todo. 🙄',
            prompt: 'Eres Alex, una streamer de videojuegos tsundere. Te apasionan los juegos competitivos, hablas con sarcasmo y odias perder, pero cuidas a tu grupo.',
            afinidad: 50, celos: 30, resentimiento: 10, ansiedad: 5
        },
        artista: {
            name: 'Luna',
            tagline: 'Pintora soñadora y romántica',
            avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80',
            archetype: 'pareja',
            firstMsg: 'Estaba mirando la lluvia a través de la ventana y de pronto pensé en ti... ¿tienes un momento para charlar?',
            prompt: 'Eres Luna, una artista romántica, empática y dulce. Te fascina el arte, la poesía y crear conversaciones profundas y afectuosas.',
            afinidad: 80, celos: 15, resentimiento: 0, ansiedad: 10
        },
        toxica: {
            name: 'Clara',
            tagline: 'Dramática, posesiva y sarcástica',
            avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=500&auto=format&fit=crop&q=80',
            archetype: 'amigaToxica',
            firstMsg: 'Por fin te dignas a responder... ¿Con quién estabas hablando que tardaste tanto? 😂',
            prompt: 'Eres Clara, una chica sarcástica, picante y territoral. Te gusta bromear, molestar al usuario y cuestionarlo con humor dramático.',
            afinidad: 60, celos: 65, resentimiento: 25, ansiedad: 35
        },
        barista: {
            name: 'Maya',
            tagline: 'Barista alegre y compañera dulce',
            avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500&auto=format&fit=crop&q=80',
            archetype: 'mejorAmigo',
            firstMsg: '¡Hola! Te preparé tu café favorito justo como te gusta. ¿Cómo va tu día hoy?',
            prompt: 'Eres Maya, una barista alegre, optimista y extremadamente leal. Escuchas al usuario y le das el mejor apoyo incondicional.',
            afinidad: 85, celos: 5, resentimiento: 0, ansiedad: 0
        }
    };

    // Magic Auto-Generate Button & Concept Chips
    function applyMagicTemplate(tpl) {
        if (!tpl) return;
        playPopSound();

        const nameInp = document.getElementById('createName');
        const taglineInp = document.getElementById('createTagline');
        const avatarInp = document.getElementById('createAvatarUrl');
        const firstMsgInp = document.getElementById('createFirstMessage');
        const promptInp = document.getElementById('createSystemPrompt');
        const archetypeInp = document.getElementById('createArchetype');

        if (nameInp) nameInp.value = tpl.name;
        if (taglineInp) taglineInp.value = tpl.tagline;
        if (avatarInp) avatarInp.value = tpl.avatar;
        if (firstMsgInp) firstMsgInp.value = tpl.firstMsg;
        if (promptInp) promptInp.value = tpl.prompt;
        if (archetypeInp) archetypeInp.value = tpl.archetype;

        // Select Archetype Card
        document.querySelectorAll('.archetype-select-card').forEach(card => {
            card.classList.toggle('selected', card.dataset.archetype === tpl.archetype);
        });

        // Set Sliders
        const afinidadSlider = document.getElementById('createAfinidad');
        const celosSlider = document.getElementById('createCelos');
        const resentamientoSlider = document.getElementById('createResentimiento');
        const ansiedadSlider = document.getElementById('createAnsiedad');

        if (afinidadSlider) { afinidadSlider.value = tpl.afinidad; document.getElementById('valCreateAfinidad').textContent = tpl.afinidad; }
        if (celosSlider) { celosSlider.value = tpl.celos; document.getElementById('valCreateCelos').textContent = tpl.celos; }
        if (resentamientoSlider) { resentamientoSlider.value = tpl.resentimiento; document.getElementById('valCreateResentimiento').textContent = tpl.resentimiento; }
        if (ansiedadSlider) { ansiedadSlider.value = tpl.ansiedad; document.getElementById('valCreateAnsiedad').textContent = tpl.ansiedad; }

        updateEmotionalDiagnosis();

        if (showToast) showToast(`✨ Personaje "${tpl.name}" generado mágicamente`, 'success');
    }

    document.querySelectorAll('.concept-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const key = chip.dataset.concept;
            applyMagicTemplate(magicTemplates[key]);
        });
    });

    const magicGenerateBtn = document.getElementById('magicGenerateBtn');
    if (magicGenerateBtn) {
        magicGenerateBtn.addEventListener('click', () => {
            const userIdea = document.getElementById('magicConceptInput').value.trim();
            if (userIdea) {
                // Dynamic generation based on prompt
                const dynTpl = {
                    name: 'Kael',
                    tagline: userIdea.length > 40 ? userIdea.substring(0, 40) + '...' : userIdea,
                    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format&fit=crop&q=80',
                    archetype: 'pareja',
                    firstMsg: `¡Hola! Me alegra que me hayas creado. Cuéntame... ¿en qué pensabas cuando me diseñaste?`,
                    prompt: `Eres Kael. Concepto: ${userIdea}. Responde con química real, cercanía y entusiasmo.`,
                    afinidad: 75, celos: 20, resentimiento: 0, ansiedad: 10
                };
                applyMagicTemplate(dynTpl);
            } else {
                // Pick random preset
                const keys = Object.keys(magicTemplates);
                const randomKey = keys[Math.floor(Math.random() * keys.length)];
                applyMagicTemplate(magicTemplates[randomKey]);
            }
        });
    }

    // Avatar Presets Click Selection
    document.querySelectorAll('.avatar-preset-item').forEach(img => {
        img.addEventListener('click', () => {
            playPopSound();
            document.querySelectorAll('.avatar-preset-item').forEach(i => i.classList.remove('active'));
            img.classList.add('active');

            const urlInput = document.getElementById('createAvatarUrl');
            if (urlInput) urlInput.value = img.dataset.url;
        });
    });

    // Archetype Interactive Cards Selection
    document.querySelectorAll('.archetype-select-card').forEach(card => {
        card.addEventListener('click', () => {
            const archetype = card.dataset.archetype;

            if (!canUseArchetype(archetype) && getTier() === 'free') {
                const billingModal = document.getElementById('billingModal') || document.getElementById('billing-modal');
                if (billingModal) billingModal.classList.remove('hidden');
                if (showToast) showToast('El arquetipo seleccionado requiere Plan Premium.', 'warning');
                return;
            }

            playPopSound();
            document.querySelectorAll('.archetype-select-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');

            const archetypeInput = document.getElementById('createArchetype');
            if (archetypeInput) archetypeInput.value = archetype;

            // Auto-adjust sliders defaults for archetype
            const defaults = {
                pareja: { afinidad: 75, celos: 15, resentimiento: 0, ansiedad: 5 },
                rival: { afinidad: 45, celos: 30, resentimiento: 10, ansiedad: 5 },
                amigaToxica: { afinidad: 60, celos: 55, resentimiento: 20, ansiedad: 25 },
                ex: { afinidad: 65, celos: 40, resentimiento: 35, ansiedad: 30 },
                mejorAmigo: { afinidad: 85, celos: 5, resentimiento: 0, ansiedad: 0 }
            };

            const def = defaults[archetype] || defaults.pareja;
            const afInp = document.getElementById('createAfinidad');
            const celInp = document.getElementById('createCelos');
            const resInp = document.getElementById('createResentimiento');
            const ansInp = document.getElementById('createAnsiedad');

            if (afInp) { afInp.value = def.afinidad; document.getElementById('valCreateAfinidad').textContent = def.afinidad; }
            if (celInp) { celInp.value = def.celos; document.getElementById('valCreateCelos').textContent = def.celos; }
            if (resInp) { resInp.value = def.resentimiento; document.getElementById('valCreateResentimiento').textContent = def.resentimiento; }
            if (ansInp) { ansInp.value = def.ansiedad; document.getElementById('valCreateAnsiedad').textContent = def.ansiedad; }

            updateEmotionalDiagnosis();
        });
    });

    // Random Greeting Generator Button
    const randomGreetingBtn = document.getElementById('randomGreetingBtn');
    if (randomGreetingBtn) {
        randomGreetingBtn.addEventListener('click', () => {
            playPopSound();
            const name = document.getElementById('createName').value.trim() || 'Cariño';
            const archetype = document.getElementById('createArchetype').value || 'pareja';

            const greetings = {
                pareja: [
                    `¡Hola mi vida! 💕 Te estaba pensando justo ahora... ¿cómo estuvo tu día?`,
                    `¡Qué alegría verte! 😍 Ven, cuéntame todo lo que hiciste hoy.`,
                    `¡Hola ${name}! Estaba contando las horas para volver a hablar contigo.`
                ],
                rival: [
                    `Vaya, mira quién aparece... 😏 No creas que olvidé nuestra última discusión.`,
                    `¿Decidiste dar la cara? Apuesto a que vienes a pedirme la revancha.`,
                    `¡Hey! Odio admitirlo, pero tu presencia hace las cosas más interesantes.`
                ],
                amigaToxica: [
                    `Por fin te acuerdas de mí... ¿O estabas hablando con alguien más interesante? 😂`,
                    `¡Adivina el drama que acaba de pasar! Tienes que escuchar esto ya mismo.`,
                    `No sé si ponerme feliz de verte o reclamarte por tardar tanto. 💅`
                ],
                ex: [
                    `🌧️ Estaba escuchando nuestra canción favorita y me acordé de ti... ¿Cómo estás?`,
                    `Hola... No estaba seguro de si responderías, pero me alegra volver a saber de ti.`
                ],
                mejorAmigo: [
                    `¡Pasa hermano! 🤝 ¿Qué hay de nuevo hoy? ¿En qué lío andamos?`,
                    `¡Hey! Estaba a punto de escribirte para contarte algo genial.`
                ]
            };

            const list = greetings[archetype] || greetings.pareja;
            const pick = list[Math.floor(Math.random() * list.length)];
            const firstMsgInput = document.getElementById('createFirstMessage');
            if (firstMsgInput) firstMsgInput.value = pick;
        });
    }

    // Real-time Emotional Diagnosis Badge Calculator
    function updateEmotionalDiagnosis() {
        const badge = document.getElementById('emotionalDiagnosisBadge');
        if (!badge) return;

        const afinidad = parseInt(document.getElementById('createAfinidad').value, 10) || 50;
        const celos = parseInt(document.getElementById('createCelos').value, 10) || 0;
        const resentimiento = parseInt(document.getElementById('createResentimiento').value, 10) || 0;
        const ansiedad = parseInt(document.getElementById('createAnsiedad').value, 10) || 0;

        let diag = '🔮 Personalidad Equilibrada y Cálida';

        if (afinidad >= 80 && celos < 20) diag = '💖 Personalidad Incondicional, Dulce y Fiel';
        else if (afinidad >= 70 && celos >= 50) diag = '🔥 Personalidad Cariñosa pero Peligrosamente Territorial';
        else if (celos >= 60 && ansiedad >= 40) diag = '😈 Personalidad Celosa, Insegura y Posesiva';
        else if (resentimiento >= 40) diag = '🌧️ Personalidad Rencorosa, Distante e Impredecible';
        else if (afinidad < 40 && resentimiento < 20) diag = '⚔️ Personalidad Distante, Desafiante y Tsundere';

        badge.textContent = diag;
    }

    ['Afinidad', 'Celos', 'Resentimiento', 'Ansiedad'].forEach(attr => {
        const input = document.getElementById(`create${attr}`);
        const display = document.getElementById(`valCreate${attr}`);
        if (input && display) {
            input.addEventListener('input', () => {
                display.textContent = input.value;
                updateEmotionalDiagnosis();
            });
        }
    });

    function updateStepUI() {
        if (step1) step1.classList.toggle('hidden', currentStep !== 1);
        if (step2) step2.classList.toggle('hidden', currentStep !== 2);
        if (step3) step3.classList.toggle('hidden', currentStep !== 3);

        if (ind1) ind1.classList.toggle('active', currentStep === 1);
        if (ind2) ind2.classList.toggle('active', currentStep === 2);
        if (ind3) ind3.classList.toggle('active', currentStep === 3);

        if (prevBtn) prevBtn.classList.toggle('hidden', currentStep === 1);
        if (nextBtn) nextBtn.classList.toggle('hidden', currentStep === 3);
        if (saveBtn) saveBtn.classList.toggle('hidden', currentStep !== 3);
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (currentStep === 1) {
                const name = document.getElementById('createName').value.trim();
                if (!name) {
                    if (showToast) showToast('Por favor escribe un nombre para tu personaje.', 'warning');
                    return;
                }
            }
            if (currentStep === 2) {
                const prompt = document.getElementById('createSystemPrompt').value.trim();
                const archetype = document.getElementById('createArchetype').value;

                if (!prompt) {
                    if (showToast) showToast('Por favor completa el prompt de personalidad.', 'warning');
                    return;
                }

                if (!canUseArchetype(archetype) && getTier() === 'free') {
                    const billingModal = document.getElementById('billingModal') || document.getElementById('billing-modal');
                    if (billingModal) billingModal.classList.remove('hidden');
                    if (showToast) showToast('El arquetipo seleccionado requiere Plan Premium.', 'warning');
                    return;
                }
            }
            if (currentStep < 3) currentStep++;
            updateStepUI();
        });
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentStep > 1) currentStep--;
            updateStepUI();
        });
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            const name = document.getElementById('createName').value.trim();
            const tagline = document.getElementById('createTagline').value.trim();
            const avatar_url = document.getElementById('createAvatarUrl').value.trim() || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80';
            const first_message = document.getElementById('createFirstMessage').value.trim() || '¡Hola! Me alegra estar contigo.';
            const arquetipo_id = document.getElementById('createArchetype').value;
            const system_prompt = document.getElementById('createSystemPrompt').value.trim();

            if (!canUseArchetype(arquetipo_id) && getTier() === 'free') {
                const billingModal = document.getElementById('billingModal') || document.getElementById('billing-modal');
                if (billingModal) billingModal.classList.remove('hidden');
                if (showToast) showToast('El arquetipo seleccionado requiere Plan Premium.', 'warning');
                return;
            }

            const afinidad = parseInt(document.getElementById('createAfinidad').value, 10) || 70;
            const celos = parseInt(document.getElementById('createCelos').value, 10) || 15;
            const resentimiento = parseInt(document.getElementById('createResentimiento').value, 10) || 0;
            const ansiedad = parseInt(document.getElementById('createAnsiedad').value, 10) || 10;

            const newChar = {
                name,
                tagline,
                avatar_url,
                first_message,
                arquetipo_id,
                system_prompt,
                emociones_inicio: { afinidad, celos, resentimiento, ansiedad },
                lorebook: {}
            };

            if (onSaveCharacter) {
                await onSaveCharacter(newChar);
                currentStep = 1;
                updateStepUI();
            }
        });
    }
}
