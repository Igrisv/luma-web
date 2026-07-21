// ═══════════════════════════════════════════════════════════
// brain/typos.js — Inyector de Errores Tipográficos
// ═══════════════════════════════════════════════════════════

export function injectTypos(text, enojo = 0, cansancio = 0) {
    if (!text || text.length < 5) return text;
    let typoProb = 0;
    if (cansancio > 50) typoProb += (cansancio - 50) * 0.003;
    if (enojo > 50) typoProb += (enojo - 50) * 0.004;

    if (typoProb === 0 || Math.random() > typoProb) return text;

    const words = text.split(' ');
    const candidateIndices = [];
    for (let i = 0; i < words.length; i++) {
        if (words[i].length > 3 && !words[i].includes('<') && !words[i].includes('>') && !words[i].includes('||')) {
            candidateIndices.push(i);
        }
    }
    if (candidateIndices.length === 0) return text;

    const idx = candidateIndices[Math.floor(Math.random() * candidateIndices.length)];
    const word = words[idx];
    const charIdx = Math.floor(Math.random() * (word.length - 1)) + 1;

    const adj = { 'a': 's', 's': 'd', 'd': 'f', 'q': 'w', 'w': 'e', 'e': 'r', 'o': 'p', 'p': 'o', 'l': 'k', 'm': 'n', 'n': 'm' };
    const c = word[charIdx].toLowerCase();

    if (adj[c]) {
        const messedUp = word.substring(0, charIdx) + adj[c] + word.substring(charIdx + 1);
        words[idx] = messedUp;
        let result = words.join(' ');
        if (Math.random() > 0.4 && enojo < 70) {
            result += `||*${word.replace(/[.,!?]/g, '')}`;
        }
        return result;
    }
    return text;
}
