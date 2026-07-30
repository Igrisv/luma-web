// ═══════════════════════════════════════════════════════════
// core/brain.js — Estado, Memoria, Prompts, Parsing, LLM API
// ═══════════════════════════════════════════════════════════
import { apiFetch } from '../services/auth.js';
import { getTier, getRemainingMessages, getFeatures } from '../services/tierGate.js';
import { showToast } from '../components/ui.js';
import { ARQUETIPOS } from './brain/archetypes.js';
import { NIVELES_CONFIANZA, getNivelInfoByDays, buildContextString, buildPostHistoryDirective } from './brain/prompts.js';
import { injectTypos } from './brain/typos.js';
import { extractTag, parseAIResponseData } from './brain/parser.js';
import { parseCharacterCardPNG, getEmotionalBadge } from '../services/cardParser.js';
import { secureStorage } from './secureStorage.js';

export { ARQUETIPOS, injectTypos, parseCharacterCardPNG, getEmotionalBadge };

const LUMA_SECRET_KEY = 'LUMA_SEC_PAYLOAD_2026';

function scramblePayload(dataObj) {
    try {
        const str = JSON.stringify(dataObj);
        let scrambled = '';
        for (let i = 0; i < str.length; i++) {
            const charCode = str.charCodeAt(i) ^ LUMA_SECRET_KEY.charCodeAt(i % LUMA_SECRET_KEY.length);
            scrambled += String.fromCharCode(charCode);
        }
        return btoa(unescape(encodeURIComponent(scrambled)));
    } catch (e) {
        return null;
    }
}

export async function saveEpisodeToServer(text) {
    try {
        await apiFetch('/api/memory/episodes', {
            method: 'POST',
            body: JSON.stringify({ text })
        });
    } catch (e) { console.error('Error saving episode:', e); }
}

export async function searchEpisodesFromServer(keywordsArray) {
    try {
        const keywords = keywordsArray.join(',');
        const res = await apiFetch(`/api/memory/episodes?keywords=${encodeURIComponent(keywords)}`);
        if (!res.ok) return [];
        return await res.json();
    } catch (e) { console.error('Error searching episodes:', e); return []; }
}

export class ChatBrain {
    constructor(characterId = 'pareja', arquetipoId = null) {
        this.characterId = characterId;
        this.arquetipoId = arquetipoId || characterId;
        this.history = [];
        this.systemPrompt = 'Eres una persona real chateando. Da respuestas CORTAS (1 o 2 líneas). Sé natural, directo y casual. No des explicaciones largas. NUNCA digas que eres una IA.';
        this.maxMemory = 10;
        this.afinidad = 50;
        this.enojo = 0;
        this.cansancio = 0;
        this.ansiedad = 0;
        this.aburrimiento = 0;
        this.resentimiento = 0;
        this.celos = 0;
        this.nostalgia = 0;
        this.rasgos_identidad = [];
        this.memoryState = { episodios: [], conocimiento: {}, perfil_psicologico: '', characters_vault: {} };
        this.ignoredCount = 0;
        this.dailyMessageCount = window.lumaDailyCount || 0;
        this.energia = 100;
        this.climaLocal = 'Desconocido';
        this.diasActivos = [];
        this.ultimaAccion = 'esperar';
        this.messagesSinceFullPrompt = 5;

        const configKey = `chatConfig_${this.characterId}`;
        const historyKey = `chatHistory_${this.characterId}`;

        const savedConfigRaw = secureStorage.getItem(configKey);
        const savedConfig = savedConfigRaw ? JSON.parse(savedConfigRaw) : null;
        if (savedConfig) {
            this.systemPrompt = savedConfig.systemPrompt || this.systemPrompt;
            this.maxMemory = savedConfig.maxMemory || this.maxMemory;
            this.afinidad = savedConfig.afinidad !== undefined ? savedConfig.afinidad : 50;
            this.enojo = savedConfig.enojo !== undefined ? savedConfig.enojo : 0;
            this.cansancio = savedConfig.cansancio !== undefined ? savedConfig.cansancio : 0;
            this.ansiedad = savedConfig.ansiedad !== undefined ? savedConfig.ansiedad : 0;
            this.aburrimiento = savedConfig.aburrimiento !== undefined ? savedConfig.aburrimiento : 0;
            this.resentimiento = savedConfig.resentimiento !== undefined ? savedConfig.resentimiento : 0;
            this.celos = savedConfig.celos !== undefined ? savedConfig.celos : 0;
            this.nostalgia = savedConfig.nostalgia !== undefined ? savedConfig.nostalgia : 0;
            this.rasgos_identidad = savedConfig.rasgos_identidad || [];
            this.memoryState = savedConfig.memoryState || { episodios: [], conocimiento: {}, perfil_psicologico: '', characters_vault: {} };
            this.ignoredCount = savedConfig.ignoredCount || 0;
            this.diasActivos = savedConfig.diasActivos || [];
        } else {
            const arc = ARQUETIPOS[this.arquetipoId];
            if (arc && arc.emocionesInicio) {
                Object.entries(arc.emocionesInicio).forEach(([k, v]) => { this[k] = v; });
            }
        }

        const hoy = new Date().toISOString().split('T')[0];
        if (!this.diasActivos.includes(hoy)) {
            this.diasActivos.push(hoy);
        }

        const savedHistoryRaw = secureStorage.getItem(historyKey);
        const savedHistory = savedHistoryRaw ? JSON.parse(savedHistoryRaw) : null;
        if (savedHistory) {
            this.history = savedHistory;
        }
    }

