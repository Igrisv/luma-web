// ═══════════════════════════════════════════════════════════
// brain.js — Estado, Memoria, Prompts, Parsing, API
// ═══════════════════════════════════════════════════════════
import { apiFetch } from './auth.js';
import { getRemainingMessages, getFeatures } from './tierGate.js';
import { ARQUETIPOS } from './brain/archetypes.js';
import { NIVELES_CONFIANZA, getNivelInfoByDays, buildContextString } from './brain/prompts.js';
import { injectTypos } from './brain/typos.js';
import { extractTag, parseAIResponseData } from './brain/parser.js';

export { ARQUETIPOS, injectTypos };

// ── Helpers de episodios ────────────────────────────────────
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


// ═══════════════════════════════════════════════════════════
// ChatBrain — Clase principal de estado y lógica IA
// ═══════════════════════════════════════════════════════════
export class ChatBrain {
    constructor(characterId = 'pareja') {
        this.arquetipoId = characterId;
        this.history = [];
        this.systemPrompt = 'Eres una persona real chateando. Da respuestas MUY CORTAS (1 o 2 líneas máximo). Sé natural, directo y casual. No des explicaciones largas ni cuentes toda tu vida a menos que te pregunten. Habla como alguien en un chat rápido de WhatsApp. Cero formalidad. NUNCA digas que eres una IA.';
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
        this.fetchClimaLocal();

        const configKey = `chatConfig_${this.arquetipoId}`;
        const historyKey = `chatHistory_${this.arquetipoId}`;

        // ── Legacy migration: move old flat keys to character-scoped keys ──
        const legacyConfig = localStorage.getItem('chatConfig');
        if (legacyConfig && !localStorage.getItem(configKey)) {
            // First run after multi-character refactor — migrate old data
            const parsed = JSON.parse(legacyConfig);
            const legacyId = parsed.arquetipoId || 'pareja';
            localStorage.setItem(`chatConfig_${legacyId}`, legacyConfig);
            localStorage.setItem('lumaActiveCharacter', legacyId);
            localStorage.removeItem('chatConfig');
            if (legacyId !== this.arquetipoId) {
                this.arquetipoId = legacyId;
            }
        }
        const legacyHistory = localStorage.getItem('chatHistory');
        if (legacyHistory && !localStorage.getItem(historyKey)) {
            localStorage.setItem(`chatHistory_${this.arquetipoId}`, legacyHistory);
            localStorage.removeItem('chatHistory');
        }

        const savedConfig = JSON.parse(localStorage.getItem(`chatConfig_${this.arquetipoId}`));
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

        const savedHistory = JSON.parse(localStorage.getItem(historyKey));
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

    fetchClimaLocal() {
        const cached = localStorage.getItem('lumaClimaCache');
        if (cached) {
            try {
                const { clima, timestamp } = JSON.parse(cached);
                if (Date.now() - timestamp < 3600000) { // 1 hora TTL
                    this.climaLocal = clima;
                    return;
                }
            } catch (e) {}
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        fetch('https://ipwho.is/', { signal: controller.signal })
            .then(r => r.json())
            .then(d => {
                if (!d.success) return;
                fetch(`https://api.open-meteo.com/v1/forecast?latitude=${d.latitude}&longitude=${d.longitude}&current_weather=true`, { signal: controller.signal })
                    .then(r => r.json())
                    .then(w => {
                        this.climaLocal = `Temperatura: ${w.current_weather.temperature}°C, Ciudad: ${d.city}`;
                        localStorage.setItem('lumaClimaCache', JSON.stringify({ clima: this.climaLocal, timestamp: Date.now() }));
                    }).catch(() => {});
            })
            .catch(() => {})
            .finally(() => clearTimeout(timeout));
    }

    saveState() {
        localStorage.setItem(`chatConfig_${this.arquetipoId}`, JSON.stringify({
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
            arquetipoId: this.arquetipoId,
            diasActivos: this.diasActivos,
        }));
        // Debounce server writes — at most once every 5 seconds
        if (this._saveTimer) clearTimeout(this._saveTimer);
        this._saveTimer = setTimeout(() => this.saveStateToServer(), 5000);
    }

    async saveStateToServer() {
        try {
            await apiFetch('/api/memory', {
                method: 'POST',
                body: JSON.stringify({
                    afinidad: this.afinidad,
                    enojo: this.enojo,
                    cansancio: this.cansancio,
                    ansiedad: this.ansiedad,
                    aburrimiento: this.aburrimiento,
                    resentimiento: this.resentimiento,
                    celos: this.celos,
                    nostalgia: this.nostalgia,
                    rasgos_identidad: this.rasgos_identidad,
                    memory_state: this.memoryState,
                    ignored_count: this.ignoredCount,
                    arquetipo_id: this.arquetipoId,
                    dias_activos: this.diasActivos
                    // chat_history excluded — stored in localStorage only
                })
            });
        } catch (e) {
            console.error('Error saving state to server:', e);
        }
    }

    async loadStateFromServer() {
        try {
            const res = await apiFetch('/api/memory');
            if (!res.ok) return;
            const data = await res.json();
            
            // Initialize vault if missing
            if (!data.memory_state) data.memory_state = {};
            if (!data.memory_state.characters_vault) data.memory_state.characters_vault = {};
            
            if (!data.arquetipo_id || data.arquetipo_id === this.arquetipoId) {
                // DB matches current character (or no row yet — treat as matching)
                if (data.afinidad !== undefined) this.afinidad = data.afinidad;
                if (data.enojo !== undefined) this.enojo = data.enojo;
                if (data.cansancio !== undefined) this.cansancio = data.cansancio;
                if (data.ansiedad !== undefined) this.ansiedad = data.ansiedad;
                if (data.aburrimiento !== undefined) this.aburrimiento = data.aburrimiento;
                if (data.resentimiento !== undefined) this.resentimiento = data.resentimiento;
                if (data.celos !== undefined) this.celos = data.celos;
                if (data.nostalgia !== undefined) this.nostalgia = data.nostalgia;
                if (data.rasgos_identidad) this.rasgos_identidad = data.rasgos_identidad;
                if (data.memory_state) this.memoryState = data.memory_state;
                if (data.ignored_count !== undefined) this.ignoredCount = data.ignored_count;
                if (data.dias_activos) this.diasActivos = data.dias_activos;
                // chat_history comes from localStorage, but we can fallback to data if needed
            } else {
                // DB has another character. Save that character to the vault.
                const dbCharacterId = data.arquetipo_id || 'pareja';
                data.memory_state.characters_vault[dbCharacterId] = {
                    afinidad: data.afinidad,
                    enojo: data.enojo,
                    cansancio: data.cansancio,
                    ansiedad: data.ansiedad,
                    aburrimiento: data.aburrimiento,
                    resentimiento: data.resentimiento,
                    celos: data.celos,
                    nostalgia: data.nostalgia,
                    rasgos_identidad: data.rasgos_identidad,
                    memory_state: {
                        episodios: data.memory_state.episodios || [],
                        conocimiento: data.memory_state.conocimiento || {},
                        perfil_psicologico: data.memory_state.perfil_psicologico || ''
                    },
                    ignored_count: data.ignored_count,
                    dias_activos: data.dias_activos
                };
                
                // Now load the requested character from the vault if it exists
                const vaultData = data.memory_state.characters_vault[this.arquetipoId];
                if (vaultData) {
                    if (vaultData.afinidad !== undefined) this.afinidad = vaultData.afinidad;
                    if (vaultData.enojo !== undefined) this.enojo = vaultData.enojo;
                    if (vaultData.cansancio !== undefined) this.cansancio = vaultData.cansancio;
                    if (vaultData.ansiedad !== undefined) this.ansiedad = vaultData.ansiedad;
                    if (vaultData.aburrimiento !== undefined) this.aburrimiento = vaultData.aburrimiento;
                    if (vaultData.resentimiento !== undefined) this.resentimiento = vaultData.resentimiento;
                    if (vaultData.celos !== undefined) this.celos = vaultData.celos;
                    if (vaultData.nostalgia !== undefined) this.nostalgia = vaultData.nostalgia;
                    if (vaultData.rasgos_identidad) this.rasgos_identidad = vaultData.rasgos_identidad;
                    if (vaultData.memory_state) this.memoryState = vaultData.memory_state;
                    if (vaultData.ignored_count !== undefined) this.ignoredCount = vaultData.ignored_count;
                    if (vaultData.dias_activos) this.diasActivos = vaultData.dias_activos;
                } else {
                    // First time using this character, use defaults
                    const arc = ARQUETIPOS[this.arquetipoId];
                    if (arc && arc.emocionesInicio) {
                        Object.entries(arc.emocionesInicio).forEach(([k, v]) => { this[k] = v; });
                    }
                }
                
                // Ensure the vault is kept
                this.memoryState.characters_vault = data.memory_state.characters_vault;
                
                // Trigger a save to immediately swap the active character on the server
                this.saveState();
            }
            this.updateBrainUI();
        } catch (e) {
            console.error('Error loading state from server:', e);
        }
    }

    clearMemory() {
        this.history = [];
        // Preserve the characters_vault so other characters' data is not lost
        this.memoryState = { episodios: [], conocimiento: {}, perfil_psicologico: '', characters_vault: this.memoryState.characters_vault || {} };
        this.ignoredCount = 0;
        this.afinidad = 50;
        this.enojo = 0;
        this.cansancio = 0;
        this.ansiedad = 0;
        this.aburrimiento = 0;
        this.resentimiento = 0;
        this.celos = 0;
        this.nostalgia = 0;
        this.rasgos_identidad = [];
        this.diasActivos = [new Date().toISOString().split('T')[0]];
        this.saveState();
        localStorage.removeItem(`chatHistory_${this.arquetipoId}`);
        // We use saveState() instead of DELETE /api/memory because DELETE would also erase
        // other characters' vault data stored in the same row.
    }

    updateConfig(prompt, memory) {
        this.systemPrompt = prompt;
        this.maxMemory = memory;
        this.saveState();
        if (window.logInspector) window.logInspector('CONFIG', 'Configuración actualizada');
    }

    addMessage(role, content) {
        this.history.push({ role, content });
        if (this.history.length > this.maxMemory) {
            this.history.shift();
        }
        localStorage.setItem(`chatHistory_${this.arquetipoId}`, JSON.stringify(this.history));
    }

    getPayload() {
        const time = new Date().toLocaleTimeString();
        const hour = new Date().getHours();

        if (hour >= 1 && hour <= 6) this.energia = 10;
        else if (hour > 6 && hour <= 10) this.energia = 60;
        else if (hour > 22) this.energia = 30;
        else this.energia = 100;

        const arquetipo = this.getArquetipo();
        const nivelInfo = this.getNivelInfo();

        const conocimientoUsuario = Object.keys(this.memoryState.conocimiento || {}).length > 0
            ? `Lo que sabes del usuario: ${JSON.stringify(this.memoryState.conocimiento)}. `
            : '';

        const evolucionEl = document.getElementById('evolucion-checkbox');
        const evolucionActiva = evolucionEl && evolucionEl.checked;

        const contextStr = buildContextString({
            climaLocal: this.climaLocal,
            afinidad: this.afinidad,
            enojo: this.enojo,
            cansancio: this.cansancio,
            ansiedad: this.ansiedad,
            aburrimiento: this.aburrimiento,
            resentimiento: this.resentimiento,
            celos: this.celos,
            nostalgia: this.nostalgia,
            conocimiento: this.memoryState.conocimiento,
            ignoredCount: this.ignoredCount,
            arquetipo,
            nivelInfo,
            evolucionActiva,
            rasgos_identidad: this.rasgos_identidad
        });

        const features = getFeatures();
        const effectiveHistory = (features.maxMessagesPerDay !== Infinity) ? this.history.slice(-4) : this.history;

        const rawPayload = [
            { role: 'system', content: this.systemPrompt + '\n' + contextStr },
            ...effectiveHistory
        ];

        // Fusionar roles consecutivos (algunos modelos fallan si hay varios 'user' seguidos)
        const mergedPayload = [];
        for (const msg of rawPayload) {
            if (mergedPayload.length > 0 && mergedPayload[mergedPayload.length - 1].role === msg.role) {
                mergedPayload[mergedPayload.length - 1].content += '\n\n' + msg.content;
            } else {
                mergedPayload.push({ ...msg });
            }
        }
        return mergedPayload;
    }

    extractTag(text, tag) {
        return extractTag(text, tag);
    }

    updateBrainUI() {
        const diagEl = document.getElementById('mood-diagnosis');
        if (diagEl) {
            let diag = 'Estado: Neutral y Receptiva';
            let color = '#10b981';
            if (this.enojo > 70) { diag = 'Estado: Furiosa y a la defensiva'; color = '#ef4444'; }
            else if (this.resentimiento > 70) { diag = 'Estado: Resentida y pasivo-agresiva'; color = '#991b1b'; }
            else if (this.aburrimiento > 70) { diag = 'Estado: Extremadamente apática y aburrida'; color = '#94a3b8'; }
            else if (this.ansiedad > 70) { diag = 'Estado: Muy ansiosa, necesita validación'; color = '#fbbf24'; }
            else if (this.celos > 70) { diag = 'Estado: Celosa e insegura'; color = '#166534'; }
            else if (this.cansancio > 80) { diag = 'Estado: Exhausta, poca energía para hablar'; color = '#3b82f6'; }
            else if (this.nostalgia > 70) { diag = 'Estado: Melancólica y reflexiva'; color = '#6366f1'; }
            else if (this.afinidad > 80) { diag = 'Estado: Muy cariñosa y conectada'; color = '#ec4899'; }
            else if (this.afinidad < 20) { diag = 'Estado: Fría y distante'; color = '#64748b'; }
            diagEl.textContent = diag;
            diagEl.style.color = color;
            diagEl.style.border = `1px solid ${color}40`;
        }

        const bars = [
            ['val-afinidad', 'bar-afinidad', this.afinidad],
            ['val-enojo', 'bar-enojo', this.enojo],
            ['val-cansancio', 'bar-cansancio', this.cansancio],
            ['val-ansiedad', 'bar-ansiedad', this.ansiedad],
            ['val-aburrimiento', 'bar-aburrimiento', this.aburrimiento],
            ['val-resentimiento', 'bar-resentimiento', this.resentimiento],
            ['val-celos', 'bar-celos', this.celos],
            ['val-nostalgia', 'bar-nostalgia', this.nostalgia],
        ];
        for (const [valId, barId, val] of bars) {
            const el = document.getElementById(valId);
            const bar = document.getElementById(barId);
            if (el) { el.textContent = val; bar.style.width = val + '%'; }
        }

        const memoryList = document.getElementById('memory-json-view');
        if (memoryList) memoryList.textContent = JSON.stringify(this.memoryState, null, 2);

        const traitsList = document.getElementById('traits-list');
        if (traitsList) {
            traitsList.innerHTML = this.rasgos_identidad && this.rasgos_identidad.length > 0
                ? this.rasgos_identidad.map(t => `<li>${t}</li>`).join('')
                : '<li>Sin gustos adquiridos aún.</li>';
        }

        const nivelInfo = this.getNivelInfo();
        const nivelEl = document.getElementById('trust-level-name');
        const nivelIcoEl = document.getElementById('trust-level-icon');
        const nivelBarEl = document.getElementById('trust-level-bar');
        const nivelDiasEl = document.getElementById('trust-dias');
        if (nivelEl) nivelEl.textContent = nivelInfo.nombre;
        if (nivelIcoEl) nivelIcoEl.textContent = nivelInfo.icono;
        if (nivelDiasEl) nivelDiasEl.textContent = `${nivelInfo.diasActivos} día${nivelInfo.diasActivos !== 1 ? 's' : ''} juntos`;
        if (nivelBarEl) {
            const nextMin = nivelInfo.siguiente ? nivelInfo.siguiente.minDias : nivelInfo.minDias;
            const pct = nivelInfo.siguiente
                ? Math.min(100, ((nivelInfo.diasActivos - nivelInfo.minDias) / (nextMin - nivelInfo.minDias)) * 100)
                : 100;
            nivelBarEl.style.width = pct + '%';
        }

        const arquetipoEl = document.getElementById('arquetipo-name');
        const arquetipoEmoji = document.getElementById('arquetipo-emoji');
        if (arquetipoEl) arquetipoEl.textContent = this.getArquetipo().nombre;
        if (arquetipoEmoji) arquetipoEmoji.textContent = this.getArquetipo().emoji;

        const baseTraitsList = document.getElementById('base-traits-list');
        if (baseTraitsList) {
            baseTraitsList.innerHTML = this.getArquetipo().rasgosBase.map(t => `<li>${t}</li>`).join('');
        }

        const perfilEl = document.getElementById('user-profile-list');
        if (perfilEl) {
            const conocimiento = this.memoryState.conocimiento || {};
            const keys = Object.keys(conocimiento);
            perfilEl.innerHTML = keys.length > 0
                ? keys.map(k => `<li><strong>${k}:</strong> ${conocimiento[k]}</li>`).join('')
                : '<li>Aún no sabe nada de ti. Habla con ella.</li>';
        }

        const perfilPsiEl = document.getElementById('user-profile-psico');
        if (perfilPsiEl && this.memoryState.perfil_psicologico) {
            perfilPsiEl.textContent = `"${this.memoryState.perfil_psicologico}"`;
        }

        const counterEl = document.getElementById('msg-counter');
        if (counterEl) {
            const features = getFeatures();
            if (features.maxMessagesPerDay === Infinity) {
                counterEl.classList.add('hidden');
            } else {
                counterEl.classList.remove('hidden');
                const remaining = getRemainingMessages(this.dailyMessageCount);
                counterEl.textContent = `${remaining}/${features.maxMessagesPerDay}`;
            }
        }
    }

    parseAIResponse(fullResponse) {
        const estadoStr = this.extractTag(fullResponse, 'estado');
        if (estadoStr) {
            const afMatch = estadoStr.match(/afinidad=(\d+)/i);
            const enMatch = estadoStr.match(/enojo=(\d+)/i);
            const caMatch = estadoStr.match(/cansancio=(\d+)/i);
            const anMatch = estadoStr.match(/ansiedad=(\d+)/i);
            const abMatch = estadoStr.match(/aburrimiento=(\d+)/i);
            const reMatch = estadoStr.match(/resentimiento=(\d+)/i);
            const ceMatch = estadoStr.match(/celos=(\d+)/i);
            const noMatch = estadoStr.match(/nostalgia=(\d+)/i);
            if (afMatch) this.afinidad = Math.min(100, Math.max(0, parseInt(afMatch[1])));
            if (enMatch) this.enojo = Math.min(100, Math.max(0, parseInt(enMatch[1])));
            if (caMatch) this.cansancio = Math.min(100, Math.max(0, parseInt(caMatch[1])));
            if (anMatch) this.ansiedad = Math.min(100, Math.max(0, parseInt(anMatch[1])));
            if (abMatch) this.aburrimiento = Math.min(100, Math.max(0, parseInt(abMatch[1])));
            if (reMatch) this.resentimiento = Math.min(100, Math.max(0, parseInt(reMatch[1])));
            if (ceMatch) this.celos = Math.min(100, Math.max(0, parseInt(ceMatch[1])));
            if (noMatch) this.nostalgia = Math.min(100, Math.max(0, parseInt(noMatch[1])));
        }

        // Incremental memory: <aprender> merges, <olvidar> removes keys
        const aprenderStr = this.extractTag(fullResponse, 'aprender');
        if (aprenderStr) {
            try {
                const jsonMatch = aprenderStr.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const newData = JSON.parse(jsonMatch[0]);
                    if (typeof newData === 'object') {
                        this.memoryState.conocimiento = { ...this.memoryState.conocimiento, ...newData };
                    }
                }
            } catch (e) { console.error('Error parseando aprender', e); }
        }

        const olvidarStr = this.extractTag(fullResponse, 'olvidar');
        if (olvidarStr) {
            const key = olvidarStr.trim();
            if (key && this.memoryState.conocimiento) delete this.memoryState.conocimiento[key];
        }

        // Legacy fallback
        const memoriaStr = this.extractTag(fullResponse, 'memoria_json');
        if (memoriaStr) {
            try {
                const jsonMatch = memoriaStr.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    if (parsed.conocimiento) {
                        this.memoryState.conocimiento = { ...this.memoryState.conocimiento, ...parsed.conocimiento };
                    }
                    if (parsed.perfil_psicologico) {
                        this.memoryState.perfil_psicologico = parsed.perfil_psicologico;
                    }
                }
            } catch (e) { console.error('Error parseando memoria_json', e); }
        }

        const rasgoStr = this.extractTag(fullResponse, 'rasgo_nuevo');
        if (rasgoStr) {
            this.rasgos_identidad.push(rasgoStr);
            window.logInspector('MUTACIÓN DE PERSONALIDAD', rasgoStr);
        }

        const diarioStr = this.extractTag(fullResponse, 'diario');
        if (diarioStr && diarioStr.trim().length > 5) {
            if (!this.memoryState.diario_entries) this.memoryState.diario_entries = [];
            const exists = this.memoryState.diario_entries.some(e => e.text === diarioStr.trim());
            if (!exists) {
                this.memoryState.diario_entries.unshift({
                    id: Date.now().toString(),
                    date: new Date().toLocaleDateString(),
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    text: diarioStr.trim(),
                    unlocked: false
                });
                if (this.memoryState.diario_entries.length > 15) this.memoryState.diario_entries.pop();
                window.logInspector('DIARIO SECRETO', 'Nueva confesión íntima añadida al diario.');
            }
        }

        this.ultimaAccion = this.extractTag(fullResponse, 'accion') || 'esperar';
        this.saveState();
        this.updateBrainUI();
    }

