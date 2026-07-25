import { apiFetch } from './auth.js';
import { showToast } from '../components/ui.js';

export async function getBillingStatus() {
  const res = await apiFetch('/api/user/me');
  if (!res.ok) return { tier: 'free' };
  return await res.json();
}

export async function checkout(plan) {
  const res = await apiFetch('/api/billing/checkout', {
    method: 'POST',
    body: JSON.stringify({ plan })
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Error al crear checkout');
  }

  const { url } = await res.json();
  window.location.href = url;
}

export async function openPortal() {
  const res = await apiFetch('/api/billing/portal', { method: 'POST' });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Error al abrir portal');
  }

  const { url } = await res.json();
  window.location.href = url;
}

export function initBillingUI() {
  const modal = document.getElementById('billingModal') || document.getElementById('billing-modal');
  if (!modal) return;

  const closeBtn = document.getElementById('closeBillingModal') || document.getElementById('billing-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
  }

  document.querySelectorAll('[data-upgrade-plan]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const plan = btn.dataset.upgradePlan;
      btn.disabled = true;
      btn.textContent = 'Redirigiendo...';
      try {
        await checkout(plan);
      } catch (err) {
        showToast(err.message, 'error');
        btn.disabled = false;
        btn.textContent = plan === 'premium' ? 'Mejorar a Premium' : 'Obtener Obsesión';
      }
    });
  });

  const upgradePremiumBtn = document.getElementById('upgradePremiumBtn');
  if (upgradePremiumBtn && !upgradePremiumBtn.dataset.upgradePlan) {
    upgradePremiumBtn.addEventListener('click', () => checkout('premium').catch(err => showToast(err.message, 'error')));
  }

  const upgradeObsessionBtn = document.getElementById('upgradeObsessionBtn');
  if (upgradeObsessionBtn && !upgradeObsessionBtn.dataset.upgradePlan) {
    upgradeObsessionBtn.addEventListener('click', () => checkout('obsesion').catch(err => showToast(err.message, 'error')));
  }
}

export function updateTierBadge(tier) {
  const badge = document.getElementById('tierBadge') || document.getElementById('tier-badge');
  const upperTier = (tier || 'free').toUpperCase();

  if (badge) {
    badge.className = `tier-badge tier-${tier}`;
    badge.innerHTML = `<span>⚡ Plan ${upperTier}</span>`;
  }

  const settingsLabel = document.getElementById('settingsTierLabel');
  if (settingsLabel) {
    settingsLabel.textContent = `Plan ${upperTier}`;
  }
}
