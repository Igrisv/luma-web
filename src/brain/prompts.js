// ═══════════════════════════════════════════════════════════
// brain/prompts.js — Niveles de confianza y Generación de Prompts
//
// ARQUITECTURA Static-First / Dynamic-Last:
//  buildContextString()       → ESTÁTICO (activa KV Cache automático)
//  buildPostHistoryDirective() → DINÁMICO (hora, clima, emociones por turno)
// ═══════════════════════════════════════════════════════════

export const NIVELES_CONFIANZA = [
    { nivel: 0, nombre: 'Extraños',  icono: '🌑', minDias: 0,  prompt: 'Confianza: Extraños. Sé reservada y breve.' },
    { nivel: 1, nombre: 'Conocidos', icono: '🌒', minDias: 2,  prompt: 'Confianza: Conocidos. Muestra calidez y haz preguntas.' },
    { nivel: 2, nombre: 'Amigos',    icono: '🌓', minDias: 5,  prompt: 'Confianza: Amigos. Habla de tu día y usa su nombre.' },
    { nivel: 3, nombre: 'Cercanos',  icono: '🌔', minDias: 10, prompt: 'Confianza: Cercanos. Expresa afecto y menciona el pasado.' },
    { nivel: 4, nombre: 'Íntimos',   icono: '🌕', minDias: 20, prompt: 'Confianza: Íntimos. Conexión profunda y confidencias.' },
];

export function getNivelInfoByDays(diasCount) {
    let nivelActual = NIVELES_CONFIANZA[0];
    for (const n of NIVELES_CONFIANZA) {
        if (diasCount >= n.minDias) nivelActual = n;
    }
    const siguiente = NIVELES_CONFIANZA.find(n => n.minDias > diasCount);
    return { ...nivelActual, diasActivos: diasCount, siguiente };
}

export function formatKeyValueMemory(conocimientoObj) {
    if (!conocimientoObj || typeof conocimientoObj !== 'object') return '';
    const entries = Object.entries(conocimientoObj);
    if (entries.length === 0) return '';
    const kvPairs = entries.map(([k, v]) => {
        const valStr = (typeof v === 'object' && v !== null)
            ? (Array.isArray(v) ? v.join('/') : JSON.stringify(v))
            : String(v);
        return `${k}=${valStr}`;
    }).join('; ');
    return `Usuario: ${kvPairs}. `;
}

// DINÁMICO — Hora, clima, energía y emociones van aquí, NO en buildContextString.
// Al estar al final del payload, el modelo le presta máxima atención (efecto recency).
export function buildPostHistoryDirective(brainState, responseHint = '') {
    const hintLine = responseHint
        ? `\n- Longitud sugerida: ${responseHint}`
        : '\n- Longitud sugerida: Respuestas CORTAS (1-2 líneas).';

    // Contexto temporal — dinámico por turno
    const hour = new Date().getHours();
    const time = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    let energia = 100;
    if (hour >= 1 && hour <= 6) energia = 10;
    else if (hour > 6 && hour <= 10) energia = 60;
    else if (hour > 22) energia = 30;

    let rutina = 'Libre';
    if (hour >= 9 && hour < 14) rutina = 'En clase/trabajo (respondes disimuladamente)';
    else if (hour >= 18 && hour < 20) rutina = 'Manejando/de paso';

    const climaStr = brainState.climaLocal ? `, Clima=${brainState.climaLocal}` : '';

    let directivaEmocional = 'Normal/Neutral';
    if (brainState.enojo > 50 || brainState.resentimiento > 50) {
        directivaEmocional = 'Estás molesta/resentida. Responde de forma seca, cortante o sarcástica.';
    } else if (brainState.celos > 50) {
        directivaEmocional = 'Sientes celos. Muestra desconfianza o haz preguntas indirectas/territoriales.';
    } else if (brainState.ansiedad > 60) {
        directivaEmocional = 'Estás ansiosa. Busca validación y muestra cierta inseguridad.';
    } else if (brainState.nostalgia > 60) {
        directivaEmocional = 'Estás melancólica. Reflexiona sobre el pasado y ponte nostálgica.';
    } else if (brainState.afinidad > 75) {
        directivaEmocional = 'Sientes mucha afinidad. Sé cálida, cercana y confiada.';
    }

    // Daily Mood (si existe)
    const moodStr = brainState.dailyMood ? `, Humor del día=${brainState.dailyMood.nombre} (${brainState.dailyMood.desc})` : '';

    return `[ESTADO PARA ESTE TURNO — Hora=${time}, Energía=${energia}%${climaStr}, Rutina=${rutina}${moodStr}]:
- Actitud actual: ${directivaEmocional}${hintLine}
- Emociones: afinidad=${brainState.afinidad}, enojo=${brainState.enojo}, celos=${brainState.celos}, ansiedad=${brainState.ansiedad}, nostalgia=${brainState.nostalgia}.
- REGLA: Responde ÚNICAMENTE a la frase del usuario en el chat. Mantén el personaje al 100%.`;
}

