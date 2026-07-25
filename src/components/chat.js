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
import { getTier, canUseArchetype } from '../services/tierGate.js';

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
                system_prompt: 'Eres Sofía, su pareja cariñosa. Tienes química real y afecto genuino, pero también ego y personalidad propia.',
                is_official: true
            },
            {
                id: 'rival',
                arquetipo_id: 'rival',
                name: 'Elena',
                tagline: 'Tu Competitiva Rival',
                description: 'Inteligente, mordaz y sarcástica. Odia perder y jamás admitirá que te extraña.',
                avatar_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500&auto=format&fit=crop&q=80',
                first_message: 'Vaya... Mira quién se digna a aparecer. No creas que ganaste nuestra última discusión.',
                system_prompt: 'Eres Elena, su rival de infancia tsundere. Competidora feroz con orgullo gigante.',
                is_official: true
            },
            {
                id: 'amigaToxica',
                arquetipo_id: 'amigaToxica',
                name: 'Clara',
                tagline: 'Tu Amiga Tóxica',
                description: 'Sarcástica, provocadora y directa. Se burla de ti pero te cuida a su manera.',
                avatar_url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=500&auto=format&fit=crop&q=80',
                first_message: '¿Por qué me ignoras? 😂 En fin, adivina el drama que me acaba de pasar...',
                system_prompt: 'Eres Clara, su amiga tóxica, picante y sarcástica.',
                is_official: true
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

    let activeCharId = localStorage.getItem('lumaActiveCharacter') || 'pareja';
    let allChars = [...charactersData.official, ...charactersData.custom];
    let currentCharacter = allChars.find(c => c.id === activeCharId || c.arquetipo_id === activeCharId) || charactersData.official[0];

    let brain = new ChatBrain(currentCharacter.id, currentCharacter.arquetipo_id);

    const starterPromptsMap = {
        pareja: ["💕 ¿Qué tal tu día, mi amor?", "✨ Cuéntame algo lindo sobre ti", "🍽️ ¿Qué cenamos hoy?", "🩷 ¿Cómo te sientes ahora mismo?"],
        rival: ["⚡ Apuesto a que no puedes ganarme hoy", "😏 ¿Sigues pensando en nuestra discusión?", "🔥 Cuéntame tu mayor secreto"],
        amigaToxica: ["😈 ¿Qué drama me vas a contar hoy?", "😂 No me digas que sigues triste...", "☕ ¡Cuéntame el chisme completo!"],
        ex: ["🌧️ ¿Aún guardas recuerdos míos?", "💔 ¿Alguna vez piensas en lo que tuvimos?", "🍷 ¿Cómo has estado últimamente?"],
        mejorAmigo: ["🤝 ¿Qué hay de nuevo hoy, amigo?", "🎮 ¿Jugamos o charlamos un rato?", "🍿 Cuéntame tu mejor historia"]
    };

    function renderQuickStarters(archetypeId) {
        const startersContainer = document.getElementById('quickStartersContainer');
        if (!startersContainer) return;

        const prompts = starterPromptsMap[archetypeId] || starterPromptsMap.pareja;
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

    function selectCharacter(char) {
        const currentTier = getTier();
        const isLockedByTier = (char.tier_required === 'premium' && currentTier === 'free') ||
                               (char.tier_required === 'obsesion' && currentTier !== 'obsesion') ||
                               (!canUseArchetype(char.arquetipo_id) && currentTier === 'free');

        if (isLockedByTier) {
            const billingModal = document.getElementById('billingModal') || document.getElementById('billing-modal');
            if (billingModal) billingModal.classList.remove('hidden');
            showToast(`El personaje "${char.name}" requiere Plan Premium. Mejora tu plan para chatear.`, 'warning');
            return;
        }

        currentCharacter = char;
        activeCharId = char.id || char.arquetipo_id;
        localStorage.setItem('lumaActiveCharacter', activeCharId);

        brain = new ChatBrain(char.id, char.arquetipo_id);
        if (char.system_prompt) brain.systemPrompt = char.system_prompt;

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
            pareja: '💕 Pareja Cariñosa',
            rival: '⚔️ Rival Competitiva',
            amigaToxica: '😈 Amiga Tóxica',
            ex: '🌧️ Ex que No Supera',
            mejorAmigo: '🤝 Mejor Amigo/a'
        };
        if (heroArchetype) heroArchetype.textContent = archetypeNames[char.arquetipo_id] || '🎭 Acompañante';
        if (heroAffinity) heroAffinity.textContent = `💚 ${brain.afinidad}% Afinidad`;

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
        renderSidebarChatList(charactersData, activeCharId, selectCharacter);
        switchView('chat');
    }

    renderGallery(charactersData, 'all', '', selectCharacter);
    renderSidebarChatList(charactersData, activeCharId, selectCharacter);

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

    if (tierBadge && billingModal) tierBadge.addEventListener('click', () => billingModal.classList.remove('hidden'));
    if (closeBillingModal && billingModal) closeBillingModal.addEventListener('click', () => billingModal.classList.add('hidden'));

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

            renderSidebarChatList(charactersData, activeCharId, selectCharacter);
        } catch (err) {
            if (bubble) bubble.textContent = 'Error al recibir respuesta del servidor.';
        }
    }
}
