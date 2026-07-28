// ═══════════════════════════════════════════════════════════
// services/adService.js — Motor de Anuncios Híbridos (VAST & Google IMA)
// ═══════════════════════════════════════════════════════════
import { apiFetch } from './auth.js';
import { ADS_CONFIG } from '../config/adsConfig.js';

// Muestra de respaldo si no hay relleno de red (Fill Rate 0%)
const SAMPLE_FALLBACK_ADS = [
    {
        id: 'ad_luma_pro',
        title: 'Luma Premium — Acceso Ilimitado',
        sponsor: 'Luma AI Network',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        duration: 10
    },
    {
        id: 'ad_cyber_pulse',
        title: 'CyberPulse — El Futuro de la IA',
        sponsor: 'CyberPulse Tech',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
        duration: 12
    }
];

export class RewardedAdManager {
    constructor() {
        this.currentAd = null;
        this.isPlaying = false;
        this.watchedSeconds = 0;
        this.requiredSeconds = ADS_CONFIG.requiredWatchSeconds || 5;
        this.timerInterval = null;
        this.mode = ADS_CONFIG.mode || 'hybrid';
        this.adsManagerIMA = null;
        this.adsLoaderIMA = null;
        this.adDisplayContainerIMA = null;

        this.onProgressCallback = null;
        this.onCompleteCallback = null;
        this.onErrorCallback = null;
    }

    /**
     * Parsea respuestas XML de Etiquetas VAST / VPAID (Opción 1)
     */
    async fetchVastAd(vastUrl) {
        try {
            const response = await fetch(vastUrl, { mode: 'cors' });
            if (!response.ok) throw new Error(`HTTP Error ${response.status}`);

            const xmlText = await response.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

            const mediaFiles = xmlDoc.getElementsByTagName('MediaFile');
            if (!mediaFiles || mediaFiles.length === 0) {
                throw new Error('No MediaFile found in VAST XML response');
            }

            // Seleccionar el primer archivo de video MP4/WebM válido
            let selectedMediaUrl = null;
            for (let i = 0; i < mediaFiles.length; i++) {
                const type = mediaFiles[i].getAttribute('type') || '';
                const url = mediaFiles[i].textContent.trim();
                if (url && (type.includes('mp4') || type.includes('webm') || url.includes('.mp4'))) {
                    selectedMediaUrl = url;
                    break;
                }
            }

            if (!selectedMediaUrl && mediaFiles[0]) {
                selectedMediaUrl = mediaFiles[0].textContent.trim();
            }

            const titleNode = xmlDoc.getElementsByTagName('AdTitle')[0];
            const descNode = xmlDoc.getElementsByTagName('Description')[0];

            return {
                id: `vast_${Date.now()}`,
                title: titleNode ? titleNode.textContent.trim() : 'Anuncio Patrocinado VAST',
                sponsor: descNode ? descNode.textContent.trim() : 'Red VAST / VPAID Network',
                videoUrl: selectedMediaUrl,
                duration: 10,
                isVast: true
            };
        } catch (err) {
            console.warn('[VAST] Error cargando o parseando etiqueta VAST:', err);
            return null;
        }
    }

    /**
     * Comprueba si un Bloqueador de Anuncios (AdBlocker / Brave Shields) está activo
     */
    async checkAdBlocker() {
        try {
            const testUrl = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
            const res = await fetch(testUrl, {
                method: 'HEAD',
                mode: 'no-cors',
                cache: 'no-store'
            }).catch(() => null);

            if (!res) return true;
            return false;
        } catch (e) {
            return true;
        }
    }

    /**
     * Prepara el anuncio según la estrategia configurada (Hybrid Waterfall)
     */
    async loadAd() {
        this.watchedSeconds = 0;
        this.currentAd = null;

        // Comprobar presencia de bloqueador de anuncios
        const adBlockerActive = await this.checkAdBlocker();
        if (adBlockerActive) {
            console.warn('[ADS] Bloqueador de anuncios detectado.');
            return {
                isAdBlocker: true,
                title: '🛡️ Bloqueador de Anuncios Detectado',
                sponsor: 'Acción Requerida',
                message: 'Para poder recargar tu saldo de mensajes gratis, por favor desactiva tu bloqueador de anuncios (AdBlock / Brave Shields) para este sitio.'
            };
        }

        // Estrategia 1: Carga de etiqueta VAST si el modo incluye VAST o Hybrid
        if (this.mode === 'vast' || this.mode === 'hybrid') {
            if (ADS_CONFIG.vastTagUrl) {
                console.log('[ADS] Intentando cargar etiqueta VAST...');
                const vastAd = await this.fetchVastAd(ADS_CONFIG.vastTagUrl);
                if (vastAd && vastAd.videoUrl) {
                    this.currentAd = vastAd;
                    return this.currentAd;
                }
            }
        }

        // Estrategia 2: Fallback a anuncio de muestra
        console.log('[ADS] Utilizando anuncio de respaldo...');
        const index = Math.floor(Math.random() * SAMPLE_FALLBACK_ADS.length);
        this.currentAd = SAMPLE_FALLBACK_ADS[index];
        return this.currentAd;
    }

