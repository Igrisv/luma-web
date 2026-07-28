const TIER_FEATURES = {
  free: {
    maxMessagesPerDay: 15,
    arquetipos: ['mejorAmigo'], // Mejor Amigo/a is the free archetype for Free plan
    custom3DModel: false, // 🔒 Custom 3D GLB models locked for Free plan
    autonomousMessages: false,
    evolution: false,
    multipleCharacters: true,
    customArchetype: true,
    realLifeMode: false,
    exportHistory: false
  },
  premium: {
    maxMessagesPerDay: Infinity,
    arquetipos: ['pareja', 'rival', 'amigaToxica', 'ex', 'mejorAmigo'],
    custom3DModel: true, // ✓ Custom 3D GLB models unlocked for Premium
    autonomousMessages: true,
    evolution: true,
    multipleCharacters: true,
    customArchetype: true,
    realLifeMode: false,
    exportHistory: false
  },
  obsesion: {
    maxMessagesPerDay: Infinity,
    arquetipos: ['pareja', 'rival', 'amigaToxica', 'ex', 'mejorAmigo'],
    custom3DModel: true, // ✓ Custom 3D GLB models unlocked for Obsesión
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

  // 1. Gallery Character Cards
  document.querySelectorAll('.character-card').forEach(card => {
    const id = card.dataset.id;
    if (id && !features.arquetipos.includes(id)) {
      card.classList.add('locked');
      if (!card.querySelector('.lock-overlay')) {
        const overlay = document.createElement('div');
        overlay.className = 'lock-overlay';
        overlay.innerHTML = '🔒 Plan Premium Requerido';
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

  // 2. Creator Wizard Archetype Selection Grid Cards
  document.querySelectorAll('.archetype-select-card').forEach(card => {
    const archetype = card.dataset.archetype;
    const isAllowed = canUseArchetype(archetype);
    const badge = card.querySelector('.arc-badge');

    if (isAllowed) {
      card.classList.remove('locked-arc');
      if (badge) {
        badge.className = 'arc-badge free';
        badge.innerHTML = `✓ Disponible (${currentTier.toUpperCase()})`;
      }
    } else {
      card.classList.add('locked-arc');
      if (badge) {
        badge.className = 'arc-badge lock';
        badge.innerHTML = `🔒 Requiere Premium`;
      }
    }
  });

  // 3. Custom 3D Model Upload Controls Gating
  const canCustom3D = canUse('custom3DModel');
  const labelModel3d = document.querySelector('label[for="model3dFileInput"]');
  const labelTexture = document.querySelector('label[for="textureFileInput"]');

  if (labelModel3d) {
    labelModel3d.classList.toggle('locked-action-pill', !canCustom3D);
    labelModel3d.title = canCustom3D ? 'Subir Modelo 3D (.glb)' : '🔒 La carga de modelos 3D personalizados requiere Plan Premium';
  }
  if (labelTexture) {
    labelTexture.classList.toggle('locked-action-pill', !canCustom3D);
    labelTexture.title = canCustom3D ? 'Cargar / Asignar Texturas' : '🔒 La carga de texturas 3D personalizadas requiere Plan Premium';
  }
}

export { TIER_FEATURES };