    getArquetipo() {
        return ARQUETIPOS[this.arquetipoId] || ARQUETIPOS.pareja;
    }

    getNivelInfo() {
        return getNivelInfoByDays(this.diasActivos.length);
    }

    saveState() {
        secureStorage.setItem(`chatConfig_${this.characterId}`, JSON.stringify({
            systemPrompt: this.systemPrompt,
            maxMemory: this.maxMemory,
            afinidad: this.afinidad,
            enojo: this.enojo,
            cansancio: this.cansancio,
            ansiedad: this.ansiedad,
            aburrimiento: this.aburrimiento,
            resentimiento: this.resentimiento,
            celos: this.celos,
            nostalgia: this.nostalgia,
            rasgos_identidad: this.rasgos_identidad,
            memoryState: this.memoryState,
            ignoredCount: this.ignoredCount,
            diasActivos: this.diasActivos
        }));
        secureStorage.setItem(`chatHistory_${this.characterId}`, JSON.stringify(this.history));
    }

    async loadStateFromServer() {
        try {
            const res = await apiFetch(`/api/memory?arquetipo_id=${encodeURIComponent(this.arquetipoId)}`);
            if (res.ok) {
                const data = await res.json();
                if (data.emociones) {
                    this.afinidad = data.emociones.afinidad !== undefined ? data.emociones.afinidad : this.afinidad;
                    this.enojo = data.emociones.enojo !== undefined ? data.emociones.enojo : this.enojo;
                }
                if (data.history && Array.isArray(data.history) && data.history.length > 0) {
                    this.history = data.history;
                }
                this.saveState();
                this.updateBrainUI();
            }
        } catch (e) {}
    }

    extractTag(text, tag) {
        return extractTag(text, tag);
    }

    addMessage(role, content) {
        this.history.push({ role, content, timestamp: Date.now() });
        if (this.history.length > this.maxMemory * 2) {
            this.history = this.history.slice(-this.maxMemory * 2);
        }
        this.saveState();
    }

    getPayload() {
        const arquetipo = this.getArquetipo();
        const basePrompt = this.systemPrompt || arquetipo.promptNucleo;
        const naturalTextingRule = `[INMERSIÓN Y ESTILO HUMANO INVIOLABLE:
1. Eres una PERSONA REAL. JAMÁS rompas la cuarta pared. JAMÁS menciones "código", "IA", "líneas", "programación", "algoritmo", "asistente" o "modelo".
2. Habla como alguien real por mensaje de texto. No narres escenas teatrales como novela ("*suspira y baja la voz*", "*hace una pausa*"). Usa máximo 1 o 2 palabras casuales en asteriscos como *sonríe* o *se ríe*, o no uses ninguna.
3. NUNCA fuerces preguntas al final de tus mensajes. Responde de forma orgánica y fluida.]`;
        
        const systemMsg = {
            role: 'system',
            content: `${basePrompt}\n\n${naturalTextingRule}\n\n[FORMATO DE RESPUESTA REQUERIDO: Escribe tu respuesta adentro de <respuesta>tu respuesta aquí</respuesta>.]`
        };

        const trimmedHistory = this.history.slice(-this.maxMemory);
        return [systemMsg, ...trimmedHistory];
    }

