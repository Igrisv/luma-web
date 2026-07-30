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

    const initialWidth = container.clientWidth || window.innerWidth;
    const initialHeight = container.clientHeight || window.innerHeight;

    const camera = new THREE.PerspectiveCamera(45, initialWidth / initialHeight, 0.1, 100);
    camera.position.set(0, 1.25, 2.8);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(initialWidth, initialHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 0.9, 0);
    controls.maxPolarAngle = Math.PI / 2 + 0.15;
    controls.minDistance = 1.0;
    controls.maxDistance = 6.0;
    controls.enablePan = false;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
    dirLight.position.set(4, 5, 4);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x8b5cf6, 0.6);
    fillLight.position.set(-4, 2, -3);
    scene.add(fillLight);

    const rimLight = new THREE.PointLight(0x38bdf8, 1.2, 10);
    rimLight.position.set(0, 2.5, -2);
    scene.add(rimLight);

    // Glowing Stage Ring
    const stageGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.03, 64);
    const stageMat = new THREE.MeshStandardMaterial({
        color: 0x11131f,
        roughness: 0.2,
        metalness: 0.8,
        emissive: 0x8b5cf6,
        emissiveIntensity: 0.35
    });
    const stageMesh = new THREE.Mesh(stageGeo, stageMat);
    stageMesh.position.set(0, -0.015, 0);
    scene.add(stageMesh);

    // Dynamic Emotion Lighting Listener
    window.addEventListener('emotionsChanged', (e) => {
        const { afinidad = 60, enojo = 0 } = (e && e.detail) || {};
        const enojoFactor = enojo / 100;
        const baseLightIntensity = 1.4 - (enojoFactor * 0.8);
        const colorHex = new THREE.Color().setHSL(0.0, 1.0, 1.0 - (enojoFactor * 0.5));
        dirLight.color.copy(colorHex);
        dirLight.intensity = baseLightIntensity;

        const afFactor = afinidad / 100;
        const fillHex = new THREE.Color().setHSL(0.78, afFactor, 0.55);
        fillLight.color.copy(fillHex);
        fillLight.intensity = 0.3 + (afFactor * 0.7);
        rimLight.color.setHSL(0.55 + (afFactor * 0.2), 0.9, 0.6);
    });

    window.addEventListener('userTyping', (e) => {
        const len = Math.min((e && e.detail && e.detail.length) || 0, 100);
        const typingFactor = len / 100;
        dirLight.position.set(4 - (typingFactor * 2), 5, 4 + typingFactor);
    });

    // 3D Model Loading & Procedural Avatar Fallback
    const loader = new GLTFLoader();
    const modeloUrl = '/avatar.glb';
    let currentModel = null;
    let isProcedural = false;

    function createProceduralAvatar() {
        const avatarGroup = new THREE.Group();

        // Head
        const headGeo = new THREE.SphereGeometry(0.32, 32, 32);
        const matCyber = new THREE.MeshStandardMaterial({
            color: 0xa78bfa,
            roughness: 0.15,
            metalness: 0.85,
            emissive: 0x6d28d9,
            emissiveIntensity: 0.45
        });
        const head = new THREE.Mesh(headGeo, matCyber);
        head.position.set(0, 1.4, 0);
        avatarGroup.add(head);

        // Visor / Eyes
        const visorGeo = new THREE.BoxGeometry(0.42, 0.1, 0.28);
        const matVisor = new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            roughness: 0.1,
            metalness: 0.9,
            emissive: 0x06b6d4,
            emissiveIntensity: 0.85
        });
        const visor = new THREE.Mesh(visorGeo, matVisor);
        visor.position.set(0, 1.42, 0.18);
        avatarGroup.add(visor);

        // Body / Torso
        const bodyGeo = new THREE.CylinderGeometry(0.24, 0.38, 0.95, 32);
        const body = new THREE.Mesh(bodyGeo, matCyber);
        body.position.set(0, 0.65, 0);
        avatarGroup.add(body);

        // Halo Ring
        const haloGeo = new THREE.TorusGeometry(0.55, 0.02, 16, 64);
        const matHalo = new THREE.MeshStandardMaterial({
            color: 0xec4899,
            emissive: 0xf43f5e,
            emissiveIntensity: 0.9
        });
        const halo = new THREE.Mesh(haloGeo, matHalo);
        halo.rotation.x = Math.PI / 2;
        halo.position.set(0, 1.4, 0);
        avatarGroup.add(halo);

        scene.add(avatarGroup);
        currentModel = avatarGroup;
        isProcedural = true;
    }

    // Main 3D Model Processing Helpers
    function setupMainGLTFMaterial(mat) {
        if (!mat) return;
        mat.side = THREE.DoubleSide;
        mat.color.setHex(0xffffff);
        if (mat.isMeshStandardMaterial) {
            mat.roughness = 0.75;
            mat.metalness = 0.05;
        }
        if (mat.map) {
            mat.map.colorSpace = THREE.SRGBColorSpace;
            mat.map.anisotropy = 16;
            mat.map.needsUpdate = true;
        }
        mat.transparent = true;
        mat.alphaTest = 0.15;
        mat.depthWrite = true;
        mat.needsUpdate = true;
    }

    function filterMainGLTF(gltfScene) {
        if (!gltfScene) return;
        const skinnedMeshes = [];
        const allMeshes = [];
        gltfScene.traverse((child) => {
            if (child.isMesh) {
                allMeshes.push(child);
                if (child.isSkinnedMesh) skinnedMeshes.push(child);
            }
        });

        if (skinnedMeshes.length > 0) {
            const charBox = new THREE.Box3();
            skinnedMeshes.forEach(sm => charBox.expandByObject(sm));
            const charCenter = charBox.getCenter(new THREE.Vector3());
            const charSize = charBox.getSize(new THREE.Vector3());
            const maxCharDim = Math.max(charSize.x, charSize.y, charSize.z);

            allMeshes.forEach(mesh => {
                if (!mesh.isSkinnedMesh) {
                    const mBox = new THREE.Box3().setFromObject(mesh);
                    const mCenter = mBox.getCenter(new THREE.Vector3());
                    const mSize = mBox.getSize(new THREE.Vector3());
                    const mMaxDim = Math.max(mSize.x, mSize.y, mSize.z);
                    if (mCenter.distanceTo(charCenter) > maxCharDim * 0.4 || mMaxDim > maxCharDim * 0.75) {
                        mesh.visible = false;
                    }
                }
            });
        }
    }

    function getMainVisibleBox(obj) {
        const box = new THREE.Box3();
        if (!obj) return box;
        obj.updateMatrixWorld(true);
        obj.traverse((child) => {
            if (child.isMesh && child.visible) {
                if (child.geometry) {
                    if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
                    const childBox = child.geometry.boundingBox.clone();
                    childBox.applyMatrix4(child.matrixWorld);
                    box.union(childBox);
                }
            }
        });
        return box;
    }

    function centerMainModel(model) {
        if (!model || !camera || !controls) return;
        model.rotation.y = 0;
        model.scale.set(1, 1, 1);
        model.position.set(0, 0, 0);
        model.updateMatrixWorld(true);

        let box = getMainVisibleBox(model);
        if (box.isEmpty()) box = new THREE.Box3().setFromObject(model);

        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);

        if (maxDim > 0) {
            const scaleFactor = 2.4 / maxDim;
            model.scale.set(scaleFactor, scaleFactor, scaleFactor);
            model.updateMatrixWorld(true);
        }

        const scaledBox = getMainVisibleBox(model);
        const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
        const scaledSize = scaledBox.getSize(new THREE.Vector3());

        model.position.x = -scaledCenter.x;
        model.position.y = -scaledCenter.y;
        model.position.z = -scaledCenter.z;
        model.updateMatrixWorld(true);

        controls.target.set(0, scaledSize.y * 0.1, 0);
        camera.position.set(0, scaledSize.y * 0.15, 2.5);
        camera.lookAt(0, scaledSize.y * 0.1, 0);
        controls.update();
    }

    function cloneMaterialWithTextures(mat) {
        if (!mat) return mat;
        let newMat;
        try {
            newMat = mat.clone ? mat.clone() : mat;
        } catch (e) {
            return mat;
        }
        if (!newMat) return mat;

        newMat.side = THREE.DoubleSide;
        if (mat.color && newMat.color && newMat.color.copy) newMat.color.copy(mat.color);

        if (mat.map && typeof mat.map.clone === 'function') {
            try {
                newMat.map = mat.map.clone();
                newMat.map.colorSpace = THREE.SRGBColorSpace;
                newMat.map.needsUpdate = true;
            } catch (e) { newMat.map = mat.map; }
        } else if (mat.map) {
            newMat.map = mat.map;
        }

        if (mat.normalMap && typeof mat.normalMap.clone === 'function') {
            try {
                newMat.normalMap = mat.normalMap.clone();
                newMat.normalMap.needsUpdate = true;
            } catch (e) { newMat.normalMap = mat.normalMap; }
        } else if (mat.normalMap) {
            newMat.normalMap = mat.normalMap;
        }

        if (mat.roughnessMap && typeof mat.roughnessMap.clone === 'function') {
            try {
                newMat.roughnessMap = mat.roughnessMap.clone();
                newMat.roughnessMap.needsUpdate = true;
            } catch (e) { newMat.roughnessMap = mat.roughnessMap; }
        } else if (mat.roughnessMap) {
            newMat.roughnessMap = mat.roughnessMap;
        }

        if (mat.metalnessMap && typeof mat.metalnessMap.clone === 'function') {
            try {
                newMat.metalnessMap = mat.metalnessMap.clone();
                newMat.metalnessMap.needsUpdate = true;
            } catch (e) { newMat.metalnessMap = mat.metalnessMap; }
        } else if (mat.metalnessMap) {
            newMat.metalnessMap = mat.metalnessMap;
        }

        if (newMat.isMeshStandardMaterial) {
            newMat.roughness = 0.75;
            newMat.metalness = 0.05;
        }
        newMat.transparent = true;
        newMat.alphaTest = 0.15;
        newMat.depthWrite = true;
        newMat.needsUpdate = true;

        return newMat;
    }

    function deepCloneModelForMain(srcModel) {
        if (!srcModel) return null;
        let clonedGroup;
        try {
            clonedGroup = srcModel.clone(true);
        } catch (e) {
            return srcModel;
        }

        clonedGroup.traverse((child) => {
            if (child.isMesh && child.material) {
                try {
                    if (Array.isArray(child.material)) {
                        child.material = child.material.map(m => cloneMaterialWithTextures(m));
                    } else {
                        child.material = cloneMaterialWithTextures(child.material);
                    }
                } catch (e) { console.warn('[3D] Material cloning error:', e); }
            }
        });

        return clonedGroup;
    }

    function disposeHierarchy(obj) {
        if (!obj) return;
        obj.traverse((child) => {
            if (child.isMesh) {
                if (child.geometry && typeof child.geometry.dispose === 'function') child.geometry.dispose();
                if (child.material) {
                    const mats = Array.isArray(child.material) ? child.material : [child.material];
                    mats.forEach(mat => {
                        if (!mat) return;
                        if (mat.map && typeof mat.map.dispose === 'function') mat.map.dispose();
                        if (mat.normalMap && typeof mat.normalMap.dispose === 'function') mat.normalMap.dispose();
                        if (mat.roughnessMap && typeof mat.roughnessMap.dispose === 'function') mat.roughnessMap.dispose();
                        if (mat.metalnessMap && typeof mat.metalnessMap.dispose === 'function') mat.metalnessMap.dispose();
                        if (typeof mat.dispose === 'function') mat.dispose();
                    });
                }
            }
        });
    }

    // Global listener for loading custom character 3D models into main chat background
    window.addEventListener('loadCharacterModel', (e) => {
        const { model3d_url, model } = (e && e.detail) || {};
        if (currentModel) {
            disposeHierarchy(currentModel);
            scene.remove(currentModel);
            currentModel = null;
        }

        const sourceModel = model || window.lumaActiveModelScene;

        if (sourceModel) {
            currentModel = deepCloneModelForMain(sourceModel);
            filterMainGLTF(currentModel);
            scene.add(currentModel);
            centerMainModel(currentModel);
            isProcedural = false;
        } else if (model3d_url) {
            loader.load(
                model3d_url,
                (gltf) => {
                    currentModel = gltf.scene;
                    filterMainGLTF(currentModel);
                    currentModel.traverse(child => {
                        if (child.isMesh && child.material) {
                            try {
                                if (Array.isArray(child.material)) {
                                    child.material = child.material.map(m => cloneMaterialWithTextures(m));
                                } else {
                                    child.material = cloneMaterialWithTextures(child.material);
                                }
                            } catch (err) { console.warn('[3D] Texture map cloning error:', err); }
                        }
                    });
                    scene.add(currentModel);
                    centerMainModel(currentModel);
                    isProcedural = false;
                },
                undefined,
                () => { createProceduralAvatar(); }
            );
        } else {
            createProceduralAvatar();
        }
    });

    loader.load(
        modeloUrl,
        (gltf) => {
            currentModel = gltf.scene;
            currentModel.position.set(0, 0, 0);
            scene.add(currentModel);
        },
        undefined,
        () => {
            console.log('[3D] Inicializando avatar 3D procedural de demostración...');
            createProceduralAvatar();
        }
    );

    // Resize Observer for 3D Viewport
    const resizeObserver = new ResizeObserver(() => {
        if (!container) return;
        const w = container.clientWidth || window.innerWidth;
        const h = container.clientHeight || window.innerHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    // 3D View Toggle Listener
    const toggle3dBtn = document.getElementById('toggle3dBtn');
    const mode3dStatus = document.getElementById('mode3dStatus');
    if (toggle3dBtn) {
        toggle3dBtn.addEventListener('click', () => {
            const isHidden = container.classList.toggle('hidden-3d');
            if (mode3dStatus) {
                mode3dStatus.textContent = isHidden ? 'OFF' : 'ON';
            }
        });
    }

    // Main 3D Stage Interactive Camera Framing Presets (Smooth Interpolated Lerp)
    let framingAnimationId = null;

    function applyMainFramingMode(mode = 'torso', duration = 350) {
        if (!camera || !controls) return;
        const h = 2.4;
        const fitD = 2.5;

        let targetY = h * 0.1;
        let camY = h * 0.15;
        let camZ = fitD * 0.85;

        if (mode === 'face') {
            targetY = h * 0.35;
            camY = h * 0.35;
            camZ = fitD * 0.45;
        } else if (mode === 'body') {
            targetY = -h * 0.05;
            camY = -h * 0.05;
            camZ = fitD * 1.25;
        }

        const startTargetY = controls.target.y;
        const startCamY = camera.position.y;
        const startCamZ = camera.position.z;
        const startTime = performance.now();

        if (framingAnimationId) cancelAnimationFrame(framingAnimationId);

        function step(now) {
            const elapsed = now - startTime;
            const progress = Math.min(1, elapsed / duration);
            const ease = 1 - Math.pow(1 - progress, 3);

            controls.target.set(0, startTargetY + (targetY - startTargetY) * ease, 0);
            camera.position.set(0, startCamY + (camY - startCamY) * ease, startCamZ + (camZ - startCamZ) * ease);
            camera.lookAt(controls.target);
            controls.update();

            if (progress < 1) {
                framingAnimationId = requestAnimationFrame(step);
            }
        }

        framingAnimationId = requestAnimationFrame(step);
    }

    const btnMainFace = document.getElementById('mainZoomFace');
    const btnMainTorso = document.getElementById('mainZoomTorso');
    const btnMainBody = document.getElementById('mainZoomBody');

    function setActiveMainFramingBtn(activeBtn) {
        [btnMainFace, btnMainTorso, btnMainBody].forEach(b => {
            if (b) b.classList.remove('active');
        });
        if (activeBtn) activeBtn.classList.add('active');
    }

    if (btnMainFace) {
        btnMainFace.addEventListener('click', () => {
            setActiveMainFramingBtn(btnMainFace);
            applyMainFramingMode('face');
        });
    }
    if (btnMainTorso) {
        btnMainTorso.addEventListener('click', () => {
            setActiveMainFramingBtn(btnMainTorso);
            applyMainFramingMode('torso');
        });
    }
    if (btnMainBody) {
        btnMainBody.addEventListener('click', () => {
            setActiveMainFramingBtn(btnMainBody);
            applyMainFramingMode('body');
        });
    }

    // Animation Loop
    const startTime = performance.now();
    function animate() {
        requestAnimationFrame(animate);
        const elapsedTime = (performance.now() - startTime) * 0.001;

        if (currentModel) {
            currentModel.position.y = Math.sin(elapsedTime * 1.5) * 0.03;
            if (isProcedural) {
                currentModel.rotation.y = Math.sin(elapsedTime * 0.5) * 0.15;
            }
        }

        controls.update();
        renderer.render(scene, camera);
    }
    animate();
}

initApp();
