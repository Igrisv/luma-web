import { apiFetch } from '../services/auth.js';
import { showToast } from '../components/ui.js';

export function initTimers(brain) {
    let inactivityTimer = null;

    function resetInactivityTimer() {
        if (inactivityTimer) clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(() => {
            if (brain && brain.afinidad > 40) {
                console.log('Inactivity timeout trigger.');
            }
        }, 180000); // 3 min
    }

    window.addEventListener('mousemove', resetInactivityTimer);
    window.addEventListener('keydown', resetInactivityTimer);
    resetInactivityTimer();
}
