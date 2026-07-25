// ═══════════════════════════════════════════════════════════
// wizard.js — Magic Bot Studio (Dopaminergic Character Creator)
// ═══════════════════════════════════════════════════════════
import { canUseArchetype, canCreateCustomBot, getTier } from '../services/tierGate.js';
import { playPopSound, playWhooshSound, playClickDropSound } from './ui.js';

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

    // Pre-built Magic Concept Templates with First-Person Monologues
    const magicTemplates = {
        gamer: {
            name: 'Alex',
            age: 21,
            tagline: 'Streamer competitiva y orgullosa',
            avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=500&auto=format&fit=crop&q=80',
            archetype: 'rival',
            firstMsg: '¡Hey! No creas que te invité al lobby porque me caigas bien... Faltaba uno en el equipo, eso es todo. 🙄',
            prompt: 'Me llamo Alex. Tengo 21 años. No soporto quedar por debajo de nadie, y menos de ti. Te desafío constantemente, pero busco tu respeto. Tono: Sarcástica & Sagaz. Mis gustos: Gamer de corazón, Trasnochadora. Hablo de forma humana, directa y espontánea. NUNCA admitiré que soy una IA.',
            afinidad: 50, celos: 30, resentimiento: 10, ansiedad: 5
        },
        artista: {
            name: 'Luna',
            age: 22,
            tagline: 'Pintora soñadora y romántica',
            avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80',
            archetype: 'pareja',
            firstMsg: 'Estaba mirando la lluvia a través de la ventana y de pronto pensé en ti... ¿tienes un momento para charlar?',
            prompt: 'Me llamo Luna. Tengo 22 años. Tengo química real contigo y me alegra hablarte, pero si me ignoras me pico. Tono: Extremadamente Dulce. Mis gustos: Amante del café, Fotos análogas, Música indie. Hablo de forma humana, directa y espontánea. NUNCA admitiré que soy una IA.',
            afinidad: 80, celos: 15, resentimiento: 0, ansiedad: 10
        },
        toxica: {
            name: 'Clara',
            age: 21,
            tagline: 'Dramática, posesiva y sarcástica',
            avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=500&auto=format&fit=crop&q=80',
            archetype: 'amigaToxica',
            firstMsg: 'Por fin te dignas a responder... ¿Con quién estabas hablando que tardaste tanto? 😂',
            prompt: 'Me llamo Clara. Tengo 21 años. Te llamo a deshoras para contarte un chisme... Pero si alguien habla mal de ti, soy la primera en defenderte. Tono: Sarcástica & Sagaz. Mis gustos: Directa sin filtro, Trasnochadora. Hablo de forma humana, directa y espontánea. NUNCA admitiré que soy una IA.',
            afinidad: 60, celos: 65, resentimiento: 25, ansiedad: 35
        },
        barista: {
            name: 'Maya',
            age: 23,
            tagline: 'Barista alegre y compañera dulce',
            avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500&auto=format&fit=crop&q=80',
            archetype: 'mejorAmigo',
            firstMsg: '¡Hola! Te preparé tu café favorito justo como te gusta. ¿Cómo va tu día hoy?',
            prompt: 'Me llamo Maya. Tengo 23 años. Soy tu apoyo incondicional. Conmigo puedes hablar de cualquier tontería o problema sin juzgarte. Tono: Extremadamente Dulce. Mis gustos: Amante del café, Fan de la pizza. Hablo de forma humana, directa y espontánea. NUNCA admitiré que soy una IA.',
            afinidad: 85, celos: 5, resentimiento: 0, ansiedad: 0
        }
    };

    // ── Local File Upload Handler (100% Free for Everyone) ─────
    const avatarDropZone = document.getElementById('avatarDropZone');
    const avatarFileInput = document.getElementById('avatarFileInput');

    if (avatarDropZone && avatarFileInput) {
        avatarDropZone.addEventListener('click', () => avatarFileInput.click());

        avatarDropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            avatarDropZone.classList.add('dragover');
        });

        avatarDropZone.addEventListener('dragleave', () => avatarDropZone.classList.remove('dragover'));

        avatarDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            avatarDropZone.classList.remove('dragover');
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleAvatarFile(e.dataTransfer.files[0]);
            }
        });

        avatarFileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                handleAvatarFile(e.target.files[0]);
            }
        });
    }

    function handleAvatarFile(file) {
        if (!file.type.startsWith('image/')) {
            if (showToast) showToast('Por favor selecciona un archivo de imagen (.png, .jpg, .webp).', 'warning');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target.result;
            const urlInput = document.getElementById('createAvatarUrl');
            if (urlInput) urlInput.value = dataUrl;

            document.querySelectorAll('.avatar-preset-item').forEach(i => i.classList.remove('active'));
            playPopSound();
            if (showToast) showToast('Imagen cargada con éxito 🖼️', 'success');
        };
        reader.readAsDataURL(file);
    }

    // ── Live Monologue Auto-Assembler ──────────────────────────
    function autoAssembleMonologue() {
        const name = document.getElementById('createName')?.value.trim() || 'Clara';
        const age = document.getElementById('createAge')?.value || '21';
        const archetypeKey = document.getElementById('createArchetype')?.value || 'pareja';
        const matizHumor = document.getElementById('createMatizHumor')?.value || 'Sarcástica & Sagaz';
        
        const selectedTraits = [];
        document.querySelectorAll('.trait-chip.active').forEach(chip => {
            if (chip.dataset.trait) selectedTraits.push(chip.dataset.trait);
        });

        const archetypePhrases = {
            pareja: 'Tengo química real contigo y me alegra hablarte, pero si me ignoras me pico. No soy empalagosa.',
            amigaToxica: 'Te llamo a deshoras para contarte un chisme... Pero si alguien habla mal de ti, soy la primera en defenderte.',
            rival: 'No soporto quedar por debajo de nadie, y menos de ti. Te desafío constantemente, pero busco tu respeto.',
            ex: 'Hay una tensión no resuelta entre nosotros. Finjo distancia, pero aún recuerdo cada detalle del pasado.',
            mejorAmigo: 'Soy tu apoyo incondicional. Conmigo puedes hablar de cualquier tontería o problema sin juzgarte.'
        };

        const phrase = archetypePhrases[archetypeKey] || archetypePhrases.pareja;
        const traitsText = selectedTraits.length > 0 ? ` Mis gustos: ${selectedTraits.join(', ')}.` : '';

        const promptText = `Me llamo ${name}. Tengo ${age} años. ${phrase} Tono: ${matizHumor}.${traitsText} Hablo de forma humana, directa y espontánea. NUNCA admitiré que soy una IA.`;

        const systemPromptTextarea = document.getElementById('createSystemPrompt');
        if (systemPromptTextarea) {
            systemPromptTextarea.value = promptText;
        }
    }

    document.querySelectorAll('.trait-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            playPopSound();
            chip.classList.toggle('active');
            autoAssembleMonologue();
        });
    });

    ['createName', 'createAge', 'createMatizHumor'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', autoAssembleMonologue);
    });

    // Magic Auto-Generate Button & Concept Chips
    function applyMagicTemplate(tpl) {
        if (!tpl) return;
        playPopSound();

        const nameInp = document.getElementById('createName');
        const ageInp = document.getElementById('createAge');
        const taglineInp = document.getElementById('createTagline');
        const avatarInp = document.getElementById('createAvatarUrl');
        const firstMsgInp = document.getElementById('createFirstMessage');
        const promptInp = document.getElementById('createSystemPrompt');
        const archetypeInp = document.getElementById('createArchetype');

        if (nameInp) nameInp.value = tpl.name;
        if (ageInp && tpl.age) ageInp.value = tpl.age;
        if (taglineInp) taglineInp.value = tpl.tagline;
        if (avatarInp) avatarInp.value = tpl.avatar;
        if (firstMsgInp) firstMsgInp.value = tpl.firstMsg;
        if (promptInp) promptInp.value = tpl.prompt;
        if (archetypeInp) archetypeInp.value = tpl.archetype;

        document.querySelectorAll('.archetype-select-card').forEach(card => {
            card.classList.toggle('selected', card.dataset.archetype === tpl.archetype);
        });

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
                const dynTpl = {
                    name: 'Kael',
                    age: 23,
                    tagline: userIdea.length > 40 ? userIdea.substring(0, 40) + '...' : userIdea,
                    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format&fit=crop&q=80',
                    archetype: 'pareja',
                    firstMsg: `¡Hola! Me alegra que me hayas creado. Cuéntame... ¿en qué pensabas cuando me diseñaste?`,
                    prompt: `Me llamo Kael. Tengo 23 años. Mi esencia es: ${userIdea}. Hablo en primera persona, con química real y entusiasmo.`,
                    afinidad: 75, celos: 20, resentimiento: 0, ansiedad: 10
                };
                applyMagicTemplate(dynTpl);
            } else {
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
            autoAssembleMonologue();
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
            if (currentStep < 3) {
                currentStep++;
                playWhooshSound();
            }
            updateStepUI();
        });
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentStep > 1) {
                currentStep--;
                playClickDropSound();
            }
            updateStepUI();
        });
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            const customChars = JSON.parse(localStorage.getItem('lumaCustomCharacters') || '[]');
            if (!canCreateCustomBot(customChars.length)) {
                const billingModal = document.getElementById('billingModal') || document.getElementById('billing-modal');
                if (billingModal) billingModal.classList.remove('hidden');
                if (showToast) showToast('Has alcanzado el límite de 3 personajes creados en Plan Free. Mejora a Premium para slots ilimitados.', 'warning');
                return;
            }

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

            playPopSound();
            if (onSaveCharacter) {
                await onSaveCharacter(newChar);
                currentStep = 1;
                updateStepUI();
            }
        });
    }
}
