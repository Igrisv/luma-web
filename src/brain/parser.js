// ═══════════════════════════════════════════════════════════
// brain/parser.js — Parser de XML y Fallback de Respuestas
// ═══════════════════════════════════════════════════════════

/**
 * Extrae el contenido dentro de una etiqueta XML dada.
 */
export function extractTag(text, tag) {
    if (!text) return '';
    const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i');
    const match = text.match(regex);
    return match ? match[1].trim() : '';
}

/**
 * Parsea la respuesta del LLM. Extrae <respuesta>, <estado>, <pensamiento>, <aprender>, etc.
 * Si el LLM omitió las etiquetas XML, aplica un fallback para limpiar el texto y no mostrar XML crudo.
 */
export function parseAIResponseData(fullResponse) {
    const rawRespuesta = extractTag(fullResponse, 'respuesta');
    const pensamiento = extractTag(fullResponse, 'pensamiento');
    const accion = extractTag(fullResponse, 'accion') || 'esperar';
    const estadoStr = extractTag(fullResponse, 'estado');
    const aprenderStr = extractTag(fullResponse, 'aprender');
    const olvidarStr = extractTag(fullResponse, 'olvidar');
    const rasgoStr = extractTag(fullResponse, 'rasgo_nuevo');
    const cita = extractTag(fullResponse, 'cita');
    const diarioStr = extractTag(fullResponse, 'diario');

    let cleanText = rawRespuesta;

    // Fallback: si no se encontró la etiqueta <respuesta>, remover etiquetas de control y usar el resto
    if (!cleanText && fullResponse) {
        cleanText = fullResponse
            .replace(/<pensamiento>[\s\S]*?<\/pensamiento>/gi, '')
            .replace(/<critica>[\s\S]*?<\/critica>/gi, '')
            .replace(/<estado>[\s\S]*?<\/estado>/gi, '')
            .replace(/<accion>[\s\S]*?<\/accion>/gi, '')
            .replace(/<aprender>[\s\S]*?<\/aprender>/gi, '')
            .replace(/<olvidar>[\s\S]*?<\/olvidar>/gi, '')
            .replace(/<rasgo_nuevo>[\s\S]*?<\/rasgo_nuevo>/gi, '')
            .replace(/<cita>[\s\S]*?<\/cita>/gi, '')
            .replace(/<diario>[\s\S]*?<\/diario>/gi, '')
            .replace(/<[^>]+>/g, '') // Quitar cualquier otra etiqueta remanente
            .trim();
    }

    return {
        respuesta: cleanText,
        pensamiento,
        accion,
        estadoStr,
        aprenderStr,
        olvidarStr,
        rasgoStr,
        cita,
        diarioStr
    };
}
