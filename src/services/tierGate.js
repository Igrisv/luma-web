const TIER_FEATURES = {
  free: {
    maxMessagesPerDay: 15,
    arquetipos: ['pareja', 'rival', 'amigaToxica', 'mejorAmigo'],
    autonomousMessages: false,
    evolution: false,
    multipleCharacters: true,
    customArchetype: true,
    realLifeMode: false,
    exportHistory: false
  },
  premium: {
    maxMessagesPerDay: Infinity,
    arquetipos: ['pareja', 'amigaToxica', 'rival', 'ex', 'mejorAmigo'],
    autonomousMessages: true,
    evolution: true,
    multipleCharacters: true,
    customArchetype: true,
    realLifeMode: false,
    exportHistory: false
  },
  obsesion: {
    maxMessagesPerDay: Infinity,
    arquetipos: ['pareja', 'amigaToxica', 'rival', 'ex', 'mejorAmigo'],
    autonomousMessages: true,
    evolution: true,
    multipleCharacters: true,
    customArchetype: true,
    realLifeMode: true,
    exportHistory: true
  }
};

let currentTier = 'free';

export function setTier(tier) {
  currentTier = tier;
  applyTierGating();
}

export function getTier() {
  return currentTier;
}

export function getFeatures() {
  return TIER_FEATURES[currentTier] || TIER_FEATURES.free;
}

export function canUse(feature) {
  const features = getFeatures();
  return !!features[feature];
}

export function canUseArchetype(archetypeId) {
  const features = getFeatures();
  return features.arquetipos.includes(archetypeId);
}

export function canCreateCustomBot(currentCustomCount) {
  if (currentTier === 'premium' || currentTier === 'obsesion') return true;
  return currentCustomCount < 3;
}

export function getRemainingMessages(usedToday) {
  const features = getFeatures();
  if (features.maxMessagesPerDay === Infinity) return Infinity;
  return Math.max(0, features.maxMessagesPerDay - usedToday);
}

export function applyTierGating() {
  const features = getFeatures();

  document.querySelectorAll('.character-card').forEach(card => {
    const id = card.dataset.id;
    if (id && !features.arquetipos.includes(id)) {
      card.classList.add('locked');
      if (!card.querySelector('.lock-overlay')) {
        const overlay = document.createElement('div');
        overlay.className = 'lock-overlay';
        overlay.innerHTML = '🔒 Premium';
        overlay.addEventListener('click', (e) => {
          e.stopPropagation();
          const billingModal = document.getElementById('billingModal') || document.getElementById('billing-modal');
          if (billingModal) billingModal.classList.remove('hidden');
        });
        card.appendChild(overlay);
      }
    } else {
      card.classList.remove('locked');
      const overlay = card.querySelector('.lock-overlay');
      if (overlay) overlay.remove();
    }
  });
}

export { TIER_FEATURES };
