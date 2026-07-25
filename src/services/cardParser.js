// ═══════════════════════════════════════════════════════════
// cardParser.js — Character Card V2/V3 Spec Parser & Emotional Helpers
// ═══════════════════════════════════════════════════════════

/**
 * Extracts Character Card Spec V2/V3 metadata from a PNG ArrayBuffer (tEXt chunk 'chara' / 'ccv3')
 */
export function parseCharacterCardPNG(arrayBuffer) {
    const dataView = new DataView(arrayBuffer);
    const uint8 = new Uint8Array(arrayBuffer);

    // PNG Signature: 89 50 4E 47 0D 0A 1A 0A
    if (uint8[0] !== 0x89 || uint8[1] !== 0x50 || uint8[2] !== 0x4E || uint8[3] !== 0x47) {
        throw new Error('El archivo no es una imagen PNG válida.');
    }

    let offset = 8;
    while (offset < uint8.length - 8) {
        const chunkLength = dataView.getUint32(offset);
        const chunkType = String.fromCharCode(uint8[offset + 4], uint8[offset + 5], uint8[offset + 6], uint8[offset + 7]);

        if (chunkType === 'tEXt') {
            const chunkData = uint8.subarray(offset + 8, offset + 8 + chunkLength);
            let nullIndex = -1;
            for (let i = 0; i < chunkData.length; i++) {
                if (chunkData[i] === 0) {
                    nullIndex = i;
                    break;
                }
            }
            if (nullIndex !== -1) {
                const keyword = new TextDecoder('utf-8').decode(chunkData.subarray(0, nullIndex));
                if (keyword === 'chara' || keyword === 'ccv3') {
                    const textValue = new TextDecoder('utf-8').decode(chunkData.subarray(nullIndex + 1));
                    let parsed;
                    try {
                        const decoded = atob(textValue);
                        parsed = JSON.parse(decoded);
                    } catch (e) {
                        parsed = JSON.parse(textValue);
                    }
                    const charData = parsed.data || parsed;
                    return {
                        name: charData.name || charData.char_name || 'Personaje Importado',
                        tagline: charData.creator_notes || charData.title || charData.personality || 'Importado de Tarjeta PNG',
                        description: charData.description || charData.char_persona || '',
                        first_message: charData.first_mes || charData.first_message || charData.greeting || '¡Hola!',
                        system_prompt: charData.personality || charData.char_persona || charData.description || charData.scenario || 'Eres un personaje con personalidad propia.'
                    };
                }
            }
        }
        offset += 12 + chunkLength;
    }
    throw new Error('No se encontraron metadatos de Character Card (chara) en la imagen PNG.');
}

/**
 * Returns dynamic emotional badge indicator based on brain emotional attributes
 */
export function getEmotionalBadge(brainOrState) {
    const afinidad = brainOrState.afinidad !== undefined ? brainOrState.afinidad : 50;
    const enojo = brainOrState.enojo !== undefined ? brainOrState.enojo : 0;
    const celos = brainOrState.celos !== undefined ? brainOrState.celos : 0;
    const resentimiento = brainOrState.resentimiento !== undefined ? brainOrState.resentimiento : 0;

    if (enojo > 30 || resentimiento > 30) {
        return { dot: '🔴', text: 'Enojada', color: '#ef4444' };
    }
    if (celos > 30) {
        return { dot: '🟣', text: 'Celosa', color: '#a855f7' };
    }
    if (afinidad >= 70) {
        return { dot: '🟢', text: 'Enamorada', color: '#10b981' };
    }
    if (afinidad >= 40) {
        return { dot: '🟢', text: 'Conectada', color: '#10b981' };
    }
    return { dot: '🟡', text: 'Neutro', color: '#f59e0b' };
}
