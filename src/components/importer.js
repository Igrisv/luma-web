// ═══════════════════════════════════════════════════════════
// importer.js — Character Card PNG/JSON Importer Component
// ═══════════════════════════════════════════════════════════
import { parseCharacterCardPNG } from '../services/cardParser.js';

export function initCardImporter(onImportComplete, showToast) {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const browseBtn = document.getElementById('browseFileBtn');
    const previewArea = document.getElementById('importPreview');
    const namePreview = document.getElementById('importNamePreview');
    const taglinePreview = document.getElementById('importTaglinePreview');
    const avatarPreview = document.getElementById('importAvatarPreview');
    const confirmBtn = document.getElementById('confirmImportBtn');

    let pendingParsedCharacter = null;

    if (browseBtn && fileInput) {
        browseBtn.addEventListener('click', () => fileInput.click());
    }

    if (dropzone) {
        ['dragenter', 'dragover'].forEach(eventName => {
            dropzone.addEventListener(eventName, e => {
                e.preventDefault();
                dropzone.classList.add('dragover');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropzone.addEventListener(eventName, e => {
                e.preventDefault();
                dropzone.classList.remove('dragover');
            }, false);
        });

        dropzone.addEventListener('drop', e => {
            const files = e.dataTransfer.files;
            if (files && files.length > 0) handleFile(files[0]);
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', e => {
            if (e.target.files && e.target.files.length > 0) {
                handleFile(e.target.files[0]);
            }
        });
    }

    async function handleFile(file) {
        try {
            if (file.name.endsWith('.png')) {
                const arrayBuffer = await file.arrayBuffer();
                const parsed = parseCharacterCardPNG(arrayBuffer);
                parsed.avatar_url = URL.createObjectURL(file);
                showPreview(parsed);
            } else if (file.name.endsWith('.json')) {
                const text = await file.text();
                const json = JSON.parse(text);
                const charData = json.data || json;
                const parsed = {
                    name: charData.name || charData.char_name || 'Personaje JSON',
                    tagline: charData.creator_notes || charData.title || 'Importado de archivo JSON',
                    description: charData.description || charData.char_persona || '',
                    first_message: charData.first_mes || charData.first_message || '¡Hola!',
                    system_prompt: charData.personality || charData.char_persona || charData.description || 'Eres un personaje importado.',
                    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80'
                };
                showPreview(parsed);
            } else {
                if (showToast) showToast('Formato no soportado. Selecciona una tarjeta PNG o archivo JSON.', 'error');
            }
        } catch (err) {
            console.error('Error importing card:', err);
            if (showToast) showToast(`Error al leer tarjeta: ${err.message}`, 'error');
        }
    }

    function showPreview(parsed) {
        pendingParsedCharacter = parsed;
        if (namePreview) namePreview.textContent = parsed.name;
        if (taglinePreview) taglinePreview.textContent = parsed.tagline;
        if (avatarPreview) avatarPreview.src = parsed.avatar_url;
        if (previewArea) previewArea.classList.remove('hidden');
    }

    if (confirmBtn) {
        confirmBtn.addEventListener('click', async () => {
            if (pendingParsedCharacter && onImportComplete) {
                await onImportComplete(pendingParsedCharacter);
                pendingParsedCharacter = null;
                if (previewArea) previewArea.classList.add('hidden');
            }
        });
    }
}