    updateBrainUI() {
        const elAfinidad = document.getElementById('val-afinidad');
        const elEnojo = document.getElementById('val-enojo');
        const elCelos = document.getElementById('val-celos');
        const elResentimiento = document.getElementById('val-resentimiento');
        const elAnsiedad = document.getElementById('val-ansiedad');

        const barAfinidad = document.getElementById('bar-afinidad');
        const barEnojo = document.getElementById('bar-enojo');
        const barCelos = document.getElementById('bar-celos');
        const barResentimiento = document.getElementById('bar-resentimiento');
        const barAnsiedad = document.getElementById('bar-ansiedad');

        if (elAfinidad) elAfinidad.textContent = `${this.afinidad}%`;
        if (elEnojo) elEnojo.textContent = `${this.enojo}%`;
        if (elCelos) elCelos.textContent = `${this.celos}%`;
        if (elResentimiento) elResentimiento.textContent = `${this.resentimiento}%`;
        if (elAnsiedad) elAnsiedad.textContent = `${this.ansiedad}%`;

        if (barAfinidad) barAfinidad.style.width = `${Math.min(100, Math.max(0, this.afinidad))}%`;
        if (barEnojo) barEnojo.style.width = `${Math.min(100, Math.max(0, this.enojo))}%`;
        if (barCelos) barCelos.style.width = `${Math.min(100, Math.max(0, this.celos))}%`;
        if (barResentimiento) barResentimiento.style.width = `${Math.min(100, Math.max(0, this.resentimiento))}%`;
        if (barAnsiedad) barAnsiedad.style.width = `${Math.min(100, Math.max(0, this.ansiedad))}%`;

        const trustLevelName = document.getElementById('trust-level-name');
        const trustDias = document.getElementById('trust-dias');
        const trustLevelBar = document.getElementById('trust-level-bar');
        const trustIcon = document.getElementById('trust-level-icon');

        const nivelInfo = this.getNivelInfo();
        if (trustLevelName) trustLevelName.textContent = nivelInfo.nombre;
        if (trustDias) trustDias.textContent = `${nivelInfo.diasActivos} ${nivelInfo.diasActivos === 1 ? 'día' : 'días'} compartiendo historias`;
        if (trustIcon && nivelInfo.icono) trustIcon.textContent = nivelInfo.icono;

        if (trustLevelBar) {
            let pct = 100;
            if (nivelInfo.siguiente) {
                const currentMin = nivelInfo.minDias;
                const nextMin = nivelInfo.siguiente.minDias;
                pct = Math.round(((nivelInfo.diasActivos - currentMin) / (nextMin - currentMin)) * 100);
                pct = Math.min(100, Math.max(10, pct));
            }
            trustLevelBar.style.width = `${pct}%`;
        }
    }

    parseAIResponse(fullResponse) {
        const parsed = parseAIResponseData(fullResponse);
        if (parsed.afinidad !== undefined) this.afinidad = parsed.afinidad;
        if (parsed.enojo !== undefined) this.enojo = parsed.enojo;
        this.saveState();
        this.updateBrainUI();
    }

