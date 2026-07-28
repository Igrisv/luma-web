// ═══════════════════════════════════════════════════════════
// config/adsConfig.js — Configuraciones de Proveedores de Anuncios
// ═══════════════════════════════════════════════════════════

export const ADS_CONFIG = {
    // Modo de Anuncios: 'hybrid' | 'vast' | 'ima' | 'script' | 'sample'
    mode: 'hybrid',

    // Configuración Script Adsterra / Social Bar / Native Ad Network
    scriptAdUrl: 'https://pl30565532.effectivecpmnetwork.com/76/ee/ee/76eeee55d8dfe404ee4c536319ec8ba4.js',

    // Configuración Opción 1: Etiquetas VAST / VPAID (URL oficial pública de prueba VAST 3.0)
    vastTagUrl: 'https://pubads.g.doubleclick.net/gampad/ads?sz=640x480&iu=/12431908/single_ad_samples&ciu_szs=728x90&impl=s&gdfp_req=1&env=vp&output=vast&unviewed_position_start=1&cust_params=sample_ct%3Dlinear&correlator=',

    // Configuración Opción 2: Google IMA SDK (AdSense for Video / Google Ad Manager)
    googleImaTagUrl: 'https://pubads.g.doubleclick.net/gampad/ads?iu=/21775744923/external/single_ad_samples&sz=640x480&cust_params=sample_ct%3Dlinear&ciu_szs=300x250%2C728x90&gdfp_req=1&env=vp&output=vast&unviewed_position_start=1&correlator=',

    // Opciones generales
    fallbackToSampleOnNoFill: true,
    requiredWatchSeconds: 5
};