    /**
     * Inicia la reproducción del anuncio con soporte para Google IMA (Opción 2) o VAST/HTML5
     */
    startAdPlayback({ videoElement, imaContainerElement, onProgress, onComplete, onError }) {
        this.onProgressCallback = onProgress;
        this.onCompleteCallback = onComplete;
        this.onErrorCallback = onError;
        this.isPlaying = true;

        // Opción 2: Intentar Google IMA SDK si está disponible y configurado
        if ((this.mode === 'ima' || this.mode === 'hybrid') && window.google && window.google.ima && imaContainerElement) {
            console.log('[ADS] Iniciando reproducción vía Google IMA SDK...');
            this.playGoogleImaAd(videoElement, imaContainerElement);
            return;
        }

        // Opción 1 / Direct Video Fallback: Reproductor de Video HTML5
        if (!this.currentAd) {
            this.currentAd = SAMPLE_FALLBACK_ADS[0];
        }

        if (imaContainerElement) imaContainerElement.classList.add('hidden');
        if (videoElement) {
            videoElement.classList.remove('hidden');
            videoElement.src = this.currentAd.videoUrl;
            videoElement.load();
            videoElement.play().catch(err => {
                console.warn('[ADS] Error de reproducción interactiva:', err);
            });
        }

        clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => {
            if (!this.isPlaying) return;

            this.watchedSeconds++;
            const remaining = Math.max(0, this.requiredSeconds - this.watchedSeconds);

            if (this.onProgressCallback) {
                this.onProgressCallback({
                    watched: this.watchedSeconds,
                    required: this.requiredSeconds,
                    remaining,
                    percent: Math.min(100, Math.round((this.watchedSeconds / this.requiredSeconds) * 100))
                });
            }

            if (this.watchedSeconds >= this.requiredSeconds) {
                this.finishAd();
            }
        }, 1000);
    }

    /**
     * Integración con el SDK Oficial de Google IMA (AdSense for Video)
     */
    playGoogleImaAd(videoElement, imaContainerElement) {
        try {
            imaContainerElement.classList.remove('hidden');
            if (this.adDisplayContainerIMA) {
                this.adDisplayContainerIMA.destroy();
            }

            this.adDisplayContainerIMA = new window.google.ima.AdDisplayContainer(imaContainerElement, videoElement);
            this.adDisplayContainerIMA.initialize();

            this.adsLoaderIMA = new window.google.ima.AdsLoader(this.adDisplayContainerIMA);

            this.adsLoaderIMA.addEventListener(
                window.google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED,
                (adsManagerLoadedEvent) => {
                    const adsRenderingSettings = new window.google.ima.AdsRenderingSettings();
                    adsRenderingSettings.restoreCustomPlaybackStateOnAdBreakComplete = true;

                    this.adsManagerIMA = adsManagerLoadedEvent.getAdsManager(videoElement, adsRenderingSettings);

                    this.adsManagerIMA.addEventListener(window.google.ima.AdEvent.Type.COMPLETE, () => {
                        this.finishAd();
                    });

                    this.adsManagerIMA.addEventListener(window.google.ima.AdEvent.Type.SKIPPED, () => {
                        this.finishAd();
                    });

                    this.adsManagerIMA.addEventListener(window.google.ima.AdErrorEvent.Type.AD_ERROR, (adErrorEvent) => {
                        console.warn('[IMA] Error de Google Ads:', adErrorEvent.getError());
                        this.fallbackToHtml5Video(videoElement, imaContainerElement);
                    });

                    try {
                        this.adsManagerIMA.init(640, 360, window.google.ima.ViewMode.NORMAL);
                        this.adsManagerIMA.start();
                    } catch (adError) {
                        this.fallbackToHtml5Video(videoElement, imaContainerElement);
                    }
                },
                false
            );

            this.adsLoaderIMA.addEventListener(
                window.google.ima.AdErrorEvent.Type.AD_ERROR,
                (adErrorEvent) => {
                    console.warn('[IMA] AdsLoader Error:', adErrorEvent.getError());
                    this.fallbackToHtml5Video(videoElement, imaContainerElement);
                },
                false
            );

            const adsRequest = new window.google.ima.AdsRequest();
            adsRequest.adTagUrl = ADS_CONFIG.googleImaTagUrl;
            adsRequest.linearAdSlotWidth = 640;
            adsRequest.linearAdSlotHeight = 360;

            this.adsLoaderIMA.requestAds(adsRequest);
        } catch (err) {
            console.error('[IMA] Error al inicializar Google IMA:', err);
            this.fallbackToHtml5Video(videoElement, imaContainerElement);
        }
    }

    /**
     * Conmutación automática a reproductor HTML5 si Google IMA no tiene relleno
     */
    fallbackToHtml5Video(videoElement, imaContainerElement) {
        if (imaContainerElement) imaContainerElement.classList.add('hidden');
        this.mode = 'vast';
        this.startAdPlayback({
            videoElement,
            imaContainerElement,
            onProgress: this.onProgressCallback,
            onComplete: this.onCompleteCallback,
            onError: this.onErrorCallback
        });
    }

    cancelAd() {
        this.isPlaying = false;
        clearInterval(this.timerInterval);
        if (this.adsManagerIMA) {
            try { this.adsManagerIMA.destroy(); } catch (e) {}
        }
        this.watchedSeconds = 0;
    }

    async finishAd() {
        this.isPlaying = false;
        clearInterval(this.timerInterval);

        try {
            const response = await apiFetch('/api/user/reward', {
                method: 'POST',
                body: JSON.stringify({
                    watchedSeconds: this.watchedSeconds || 5,
                    adId: this.currentAd ? this.currentAd.id : 'vast_or_ima_ad'
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (this.onCompleteCallback) {
                    this.onCompleteCallback(data);
                }
            } else {
                throw new Error('Error al validar la recompensa en el servidor.');
            }
        } catch (error) {
            console.error('Ad finish error:', error);
            if (this.onErrorCallback) {
                this.onErrorCallback(error);
            }
        }
    }
}

export const adManager = new RewardedAdManager();