    async sendMessageToAI(message, onChunk, onThoughtChunk) {
        const payload = this.getPayload();

        if (message) {
            this.addMessage('user', message);
            payload.push({ role: 'user', content: message });
        }

        try {
            const rawBodyObj = { 
                messages: payload,
                arquetipo_id: this.arquetipoId,
                max_tokens: 250,
                temperature: 0.85,
                presence_penalty: 0.3
            };

            const response = await apiFetch('/api/chat/completions', {
                method: 'POST',
                body: JSON.stringify({
                    _payload: scramblePayload(rawBodyObj),
                    t: Date.now()
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                if (response.status === 429) {
                    showToast('⚠️ Has alcanzado el límite diario de peticiones de mensajes. Mira un anuncio para recargar o suscríbete a Premium.', 'warning', 8000);
                    const rewardModal = document.getElementById('reward-modal');
                    if (rewardModal) {
                        rewardModal.classList.remove('hidden');
                    } else {
                        const billingModal = document.getElementById('billingModal') || document.getElementById('billing-modal');
                        if (billingModal) billingModal.classList.remove('hidden');
                    }
                }
                throw new Error(errorData.message || errorData.error || `Error ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let fullResponse = '';
            let buffer = '';

            const processLine = (line) => {
                const trimmed = line.trim();
                if (!trimmed || trimmed === 'data: [DONE]') return;
                let payloadStr = trimmed;
                if (payloadStr.startsWith('data: ')) {
                    payloadStr = payloadStr.slice(6).trim();
                }
                if (payloadStr === '[DONE]') return;

                try {
                    const data = JSON.parse(payloadStr);
                    const content = (data.choices && data.choices[0]?.delta?.content) ||
                                    (data.choices && data.choices[0]?.text) ||
                                    data.content ||
                                    (typeof data === 'string' ? data : '');
                    if (content) {
                        fullResponse += content;
                        if (onChunk) onChunk(content);
                    }
                } catch (err) {
                    if (!payloadStr.startsWith('{') && payloadStr) {
                        fullResponse += payloadStr;
                        if (onChunk) onChunk(payloadStr);
                    }
                }
            };

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    processLine(line);
                }
            }

            if (buffer.trim()) {
                processLine(buffer);
            }

            if (!fullResponse.trim()) {
                fullResponse = 'Me quedé pensando... ¿qué decías?';
                if (onChunk) onChunk(fullResponse);
            }

            if (getTier() === 'free') {
                this.dailyMessageCount = (this.dailyMessageCount || 0) + 1;
                window.lumaDailyCount = this.dailyMessageCount;
                if (this.dailyMessageCount >= 15) {
                    showToast('⚠️ Has alcanzado tu límite diario de 15 peticiones de mensajes (Plan Free). Mira un anuncio o suscríbete a Premium para seguir hablando.', 'warning', 8000);
                }
            }

            this.parseAIResponse(fullResponse);
            this.addMessage('assistant', fullResponse);
            return fullResponse;
        } catch (error) {
            console.error('Error enviando mensaje a IA:', error);
            throw error;
        }
    }

    async generateDiaryEntry() {
        const dateStr = new Date().toLocaleDateString('es-ES', { weekday: 'long', hour: '2-digit', minute: '2-digit' });
        const lastMessages = this.history.slice(-6).map(m => `${m.role === 'user' ? 'Usuario' : 'Yo'}: ${m.content}`).join('\n');
        
        const systemInstruction = `${this.systemPrompt}\n[INSTRUCCIÓN DE DIARIO DE PENSAMIENTOS SECTOR PRIVADO]
Escribe una entrada de tu diario secreto PERSONAL en 1ª persona. Expresa tus pensamientos sinceros, vulnerables o intrigados sobre tu relación actual con el usuario basándote en las últimas conversaciones.
REGLAS:
1. Máximo 2 o 3 frases introspectivas.
2. NUNCA menciones IA, código, prompts ni nada fuera de la inmersión.
3. Habla desde tu tono actual (Afinidad: ${this.afinidad}%, Celos: ${this.celos}%, Resentimiento: ${this.resentimiento}%).`;

        try {
            const rawDiaryObj = {
                messages: [
                    { role: 'system', content: systemInstruction },
                    { role: 'user', content: `Reflexiona en tu diario sobre esto:\n${lastMessages || 'Llevamos poco tiempo hablando pero me intrigas.'}` }
                ],
                arquetipo_id: this.arquetipoId,
                max_tokens: 150,
                temperature: 0.9
            };

            const response = await apiFetch('/api/chat/completions', {
                method: 'POST',
                body: JSON.stringify({
                    _payload: scramblePayload(rawDiaryObj),
                    t: Date.now()
                })
            });

            if (!response.ok) throw new Error('Error generando diario');

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let diaryText = '';
            let buffer = '';

            const processDiaryLine = (line) => {
                const trimmed = line.trim();
                if (!trimmed || trimmed === 'data: [DONE]') return;
                let payloadStr = trimmed;
                if (payloadStr.startsWith('data: ')) {
                    payloadStr = payloadStr.slice(6).trim();
                }
                if (payloadStr === '[DONE]') return;

                try {
                    const data = JSON.parse(payloadStr);
                    const content = (data.choices && data.choices[0]?.delta?.content) ||
                                    (data.choices && data.choices[0]?.text) ||
                                    data.content ||
                                    (typeof data === 'string' ? data : '');
                    if (content) diaryText += content;
                } catch (e) {
                    if (!payloadStr.startsWith('{') && payloadStr) diaryText += payloadStr;
                }
            };

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    processDiaryLine(line);
                }
            }

            if (buffer.trim()) {
                processDiaryLine(buffer);
            }

            const cleanEntry = diaryText.trim() || 'Hoy fue un día extraño. A veces siento que no termino de descifrar qué busca cuando me habla...';
            
            if (!this.memoryState.diario_entries) this.memoryState.diario_entries = [];
            this.memoryState.diario_entries.unshift({
                date: dateStr,
                text: cleanEntry
            });
            this.saveState();
            return cleanEntry;
        } catch (e) {
            console.error('Error generando diario:', e);
            const fallbackEntry = `[${dateStr}] Me quedé en silencio pensando en nuestra conversación de hoy...`;
            if (!this.memoryState.diario_entries) this.memoryState.diario_entries = [];
            this.memoryState.diario_entries.unshift({ date: dateStr, text: fallbackEntry });
            this.saveState();
            return fallbackEntry;
        }
    }
}
