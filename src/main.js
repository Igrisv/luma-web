import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import './style.css';
import { getSession, initAuthUI, onAuthStateChange, signOut } from './services/auth.js';
import { initBillingUI, getBillingStatus, updateTierBadge } from './services/billing.js';
import { setTier, applyTierGating, canUseArchetype } from './services/tierGate.js';
import { initChat } from './components/chat.js';

// Expose tier gate helpers globally
window.__tierGate = { canUseArchetype };

async function initApp() {
    initAuthUI();
    initBillingUI();

    const session = await getSession();

    if (!session) {
        const authModal = document.getElementById('auth-modal');
        if (authModal) authModal.classList.remove('hidden');
        return;
    }

    await startApp();
}

let appStarted = false;
async function startApp() {
    if (appStarted) return;
    appStarted = true;

    try {
        const billing = await getBillingStatus();
        window.lumaDailyCount = billing.dailyMessageCount || 0;
        setTier(billing.tier || 'free');
        updateTierBadge(billing.tier || 'free');
    } catch (e) {
        console.error('Billing status error:', e);
        setTier('free');
        updateTierBadge('free');
    }

    initChat();

    setTimeout(() => applyTierGating(), 100);

    init3D();

    function applyAutoNightMode() {
        const hour = new Date().getHours();
        const root = document.documentElement;
        
        if (hour >= 22 || hour < 6) {
            root.style.setProperty('--luma-bg-overlay', 'rgba(10, 5, 20, 0.85)');
            root.style.setProperty('--luma-accent-glow', '#6d28d9');
            root.style.setProperty('--luma-text-dim', '0.7');
            document.body.classList.add('luma-night');
            document.body.classList.remove('luma-evening');
        } else if (hour >= 18 && hour < 22) {
            root.style.setProperty('--luma-bg-overlay', 'rgba(15, 10, 30, 0.6)');
            root.style.setProperty('--luma-accent-glow', '#8b5cf6');
            root.style.setProperty('--luma-text-dim', '0.85');
            document.body.classList.add('luma-evening');
            document.body.classList.remove('luma-night');
        } else {
            root.style.removeProperty('--luma-bg-overlay');
            root.style.removeProperty('--luma-accent-glow');
            root.style.removeProperty('--luma-text-dim');
            document.body.classList.remove('luma-night', 'luma-evening');
        }
    }
    applyAutoNightMode();
    setInterval(applyAutoNightMode, 600000);
}

onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
        const authModal = document.getElementById('auth-modal');
        if (authModal) authModal.classList.add('hidden');
        await startApp();
    } else if (event === 'SIGNED_OUT') {
        window.location.reload();
    }
});

const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await signOut();
        window.location.reload();
    });
}

function init3D() {
    const container = document.getElementById('canvas-container');
    if (!container) return;
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 1.5, 3);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 1, 0);
    controls.maxPolarAngle = Math.PI / 2 + 0.2;
    controls.minDistance = 1;
    controls.maxDistance = 5;
    controls.enablePan = false;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(5, 5, 5);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x8b5cf6, 0.5);
    fillLight.position.set(-5, 0, -5);
    scene.add(fillLight);

    window.addEventListener('emotionsChanged', (e) => {
        const { afinidad, enojo } = e.detail;
        const enojoFactor = enojo / 100;
        const baseLightIntensity = 1.2 - (enojoFactor * 0.8);
        const colorHex = new THREE.Color().setHSL(0.0, 1.0, 1.0 - (enojoFactor * 0.5));
        dirLight.color.copy(colorHex);
        dirLight.intensity = baseLightIntensity;

        const afFactor = afinidad / 100;
        const fillHex = new THREE.Color().setHSL(0.8, afFactor, 0.5);
        fillLight.color.copy(fillHex);
        fillLight.intensity = 0.2 + (afFactor * 0.6);
    });

    window.addEventListener('userTyping', (e) => {
        const len = Math.min(e.detail.length, 100);
        const typingFactor = len / 100;
        dirLight.position.set(5 - (typingFactor * 2), 5, 5 + (typingFactor));
    });

    const loader = new GLTFLoader();
    const modeloUrl = '/avatar.glb';
    let currentModel = null;

    loader.load(
        modeloUrl,
        (gltf) => {
            currentModel = gltf.scene;
            currentModel.position.set(0, 0, 0);
            scene.add(currentModel);
        },
        undefined,
        () => {}
    );

    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }
    animate();
}

initApp();
