// ═══════════════════════════════════════════════════════════
// chat.js — SPA Master Controller & Centered Reading UI Layout
// ═══════════════════════════════════════════════════════════
import { ChatBrain } from '../core/brain.js';
import { getEmotionalBadge } from '../services/cardParser.js';
import {
    switchView, renderGallery, renderSidebarChatList,
    initCreatorWizard, initCardImporter, initPanels,
    initConfigPanel, initDiaryUI, initRewardedAdUI,
    renderHistory, createMessageElement, showToast, playPopSound
} from './ui.js';
import { apiFetch } from '../services/auth.js';
import { getTier, canUseArchetype, isCharacterLocked } from '../services/tierGate.js';

export async function initChat() {
    let charactersData = {
        official: [
            {
                id: 'pareja',
                arquetipo_id: 'pareja',
                name: 'Sofía',
                tagline: 'Tu Pareja Cariñosa',
                description: 'Dulce, empática y atenta, pero con un toque territorial y apasionado.',
                avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80',
                first_message: '¡Hola mi amor! 💕 Te estaba esperando... ¿cómo estuvo tu día?',
                system_prompt: 'Me llamo Sofía. Tengo 22 años. Me gusta el café frío, tomar fotos análogas y molestarte cuando te pones serio. Odio la hipocresía y que tarden horas en responder un mensaje sin decir nada. Hablo en frases cortas, con humor seco y afecto genuino. NUNCA admitiré que soy una IA.',
                is_official: true,
                tier_required: 'free',
                emociones_inicio: { afinidad: 70, celos: 15, enojo: 0 }
            }
        ],
        custom: JSON.parse(localStorage.getItem('lumaCustomCharacters') || '[]')
    };

    try {
        const res = await apiFetch('/api/characters');
        if (res.ok) {
            const data = await res.json();
            if (data.official && data.official.length > 0) charactersData.official = data.official;
            if (data.custom) {
                const customMap = new Map();
                charactersData.custom.forEach(c => customMap.set(c.id, c));
                data.custom.forEach(c => customMap.set(c.id, c));
                charactersData.custom = Array.from(customMap.values());
            }
        }
    } catch (e) {
        console.log('Using offline character defaults.');
    }
    let activeChatIds = JSON.parse(localStorage.getItem('lumaActiveChatIds') || '["pareja"]');

    function saveActiveChatIds() {
        localStorage.setItem('lumaActiveChatIds', JSON.stringify(activeChatIds));
    }

    function getActiveCharacters() {
        const all = [...charactersData.official, ...charactersData.custom];
        return all.filter(c => activeChatIds.includes(c.id) || activeChatIds.includes(c.arquetipo_id));
    }

    let activeCharId = localStorage.getItem('lumaActiveCharacter');
    let activeChars = getActiveCharacters();

    if (!activeCharId || !activeChars.some(c => c.id === activeCharId || c.arquetipo_id === activeCharId)) {
        if (activeChars.length > 0) {
            activeCharId = activeChars[0].id || activeChars[0].arquetipo_id;
            localStorage.setItem('lumaActiveCharacter', activeCharId);
        } else {
            activeCharId = null;
        }
    }

    let allChars = [...charactersData.official, ...charactersData.custom];
    let currentCharacter = (activeCharId && allChars.find(c => c.id === activeCharId || c.arquetipo_id === activeCharId))
                          || activeChars[0]
                          || charactersData.official[0]
                          || allChars[0];

    const brainCharId = currentCharacter ? (currentCharacter.id || currentCharacter.arquetipo_id) : 'pareja';
    const brainArqId = currentCharacter ? (currentCharacter.arquetipo_id || currentCharacter.id) : 'pareja';

    let brain = new ChatBrain(brainCharId, brainArqId);
    if (currentCharacter && currentCharacter.system_prompt) brain.systemPrompt = currentCharacter.system_prompt;
    if (currentCharacter && currentCharacter.sensitivities) brain.sensitivities = currentCharacter.sensitivities;

    function getAdaptiveSuggestions(brainRef, archetypeId) {
        const hour = new Date().getHours();
        const suggestions = [];

        // 1. Contexto de hora del día
        if (hour >= 5 && hour < 12) {
            suggestions.push("¡Buenos días! ¿Cómo amaneciste?");
        } else if (hour >= 12 && hour < 19) {
            suggestions.push("¿Qué tal va tu tarde?");
        } else {
            suggestions.push("¿Cómo estuvo tu día hoy?");
        }

        // 2. Contexto predictivo según último mensaje del bot
        const lastMsg = brainRef && brainRef.history && brainRef.history.length > 0 
            ? brainRef.history[brainRef.history.length - 1] 
            : null;

        if (lastMsg && lastMsg.role === 'assistant') {
            const content = lastMsg.content || '';
            if (content.includes('?') || content.includes('¿')) {
                suggestions.push("Sí, totalmente de acuerdo");
                suggestions.push("En verdad no tanto...");
            } else if (content.match(/triste|mal|difícil|estrés|cansad/i)) {
                suggestions.push("Te entiendo perfectamente...");
                suggestions.push("¿Cómo puedo ayudarte?");
            } else {
                suggestions.push("¡Cuéntame más sobre eso!");
                suggestions.push("No me lo esperaba...");
            }
        } else {
            const defaultsMap = {
                pareja: ["Cuéntame en qué piensas...", "¿Qué planes tienes hoy?"],
                rival: ["¿Pones a prueba tu argumento?", "Veamos quién tiene la razón"],
                amigaToxica: ["¿Qué novedad me tienes?", "No me digas que sigues en lo mismo..."],
                ex: ["Hace tiempo no hablábamos así", "¿Cómo han ido las cosas?"],
                mejorAmigo: ["¿Qué hay de nuevo hoy?", "¿En qué andas trabajando?"]
            };
            const archetypeDefaults = defaultsMap[archetypeId] || defaultsMap.pareja;
            archetypeDefaults.forEach(p => suggestions.push(p));
        }

        // 3. Frases aprendidas habitualmente por el usuario
        try {
            const learned = JSON.parse(localStorage.getItem('lumaUserLearnedPhrases') || '[]');
            if (learned.length > 0) {
                learned.slice(-2).reverse().forEach(phrase => {
                    if (!suggestions.includes(phrase)) suggestions.push(phrase);
                });
            }
        } catch (e) {}

        return Array.from(new Set(suggestions)).slice(0, 4);
    }

    function recordUserPhrase(text) {
        if (!text || text.length < 4 || text.length > 55) return;
        try {
            let learned = JSON.parse(localStorage.getItem('lumaUserLearnedPhrases') || '[]');
            learned = learned.filter(p => p.toLowerCase() !== text.toLowerCase());
            learned.push(text);
            if (learned.length > 15) learned = learned.slice(-15);
            localStorage.setItem('lumaUserLearnedPhrases', JSON.stringify(learned));
        } catch (e) {}
    }

    function renderQuickStarters(archetypeId) {
        const startersContainer = document.getElementById('quickStartersContainer');
        if (!startersContainer) return;

        const prompts = getAdaptiveSuggestions(brain, archetypeId);
        startersContainer.innerHTML = prompts.map(p => `
            <button class="starter-chip" data-prompt="${p}">${p}</button>
        `).join('');

        startersContainer.querySelectorAll('.starter-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const prompt = chip.dataset.prompt;
                const chatInput = document.getElementById('chatInput');
                if (chatInput && prompt) {
                    chatInput.value = prompt;
                    handleSendMessage();
                }
            });
        });
    }

    function promptStartModeIfNeeded(char, forcePrompt = false, onProceed) {
        const id = char.id || char.arquetipo_id;
        const arqId = char.arquetipo_id || char.id;

        const hasSavedConfig = localStorage.getItem(`chatConfig_${id}`) !== null ||
                               localStorage.getItem(`chatConfig_${arqId}`) !== null ||
                               localStorage.getItem(`chatHistory_${id}`) !== null ||
                               localStorage.getItem(`chatHistory_${arqId}`) !== null;

        if (hasSavedConfig && !forcePrompt) {
            onProceed();
            return;
        }

        const modal = document.getElementById('start-mode-modal');
        const titleEl = document.getElementById('start-mode-char-name');
        const affinityTag = document.getElementById('start-mode-affinity-tag');
        const btnKnown = document.getElementById('btn-start-known');
        const btnZero = document.getElementById('btn-start-zero');

        if (!modal || !btnKnown || !btnZero) {
            onProceed();
            return;
        }

        const defaultAfinidad = char.emociones_inicio?.afinidad !== undefined ? char.emociones_inicio.afinidad : 70;
        if (titleEl) titleEl.textContent = `Iniciar Historia con ${char.name}`;
        if (affinityTag) affinityTag.textContent = `Afinidad ${defaultAfinidad}%`;

        modal.classList.remove('hidden');

        const cleanup = () => {
            modal.classList.add('hidden');
            btnKnown.onclick = null;
            btnZero.onclick = null;
        };

        btnKnown.onclick = (e) => {
            e.stopPropagation();
            cleanup();
            const initialConfig = {
                afinidad: defaultAfinidad,
                diasActivos: [
                    new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0],
                    new Date(Date.now() - 1 * 86400000).toISOString().split('T')[0],
                    new Date().toISOString().split('T')[0]
                ]
            };
            localStorage.setItem(`chatConfig_${id}`, JSON.stringify(initialConfig));
            if (arqId !== id) localStorage.setItem(`chatConfig_${arqId}`, JSON.stringify(initialConfig));
            onProceed();
        };

        btnZero.onclick = (e) => {
            e.stopPropagation();
            cleanup();
            const initialConfig = {
                afinidad: 0,
                diasActivos: [new Date().toISOString().split('T')[0]]
            };
            localStorage.setItem(`chatConfig_${id}`, JSON.stringify(initialConfig));
            if (arqId !== id) localStorage.setItem(`chatConfig_${arqId}`, JSON.stringify(initialConfig));
            onProceed();
        };
    }

    function deleteCharacter(charId) {
        const all = [...charactersData.official, ...charactersData.custom];
        const targetChar = all.find(c => c.id === charId || c.arquetipo_id === charId);
        const name = targetChar ? targetChar.name : 'este personaje';

        if (!confirm(`¿Eliminar la conversación con ${name}?`)) return;

        const targetKey = targetChar ? (targetChar.id || targetChar.arquetipo_id) : charId;
        activeChatIds = activeChatIds.filter(id => id !== charId && id !== targetKey && id !== (targetChar ? targetChar.arquetipo_id : ''));
        saveActiveChatIds();

        localStorage.removeItem(`chatConfig_${charId}`);
        localStorage.removeItem(`chatHistory_${charId}`);
        if (targetChar && targetChar.arquetipo_id) {
            localStorage.removeItem(`chatConfig_${targetChar.arquetipo_id}`);
            localStorage.removeItem(`chatHistory_${targetChar.arquetipo_id}`);
        }

        if (targetChar && !targetChar.is_official) {
            charactersData.custom = charactersData.custom.filter(c => c.id !== charId);
            localStorage.setItem('lumaCustomCharacters', JSON.stringify(charactersData.custom));
            apiFetch(`/api/characters/${charId}`, { method: 'DELETE' }).catch(() => {});
        }

        showToast(`Conversación con ${name} eliminada.`, 'info');

        const remainingActive = getActiveCharacters();

        if (activeCharId === charId || (targetChar && activeCharId === targetChar.arquetipo_id)) {
            if (remainingActive.length > 0) {
                selectCharacter(remainingActive[0]);
            } else {
                activeCharId = null;
                localStorage.removeItem('lumaActiveCharacter');
                renderSidebarChatList([], null, selectCharacter, deleteCharacter);
                switchView('gallery');
            }
        } else {
            renderSidebarChatList(remainingActive, activeCharId, selectCharacter, deleteCharacter);
        }
    }

    function selectCharacter(char, forcePrompt = false) {
        if (!char) return;

        if (isCharacterLocked(char)) {
            const billingModal = document.getElementById('billingModal') || document.getElementById('billing-modal');
            if (billingModal) billingModal.classList.remove('hidden');
            showToast(`El personaje "${char.name}" requiere Plan Premium. Mejora tu plan para chatear.`, 'warning');
            return;
        }

        const targetId = char.id || char.arquetipo_id;
        if (!activeChatIds.includes(targetId)) {
            activeChatIds.push(targetId);
            saveActiveChatIds();
        }

        promptStartModeIfNeeded(char, forcePrompt, () => {
            currentCharacter = char;
            activeCharId = char.id || char.arquetipo_id;
            localStorage.setItem('lumaActiveCharacter', activeCharId);

            // Sync 3D model with main stage
            window.dispatchEvent(new CustomEvent('loadCharacterModel', {
                detail: { model3d_url: char.model3d_url || '' }
            }));

            brain = new ChatBrain(char.id, char.arquetipo_id);
            if (char.system_prompt) brain.systemPrompt = char.system_prompt;
            if (char.sensitivities) brain.sensitivities = char.sensitivities;

            const headerAvatar = document.getElementById('chatHeaderAvatar');
            const headerName = document.getElementById('chatHeaderName');
            const headerTagline = document.getElementById('chatHeaderTagline');
            const affinityScore = document.getElementById('affinityScore');
            const emotionalDot = document.getElementById('chatEmotionalDot');

            if (headerAvatar) headerAvatar.src = char.avatar_url;
            if (headerName) headerName.textContent = char.name;
            if (headerTagline) headerTagline.textContent = char.tagline || 'Acompañante AI';

            const badgeInfo = getEmotionalBadge(brain);
            if (affinityScore) affinityScore.textContent = `${brain.afinidad}%`;
            if (emotionalDot) {
                emotionalDot.style.background = badgeInfo.color;
                emotionalDot.style.boxShadow = `0 0 6px ${badgeInfo.color}`;
            }

            // Populate Chat Hero Card
            const heroAvatar = document.getElementById('heroCardAvatar');
            const heroName = document.getElementById('heroCardName');
            const heroTagline = document.getElementById('heroCardTagline');
            const heroArchetype = document.getElementById('heroCardArchetype');
            const heroAffinity = document.getElementById('heroCardAffinity');

            if (heroAvatar) heroAvatar.src = char.avatar_url;
            if (heroName) heroName.textContent = char.name;
            if (heroTagline) heroTagline.textContent = char.description || char.tagline || '';

            const archetypeNames = {
                pareja: 'Pareja Cariñosa',
                rival: 'Rival Competitiva',
                amigaToxica: 'Amiga Tóxica',
                ex: 'Historial Compartido',
                mejorAmigo: 'Mejor Amigo/a'
            };
            if (heroArchetype) heroArchetype.textContent = archetypeNames[char.arquetipo_id] || 'Acompañante';
            if (heroAffinity) heroAffinity.textContent = `${brain.afinidad}% Afinidad`;

            const messagesArea = document.getElementById('messagesArea');
            const messagesList = document.getElementById('messagesList') || messagesArea;
            
            if (messagesArea && messagesList) {
                if (brain.history && brain.history.length > 0) {
                    renderHistory(brain, messagesArea);
                } else {
                    messagesList.innerHTML = '';
                    const initialMsg = char.first_message || '¡Hola! Me alegra hablar contigo.';
                    brain.addMessage('assistant', `<respuesta>${initialMsg}</respuesta>`);
                    renderHistory(brain, messagesArea);
                }
            }

            renderQuickStarters(char.arquetipo_id);
            renderSidebarChatList(getActiveCharacters(), activeCharId, selectCharacter, deleteCharacter);
            switchView('chat');
        });
    }

    renderGallery(charactersData, 'all', '', selectCharacter);
    renderSidebarChatList(getActiveCharacters(), activeCharId, selectCharacter, deleteCharacter);

    // Top Segmented Switcher & Navigation
    const navSegmentGallery = document.getElementById('navSegmentGallery');
    const navSegmentChat = document.getElementById('navSegmentChat');
    const brandBtn = document.getElementById('brandBtn');
    const searchInput = document.getElementById('searchInput');

    if (navSegmentGallery) navSegmentGallery.addEventListener('click', () => switchView('gallery'));
    if (navSegmentChat) navSegmentChat.addEventListener('click', () => switchView('chat'));
    if (brandBtn) brandBtn.addEventListener('click', () => switchView('gallery'));

    let activeCategory = 'all';
    const categoryTabs = document.querySelectorAll('.tab-btn');
    categoryTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            categoryTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            activeCategory = tab.dataset.category || 'all';
            renderGallery(charactersData, activeCategory, searchInput ? searchInput.value : '', selectCharacter);
        });
    });

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            renderGallery(charactersData, activeCategory, searchInput.value, selectCharacter);
        });
    }

    const openCreatorBtn = document.getElementById('openCreatorBtn');
    const heroCreateBtn = document.getElementById('heroCreateBtn');
    const closeCreatorModal = document.getElementById('closeCreatorModal');
    const creatorModal = document.getElementById('creatorModal');

    if (openCreatorBtn && creatorModal) openCreatorBtn.addEventListener('click', () => creatorModal.classList.remove('hidden'));
    if (heroCreateBtn && creatorModal) heroCreateBtn.addEventListener('click', () => creatorModal.classList.remove('hidden'));
    if (closeCreatorModal && creatorModal) closeCreatorModal.addEventListener('click', () => creatorModal.classList.add('hidden'));

    const openImporterBtn = document.getElementById('openImporterBtn');
    const closeImportModal = document.getElementById('closeImportModal');
    const importModal = document.getElementById('importModal');

    if (openImporterBtn && importModal) openImporterBtn.addEventListener('click', () => importModal.classList.remove('hidden'));
    if (closeImportModal && importModal) closeImportModal.addEventListener('click', () => importModal.classList.add('hidden'));

    const tierBadge = document.getElementById('tierBadge');
    const closeBillingModal = document.getElementById('closeBillingModal');
    const billingModal = document.getElementById('billingModal');

    const deleteChatBtn = document.getElementById('deleteChatBtn');
    if (deleteChatBtn) {
        deleteChatBtn.addEventListener('click', () => {
            if (activeCharId) {
                deleteCharacter(activeCharId);
            }
        });
    }

    initCreatorWizard(async (newCharData) => {
        const charId = `custom_${Date.now()}`;
        const fullChar = {
            id: charId,
            ...newCharData,
            is_official: false
        };

        charactersData.custom.unshift(fullChar);
        localStorage.setItem('lumaCustomCharacters', JSON.stringify(charactersData.custom));

        try {
            await apiFetch('/api/characters', {
                method: 'POST',
                body: JSON.stringify(fullChar)
            });
        } catch (e) {}

        if (creatorModal) creatorModal.classList.add('hidden');
        renderGallery(charactersData, 'custom', '', selectCharacter);
        showToast(`Personaje "${fullChar.name}" creado con éxito ✨`, 'success');
        selectCharacter(fullChar);
    }, showToast);

    initCardImporter(async (importedChar) => {
        const charId = `imported_${Date.now()}`;
        const fullChar = {
            id: charId,
            ...importedChar,
            is_official: false,
            arquetipo_id: 'pareja'
        };

        charactersData.custom.unshift(fullChar);
        localStorage.setItem('lumaCustomCharacters', JSON.stringify(charactersData.custom));

        if (importModal) importModal.classList.add('hidden');
        renderGallery(charactersData, 'custom', '', selectCharacter);
        showToast(`Tarjeta "${fullChar.name}" importada con éxito 📥`, 'success');
        selectCharacter(fullChar);
    }, showToast);

    const { closeAllPanels } = initPanels(brain);
    const messagesArea = document.getElementById('messagesArea');
    initConfigPanel(brain, closeAllPanels, messagesArea);
    initDiaryUI(brain);
    initRewardedAdUI(brain);

    const chatInput = document.getElementById('chatInput');
    const sendMessageBtn = document.getElementById('sendMessageBtn');
    const tokenIndicator = document.getElementById('tokenIndicator');
    const micBtn = document.getElementById('micBtn');

    if (chatInput && tokenIndicator) {
        chatInput.addEventListener('input', () => {
            const tokens = Math.ceil(chatInput.value.length / 4);
            tokenIndicator.textContent = `${tokens} / 500 tokens`;
        });

        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
            }
        });
    }

    if (sendMessageBtn) {
        sendMessageBtn.addEventListener('click', handleSendMessage);
    }

    if (micBtn) {
        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRec) {
            const recognition = new SpeechRec();
            recognition.lang = 'es-MX';
            recognition.interimResults = false;

            let isListening = false;
            micBtn.addEventListener('click', () => {
                if (!isListening) {
                    recognition.start();
                    isListening = true;
                    micBtn.style.background = 'rgba(244, 63, 94, 0.2)';
                    micBtn.style.borderColor = 'var(--accent-rose)';
                    showToast('Escuchando voz... Habla ahora 🎙️', 'info');
                } else {
                    recognition.stop();
                    isListening = false;
                    micBtn.style.background = '';
                    micBtn.style.borderColor = '';
                }
            });

            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                if (chatInput) chatInput.value = (chatInput.value + ' ' + transcript).trim();
                isListening = false;
                micBtn.style.background = '';
                micBtn.style.borderColor = '';
            };

            recognition.onerror = () => {
                isListening = false;
                micBtn.style.background = '';
                micBtn.style.borderColor = '';
            };
        } else {
            micBtn.style.opacity = '0.5';
            micBtn.title = 'Reconocimiento de voz no soportado en este navegador';
        }
    }

    async function handleSendMessage() {
        if (!chatInput) return;
        const text = chatInput.value.trim();
        if (!text) return;

        // Tier Gate Validation 1: Archetype availability check
        const currentTier = getTier();
        if (currentCharacter && !canUseArchetype(currentCharacter.arquetipo_id) && currentTier === 'free') {
            playClickDropSound();
            const billingModal = document.getElementById('billingModal') || document.getElementById('billing-modal');
            if (billingModal) billingModal.classList.remove('hidden');
            if (showToast) {
                showToast(`No puedes chatear con "${currentCharacter.name}". El arquetipo "${currentCharacter.arquetipo_id}" requiere Plan Premium.`, 'warning');
            }
            return;
        }

        // Tier Gate Validation 2: Daily message limit check for Free Plan
        if (currentTier === 'free' && window.lumaDailyCount >= 15) {
            playClickDropSound();
            const billingModal = document.getElementById('billingModal') || document.getElementById('billing-modal');
            if (billingModal) billingModal.classList.remove('hidden');
            if (showToast) {
                showToast('Has alcanzado el límite diario de 15 mensajes en Plan Free. Mejora a Premium para mensajes ilimitados.', 'warning');
            }
            return;
        }

        recordUserPhrase(text);

        chatInput.value = '';
        if (tokenIndicator) tokenIndicator.textContent = '0 / 500 tokens';

        brain.addMessage('user', text);
        const userDiv = createMessageElement(text, 'user');
        const targetList = document.getElementById('messagesList') || messagesArea;
        if (targetList) {
            targetList.appendChild(userDiv);
            if (messagesArea) messagesArea.scrollTop = messagesArea.scrollHeight;
        }

        const botDiv = createMessageElement('...', 'bot');
        const bubble = botDiv.querySelector('.msg-bubble');
        if (targetList) {
            targetList.appendChild(botDiv);
            if (messagesArea) messagesArea.scrollTop = messagesArea.scrollHeight;
        }

        try {
            let botText = '';
            const onChunk = (chunk) => {
                botText += chunk;
                if (bubble) bubble.innerHTML = botText.replace(/\*([^*]+)\*/g, '<span class="msg-actions">*$1*</span>');
                if (messagesArea) messagesArea.scrollTop = messagesArea.scrollHeight;
            };

            await brain.sendMessageToAI(text, onChunk);

            playPopSound();

            if ('speechSynthesis' in window && localStorage.getItem('lumaTTSEnabled') === 'true') {
                const cleanMsg = botText.replace(/<[^>]+>/g, '').replace(/\*([^*]+)\*/g, '');
                if (cleanMsg.trim()) {
                    window.speechSynthesis.cancel();
                    const utterance = new SpeechSynthesisUtterance(cleanMsg.trim());
                    utterance.lang = 'es-MX';
                    window.speechSynthesis.speak(utterance);
                }
            }

            const badgeInfo = getEmotionalBadge(brain);
            const affinityScore = document.getElementById('affinityScore');
            const emotionalDot = document.getElementById('chatEmotionalDot');

            if (affinityScore) affinityScore.textContent = `${brain.afinidad}%`;
            if (emotionalDot) {
                emotionalDot.style.background = badgeInfo.color;
                emotionalDot.style.boxShadow = `0 0 6px ${badgeInfo.color}`;
            }

            renderQuickStarters(currentCharacter.arquetipo_id);
            renderSidebarChatList(charactersData, activeCharId, selectCharacter, deleteCharacter);
        } catch (err) {
            if (bubble) bubble.textContent = 'Error al recibir respuesta del servidor.';
        }
    }

    function deleteCharacter(charId) {
        if (!charId) return;

        let customChars = JSON.parse(localStorage.getItem('lumaCustomCharacters') || '[]');
        const targetChar = customChars.find(c => c.id === charId || c.arquetipo_id === charId);

        if (!targetChar) {
            const confirmClear = window.confirm(`¿Estás seguro de borrar el historial de chat con esta IA?`);
            if (!confirmClear) return;

            localStorage.removeItem(`chatHistory_${charId}`);
            localStorage.removeItem(`chatConfig_${charId}`);
            if (brain) brain.history = [];
            const messagesArea = document.getElementById('messagesArea');
            if (messagesArea) messagesArea.innerHTML = '';
            if (showToast) showToast('Historial de chat limpiado correctamente.', 'success');
        } else {
            const confirmDelete = window.confirm(`¿Estás seguro de eliminar el personaje "${targetChar.name}" y toda su conversación?`);
            if (!confirmDelete) return;

            customChars = customChars.filter(c => c.id !== charId && c.arquetipo_id !== charId);
            localStorage.setItem('lumaCustomCharacters', JSON.stringify(customChars));
            localStorage.removeItem(`chatHistory_${charId}`);
            localStorage.removeItem(`chatConfig_${charId}`);

            if (showToast) showToast(`Personaje "${targetChar.name}" eliminado.`, 'success');
        }

        const updatedCustom = JSON.parse(localStorage.getItem('lumaCustomCharacters') || '[]');
        charactersData.custom = updatedCustom;
        const defaultChar = charactersData.official[0];
        selectCharacter(defaultChar);

        renderSidebarChatList(
            { official: charactersData.official, custom: updatedCustom },
            defaultChar.id,
            selectCharacter,
            deleteCharacter
        );
    }
}
