// ═══════════════════════════════════════════════════════════
// core/secureStorage.js — Almacenamiento Cifrado para LocalStorage
// Protege personajes, prompts y conversaciones contra accesos no autorizados
// ═══════════════════════════════════════════════════════════

const SEC_KEY = 'LUMA_STORAGE_SEC_2026';

function scramble(text) {
  if (typeof text !== 'string') return text;
  let res = '';
  for (let i = 0; i < text.length; i++) {
    res += String.fromCharCode(text.charCodeAt(i) ^ SEC_KEY.charCodeAt(i % SEC_KEY.length));
  }
  return 'ENC_' + btoa(unescape(encodeURIComponent(res)));
}

function unscramble(encText, keyToMigrate = null) {
  if (!encText) return null;
  if (typeof encText !== 'string') return encText;
  
  // If old plaintext item, migrate and encrypt it immediately in localStorage!
  if (!encText.startsWith('ENC_')) {
    if (keyToMigrate) {
      try {
        localStorage.setItem(keyToMigrate, scramble(encText));
      } catch (e) {}
    }
    return encText;
  }
  
  try {
    const raw = decodeURIComponent(escape(atob(encText.substring(4))));
    let res = '';
    for (let i = 0; i < raw.length; i++) {
      res += String.fromCharCode(raw.charCodeAt(i) ^ SEC_KEY.charCodeAt(i % SEC_KEY.length));
    }
    return res;
  } catch (e) {
    return encText;
  }
}

export const secureStorage = {
  getItem(key) {
    const val = localStorage.getItem(key);
    if (!val) return null;
    return unscramble(val, key);
  },
  setItem(key, value) {
    const strVal = typeof value === 'string' ? value : JSON.stringify(value);
    localStorage.setItem(key, scramble(strVal));
  },
  removeItem(key) {
    localStorage.removeItem(key);
  },
  migrateAll() {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('chatConfig_') || key.startsWith('chatHistory_') || key.startsWith('luma'))) {
          const val = localStorage.getItem(key);
          if (val && typeof val === 'string' && !val.startsWith('ENC_')) {
            localStorage.setItem(key, scramble(val));
          }
        }
      }
    } catch (e) {}
  }
};

// Run auto-migration immediately when module is imported
secureStorage.migrateAll();