    async sendMessageToAI(message, onChunk, onThoughtChunk, isHidden = false, retryCount = 0, isInternal = false) {
        const payload = this.getPayload();
        this.addMessage('user', message);
        payload.push({ role: 'user', content: message });

        if (retryCount === 0) window.logInspector('PAYLOAD ENVIADO', payload);

        let timeout;
        try {
            const controller = new AbortController();
            timeout = setTimeout(() => controller.abort(), 120000);

            const response = await apiFetch('/api/chat/completions', {
                method: 'POST',
                body: JSON.stringify({ 
                    messages: payload, 
                    isRetry: retryCount > 0, 
                    isInternal: isInternal,
                    arquetipo_id: this.arquetipoId
                }),
                signal: controller.signal
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                if (response.status === 429) {
                    if (errorData.isInternal) throw new Error('INTERNAL_LIMIT_REACHED');
                    else if (errorData.upgrade) {
                        const billingModal = document.getElementById('billing-modal');
                        if (billingModal) billingModal.classList.remove('hidden');
                        throw new Error('USER_LIMIT_REACHED');
                    }
                }
                throw new Error(errorData.detalle || errorData.error || `Error ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let fullResponse = '';
            let extractedLength = 0;
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.trim() === '' || line.trim() === 'data: [DONE]') continue;
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (data.error) {
                                throw new Error(data.error.message || JSON.stringify(data.error));
                            }
                            const content = data.choices && data.choices[0]?.delta?.content;
                            if (content) {
                                fullResponse += content;

                                const startPensamiento = fullResponse.indexOf('<pensamiento>');
                                if (startPensamiento !== -1 && onThoughtChunk) {
                                    let rawThought = fullResponse.substring(startPensamiento + 13);
                                    let safeThought = rawThought;
                                    const endP = fullResponse.indexOf('</pensamiento>');
                                    if (endP !== -1) {
                                        safeThought = fullResponse.substring(startPensamiento + 13, endP);
                                    } else {
                                        const tagP = '</pensamiento>';
                                        for (let i = 1; i <= tagP.length; i++) {
                                            if (rawThought.endsWith(tagP.substring(0, i))) {
                                                safeThought = rawThought.substring(0, rawThought.length - i);
                                                break;
                                            }
                                        }
                                    }
                                    onThoughtChunk(safeThought);
                                }

                                const startIndex = fullResponse.indexOf('<respuesta>');
                                if (startIndex !== -1) {
                                    let rawContent = fullResponse.substring(startIndex + 11);
                                    let safeContent = rawContent;
                                    const tag = '</respuesta>';
                                    for (let i = 1; i <= tag.length; i++) {
                                        if (rawContent.endsWith(tag.substring(0, i))) {
                                            safeContent = rawContent.substring(0, rawContent.length - i);
                                            break;
                                        }
                                    }
                                    const newChars = safeContent.substring(extractedLength);
                                    if (newChars.length > 0) {
                                        if (onChunk) onChunk(newChars);
                                        extractedLength += newChars.length;
                                    }
                                }
                            }
                        } catch (err) {}
                    }
                }
            }

            if (retryCount === 0) window.logInspector('RESPUESTA CRUDA DE API', fullResponse);
            console.warn('RAW API RESPONSE:', fullResponse);
            this.parseAIResponse(fullResponse);
            
            const parsedData = parseAIResponseData(fullResponse);
            let finalRespuesta = parsedData.respuesta || '';

            const rawCita = this.extractTag(fullResponse, 'cita');
            if (rawCita && !finalRespuesta.includes('<cita>')) {
                finalRespuesta = `<cita>${rawCita}</cita> ` + finalRespuesta;
            }

            const forbiddenWords = ['as an ai', 'as an artificial intelligence', 'inteligencia artificial', 'modelo de lenguaje', 'open ai', 'openai', 'no tengo sentimientos', 'no puedo sentir', 'soy un programa', 'soy una ia', 'i am an ai'];
            const hasForbidden = forbiddenWords.some(w => finalRespuesta.toLowerCase().includes(w));

            if (hasForbidden && retryCount < 2) {
                window.logInspector('FILTRO ACTIVADO', 'Alucinación detectada. Reintentando...');
                this.history.pop();
                const forcedMsg = message + '\n\n[ERROR: Tu respuesta incluyó palabras de IA. Rompiste el personaje. REESCRIBE COMO UN HUMANO REAL.]';
                return await this.sendMessageToAI(forcedMsg, onChunk, onThoughtChunk, true, retryCount + 1, isInternal);
            }

            if (finalRespuesta.trim() === '' && retryCount < 2) {
                window.logInspector('FILTRO ACTIVADO', 'Respuesta vacía. Reintentando...');
                this.history.pop();
                const forcedMsg = message + '\n\n[ERROR: NO escribiste nada dentro de <respuesta>. ES OBLIGATORIO responder algo.]';
                return await this.sendMessageToAI(forcedMsg, onChunk, onThoughtChunk, true, retryCount + 1, isInternal);
            }

            if (finalRespuesta.trim() !== '') {
                finalRespuesta = injectTypos(finalRespuesta, this.enojo, this.cansancio);
                const estadoTag = this.extractTag(fullResponse, 'estado');
                const compressedResponse = `<estado>${estadoTag}</estado><respuesta>${finalRespuesta}</respuesta>`;
                this.addMessage('assistant', compressedResponse);

                apiFetch('/api/user/me')
                    .then(r => r.json())
                    .then(d => {
                        if (d.dailyMessageCount !== undefined) {
                            this.dailyMessageCount = d.dailyMessageCount;
                            this.updateBrainUI();
                        }
                    }).catch(() => {});

                saveEpisodeToServer(`IA respondió: ${finalRespuesta}`);
            }
            return finalRespuesta;
        } catch (error) {
            console.error('Error de OpenRouter:', error);
            throw error;
        } finally {
            if (timeout) clearTimeout(timeout);
        }
    }
}
