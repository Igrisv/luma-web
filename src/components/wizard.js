// ═══════════════════════════════════════════════════════════
// wizard.js — 3-Step Bot Creator Component with Tier Protection
// ═══════════════════════════════════════════════════════════
import { canUseArchetype, getTier } from '../services/tierGate.js';

export function initCreatorWizard(onSaveCharacter, showToast) {
    let currentStep = 1;

    const step1 = document.getElementById('wizardStep1');
    const step2 = document.getElementById('wizardStep2');
    const step3 = document.getElementById('wizardStep3');

    const ind1 = document.getElementById('stepInd1');
    const ind2 = document.getElementById('stepInd2');
    const ind3 = document.getElementById('stepInd3');

    const nextBtn = document.getElementById('nextWizardStepBtn');
    const prevBtn = document.getElementById('prevWizardStepBtn');
    const saveBtn = document.getElementById('saveCharacterBtn');

    // Slider updates
    ['Afinidad', 'Celos', 'Resentimiento', 'Ansiedad'].forEach(attr => {
        const input = document.getElementById(`create${attr}`);
        const display = document.getElementById(`valCreate${attr}`);
        if (input && display) {
            input.addEventListener('input', () => { display.textContent = input.value; });
        }
    });

    function updateStepUI() {
        if (step1) step1.classList.toggle('hidden', currentStep !== 1);
        if (step2) step2.classList.toggle('hidden', currentStep !== 2);
        if (step3) step3.classList.toggle('hidden', currentStep !== 3);

        if (ind1) ind1.classList.toggle('active', currentStep === 1);
        if (ind2) ind2.classList.toggle('active', currentStep === 2);
        if (ind3) ind3.classList.toggle('active', currentStep === 3);

        if (prevBtn) prevBtn.classList.toggle('hidden', currentStep === 1);
        if (nextBtn) nextBtn.classList.toggle('hidden', currentStep === 3);
        if (saveBtn) saveBtn.classList.toggle('hidden', currentStep !== 3);
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (currentStep === 1) {
                const name = document.getElementById('createName').value.trim();
                const firstMsg = document.getElementById('createFirstMessage').value.trim();
                if (!name || !firstMsg) {
                    if (showToast) showToast('Por favor completa el nombre y el saludo inicial.', 'warning');
                    return;
                }
            }
            if (currentStep === 2) {
                const prompt = document.getElementById('createSystemPrompt').value.trim();
                const archetype = document.getElementById('createArchetype').value;

                if (!prompt) {
                    if (showToast) showToast('Por favor completa el prompt de personalidad.', 'warning');
                    return;
                }

                // Check tier protection for archetype
                if (!canUseArchetype(archetype) && getTier() === 'free') {
                    const billingModal = document.getElementById('billingModal') || document.getElementById('billing-modal');
                    if (billingModal) billingModal.classList.remove('hidden');
                    if (showToast) showToast('El arquetipo seleccionado requiere Plan Premium.', 'warning');
                    return;
                }
            }
            if (currentStep < 3) currentStep++;
            updateStepUI();
        });
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentStep > 1) currentStep--;
            updateStepUI();
        });
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            const name = document.getElementById('createName').value.trim();
            const tagline = document.getElementById('createTagline').value.trim();
            const avatar_url = document.getElementById('createAvatarUrl').value.trim() || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80';
            const first_message = document.getElementById('createFirstMessage').value.trim();
            const arquetipo_id = document.getElementById('createArchetype').value;
            const system_prompt = document.getElementById('createSystemPrompt').value.trim();
            const lorebookText = document.getElementById('createLorebook').value.trim();

            if (!canUseArchetype(arquetipo_id) && getTier() === 'free') {
                const billingModal = document.getElementById('billingModal') || document.getElementById('billing-modal');
                if (billingModal) billingModal.classList.remove('hidden');
                if (showToast) showToast('El arquetipo seleccionado requiere Plan Premium.', 'warning');
                return;
            }

            const afinidad = parseInt(document.getElementById('createAfinidad').value, 10) || 60;
            const celos = parseInt(document.getElementById('createCelos').value, 10) || 10;
            const resentimiento = parseInt(document.getElementById('createResentimiento').value, 10) || 0;
            const ansiedad = parseInt(document.getElementById('createAnsiedad').value, 10) || 0;

            const newChar = {
                name,
                tagline,
                avatar_url,
                first_message,
                arquetipo_id,
                system_prompt,
                emociones_inicio: { afinidad, celos, resentimiento, ansiedad },
                lorebook: lorebookText ? { 'custom_keys': lorebookText } : {}
            };

            if (onSaveCharacter) {
                await onSaveCharacter(newChar);
                currentStep = 1;
                updateStepUI();
            }
        });
    }
}