// ESTÁTICO — NUNCA incluyas timestamps, hora, clima ni emociones numéricas aquí.
// Su contenido debe ser idéntico entre turnos para que DeepInfra active el KV Cache.
export function buildContextString(brainState, isFullPrompt = true) {
    const arquetipo = brainState.arquetipo;
    const nivelInfo = brainState.nivelInfo;

    const datosUsr = formatKeyValueMemory(brainState.conocimiento);

    const cleanTraits = (brainState.rasgos_identidad || []).slice(-5)
        .map(t => String(t).replace(/[<>[\]]/g, '')).join(', ');
    const rasgosStr = cleanTraits ? `Tus gustos/rasgos personales: ${cleanTraits}.` : '';

    const rawPerfil = brainState.perfil_psicologico || brainState.memoryState?.perfil_psicologico || '';
    const cleanPerfil = String(rawPerfil).replace(/[<>[\]]/g, '').slice(0, 120).trim();
    const perfilPsicoStr = cleanPerfil ? `Perfil del usuario: "${cleanPerfil}".` : '';

    const contextUsuario = [datosUsr, rasgosStr, perfilPsicoStr].filter(Boolean).join(' ');

    if (!isFullPrompt) {
        return `Eres una persona real (${arquetipo.nombre || 'amigo'}). Cero formalidad. ${contextUsuario}
Responde usando SOLO XML: <pensamiento>pensamiento breve</pensamiento><estado>emociones</estado><respuesta>Tu respuesta casual en español</respuesta>`;
    }

    // Verbal Fingerprint & Few-Shot Examples (Estáticos, para el prefix cacheable)
    let fingerprintStr = '';
    if (arquetipo.verbalFingerprint) {
        const fp = arquetipo.verbalFingerprint;
        fingerprintStr = `Huella de voz: Muletillas habituales: [${fp.catchphrases.join(', ')}]. Estilo: ${fp.typingQuirks.join(', ')}. Estilo emoji: ${fp.emojiStyle}. `;
    }

    let fewShotStr = '';
    if (arquetipo.fewShotExamples && arquetipo.fewShotExamples.length > 0) {
        fewShotStr = '\nEjemplos de cómo suenas:\n' + arquetipo.fewShotExamples.map(e => `Usuario: "${e.user}"\nTú: "${e.bot}"`).join('\n') + '\n';
    }

    return `Eres una persona real chateando. Da respuestas casuales. Cero formalidad.
${contextUsuario ? contextUsuario + '\n' : ''}${fingerprintStr}
${fewShotStr}
REGLAS GENERALES:
1. Idioma: 100% Español casual. Cero inglés o Spanglish.
2. Coherencia: Escucha y responde con sentido directo a la frase actual del usuario. NUNCA lo acuses de ignorarte si acaba de responder.
3. Asincronía: Si estás ocupada, responde rápido a escondidas.
4. Arquetipo: ${arquetipo.promptNucleo} ${nivelInfo.prompt}
5. Foco Directo: Usa la información previa y el perfil del usuario solo como contexto pasivo. Tu <respuesta> debe dirigirse SIEMPRE y únicamente a lo que el usuario acaba de escribir en el chat.
6. Cero Meta-lenguaje: NUNCA menciones que tienes directivas, emociones en números, ni etiquetas XML en tu conversación.

FORMATO EXCLUSIVO XML (NO escribas fuera de las etiquetas):
<pensamiento>Análisis breve</pensamiento>
<accion>esperar</accion>
<diario>RARO Y OPCIONAL (Máximo 1 vez por conversación si hay emoción intensa). Escribe 1 confesión íntima de tu mundo interior sobre lo que sientes por el usuario. NUNCA escribas preguntas, reclamos del chat, ni títulos en inglés. Debe ser una reflexión secreta profunda.</diario>
<estado>afinidad=N, enojo=N, cansancio=N, ansiedad=N, aburrimiento=N, resentimiento=N, celos=N, nostalgia=N</estado>
<aprender>Opcional. Escribe SOLO un JSON válido con nuevos datos personales o gustos del usuario. Ejemplo estricto: {"nombre":"Carlos","hobby":"música"}. Cero texto adicional. Si no hay datos nuevos, omite la etiqueta.</aprender>
<perfil_psicologico>Opcional: 1 frase analizando la personalidad o estado del usuario según cómo actúa contigo.</perfil_psicologico>
<respuesta>OBLIGATORIO. Tu respuesta directa al usuario. NUNCA OMITAS ESTA ETIQUETA.</respuesta>`;
}
