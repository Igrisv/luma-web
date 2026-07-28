// ═══════════════════════════════════════════════════════════
// wizard.js — Magic Bot Studio (Dopaminergic Character Creator)
// ═══════════════════════════════════════════════════════════
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { canUseArchetype, canCreateCustomBot, getTier } from '../services/tierGate.js';
import { playPopSound, playWhooshSound, playClickDropSound } from './ui.js';

export function initCreatorWizard(onSaveCharacter, showToast) {
    let currentStep = 1;

    const step1 = document.getElementById('wizardStep1');
    const step2 = document.getElementById('wizardStep2');
    const step3 = document.getElementById('wizardStep3');
    const step4 = document.getElementById('wizardStep4');

    const ind1 = document.getElementById('stepInd1');
    const ind2 = document.getElementById('stepInd2');
    const ind3 = document.getElementById('stepInd3');
    const ind4 = document.getElementById('stepInd4');

    const nextBtn = document.getElementById('nextWizardStepBtn');
    const prevBtn = document.getElementById('prevWizardStepBtn');
    const saveBtn = document.getElementById('saveCharacterBtn');

    // Pre-built Magic Concept Templates with First-Person Monologues
    const magicTemplates = {
        gamer: {
            name: 'Alex',
            age: 21,
            tagline: 'Streamer competitiva y perspicaz',
            avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=500&auto=format&fit=crop&q=80',
            archetype: 'rival',
            firstMsg: 'Tenía un espacio en la sala y pensé que podrías sostener una buena partida. ¿Entras o tienes miedo?',
            prompt: 'Me llamo Alex. Tengo 21 años. Soy competitiva, sagaz y directa. Me apasionan los videojuegos y el debate agudo. Hablo de forma humana, analítica y espontánea. NUNCA admitiré que soy una IA.',
            afinidad: 50, celos: 30, resentimiento: 10, ansiedad: 5
        },
        artista: {
            name: 'Luna',
            age: 22,
            tagline: 'Pintora soñadora y observadora',
            avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80',
            archetype: 'pareja',
            firstMsg: 'Estaba terminando un boceto y de pronto me acordé de algo que dijiste... ¿Tienes un momento?',
            prompt: 'Me llamo Luna. Tengo 22 años. Disfruto del arte, la fotografía análoga y las conversaciones pausadas pero profundas. Tono: Cálido y reflexivo. Hablo de forma natural y genuina. NUNCA admitiré que soy una IA.',
            afinidad: 80, celos: 15, resentimiento: 0, ansiedad: 10
        },
        toxica: {
            name: 'Clara',
            age: 21,
            tagline: 'Directa, irónica y observadora',
            avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=500&auto=format&fit=crop&q=80',
            archetype: 'amigaToxica',
            firstMsg: 'Por fin te apareces... Supongo que tienes una buena justificación para la demora.',
            prompt: 'Me llamo Clara. Tengo 21 años. Tono irónico, directo y firme, pero con lealtad genuina hacia quienes valoro. Hablo con soltura y franqueza. NUNCA admitiré que soy una IA.',
            afinidad: 60, celos: 65, resentimiento: 25, ansiedad: 35
        },
        barista: {
            name: 'Maya',
            age: 23,
            tagline: 'Barista atenta y confidente',
            avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500&auto=format&fit=crop&q=80',
            archetype: 'mejorAmigo',
            firstMsg: '¡Hola! Justo estaba haciendo una pausa para el café. ¿Qué tal ha ido tu jornada?',
            prompt: 'Me llamo Maya. Tengo 23 años. Soy tu apoyo incondicional y confidente diaria. Escucho activamente y respondo con empatía. NUNCA admitiré que soy una IA.',
            afinidad: 85, celos: 5, resentimiento: 0, ansiedad: 0
        }
    };

    // ── Local File Upload Handler ───────────────────────────
    const avatarFileInput = document.getElementById('avatarFileInput');
    if (avatarFileInput) {
        avatarFileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                handleAvatarFile(e.target.files[0]);
            }
        });
    }

    function handleAvatarFile(file) {
        if (!file.type.startsWith('image/')) {
            if (showToast) showToast('Por favor selecciona un archivo de imagen (.png, .jpg, .webp).', 'warning');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target.result;
            const urlInput = document.getElementById('createAvatarUrl');
            if (urlInput) urlInput.value = dataUrl;

            const previewImg = document.getElementById('previewAvatarImg');
            if (previewImg) previewImg.src = dataUrl;

            const cropperImg = document.getElementById('cropperImg');
            if (cropperImg) cropperImg.src = dataUrl;
            if (typeof resetCropperState === 'function') resetCropperState();

            const grid = document.getElementById('avatarPresetsGrid');
            if (grid) {
                grid.querySelectorAll('.avatar-preset-item').forEach(i => i.classList.remove('active'));
                let customItem = document.getElementById('customUploadedPreset');
                if (!customItem) {
                    customItem = document.createElement('img');
                    customItem.id = 'customUploadedPreset';
                    customItem.className = 'avatar-preset-item active';
                    customItem.title = '📸 Tu Foto Subida';
                    grid.prepend(customItem);

                    customItem.addEventListener('click', () => {
                        playPopSound();
                        document.querySelectorAll('.avatar-preset-item').forEach(i => i.classList.remove('active'));
                        customItem.classList.add('active');
                        if (urlInput) urlInput.value = customItem.dataset.url;
                        if (previewImg) previewImg.src = customItem.dataset.url;
                    });
                } else {
                    customItem.classList.add('active');
                }
                customItem.src = dataUrl;
                customItem.dataset.url = dataUrl;
            }

            playPopSound();
            if (showToast) showToast('Foto personalizada cargada y seleccionada 🖼️', 'success');
        };
        reader.readAsDataURL(file);
    }

    // ── Live Monologue Auto-Assembler ──────────────────────────
    function autoAssembleMonologue() {
        const name = document.getElementById('createName')?.value.trim() || 'Clara';
        const age = document.getElementById('createAge')?.value || '21';
        const archetypeKey = document.getElementById('createArchetype')?.value || 'pareja';
        const matizHumor = document.getElementById('createMatizHumor')?.value || 'Sarcástica & Sagaz';
        const chatStyle = document.getElementById('createChatStyle')?.value || 'Directa & Frases Cortas';
        const sharedSecret = document.getElementById('createSharedSecret')?.value.trim() || '';
        
        const selectedTraits = [];
        document.querySelectorAll('.trait-chip.active').forEach(chip => {
            if (chip.dataset.trait) selectedTraits.push(chip.dataset.trait);
        });

        const archetypePhrases = {
            pareja: 'Tengo química real contigo y me alegra hablarte, pero si me ignoras me pico. No soy empalagosa.',
            amigaToxica: 'Te llamo a deshoras para contarte un chisme... Pero si alguien habla mal de ti, soy la primera en defenderte.',
            rival: 'No soporto quedar por debajo de nadie, y menos de ti. Te desafío constantemente, pero busco tu respeto.',
            ex: 'Hay una tensión no resuelta entre nosotros. Finjo distancia, pero aún recuerdo cada detalle del pasado.',
            mejorAmigo: 'Soy tu apoyo incondicional. Conmigo puedes hablar de cualquier tontería o problema sin juzgarte.'
        };

        const phrase = archetypePhrases[archetypeKey] || archetypePhrases.pareja;
        const traitsText = selectedTraits.length > 0 ? ` Mis gustos y rasgos: ${selectedTraits.join(', ')}.` : '';
        const secretText = sharedSecret ? ` Secreto/Recuerdo: ${sharedSecret}.` : '';
        const styleText = ` Estilo: ${chatStyle}.`;

        const promptText = `Me llamo ${name}. Tengo ${age} años. ${phrase} Tono: ${matizHumor}.${traitsText}${secretText}${styleText} Hablo de forma humana, directa y espontánea. NUNCA admitiré que soy una IA.`;

        const systemPromptTextarea = document.getElementById('createSystemPrompt');
        if (systemPromptTextarea) {
            systemPromptTextarea.value = promptText;
        }
    }

    // Add Custom Trait Chip Handler
    const addCustomTraitBtn = document.getElementById('addCustomTraitBtn');
    const addCustomTraitInput = document.getElementById('addCustomTraitInput');
    if (addCustomTraitBtn && addCustomTraitInput) {
        addCustomTraitBtn.addEventListener('click', () => {
            const val = addCustomTraitInput.value.trim();
            if (val) {
                const traitGrid = document.getElementById('traitChipsGrid');
                if (traitGrid) {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'trait-chip active';
                    btn.dataset.trait = val;
                    btn.innerHTML = `✨ ${val}`;
                    btn.addEventListener('click', () => {
                        playPopSound();
                        btn.classList.toggle('active');
                        autoAssembleMonologue();
                    });
                    traitGrid.appendChild(btn);
                    addCustomTraitInput.value = '';
                    playPopSound();
                    autoAssembleMonologue();
                }
            }
        });
    }

    document.querySelectorAll('.trait-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            playPopSound();
            chip.classList.toggle('active');
            autoAssembleMonologue();
        });
    });

    const matizHumorSelect = document.getElementById('createMatizHumor');
    if (matizHumorSelect) {
        matizHumorSelect.addEventListener('change', () => {
            playPopSound();
            const selectedMatiz = matizHumorSelect.value;
            
            // Recommend & activate traits matching the selected tone
            document.querySelectorAll('.trait-chip').forEach(chip => {
                const trait = chip.dataset.trait || chip.textContent.trim();
                const isMatch = (
                    (selectedMatiz.includes('Dulce') && (trait.includes('café') || trait.includes('Lectora') || trait.includes('Música') || trait.includes('casera'))) ||
                    (selectedMatiz.includes('Sarcástica') || selectedMatiz.includes('Directa')) && (trait.includes('Filtro') || trait.includes('chisme') || trait.includes('Gamer') || trait.includes('pizza')) ||
                    (selectedMatiz.includes('Competitiva') || selectedMatiz.includes('Orgullosa')) && (trait.includes('Orgullo') || trait.includes('Gamer') || trait.includes('perder') || trait.includes('Apuestas')) ||
                    (selectedMatiz.includes('Melancólica') || selectedMatiz.includes('Nostálgica')) && (trait.includes('pasado') || trait.includes('tristes') || trait.includes('nostalgia') || trait.includes('viejas')) ||
                    (selectedMatiz.includes('Confidente') || selectedMatiz.includes('Leal')) && (trait.includes('Lealtad') || trait.includes('pizza') || trait.includes('café') || trait.includes('Discord'))
                );
                if (isMatch) chip.classList.add('active');
            });
            autoAssembleMonologue();
        });
    }

    ['createName', 'createAge', 'createChatStyle', 'createSharedSecret'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', autoAssembleMonologue);
    });

    const randomNameBtn = document.getElementById('randomNameBtn');
    if (randomNameBtn) {
        randomNameBtn.addEventListener('click', () => {
            playPopSound();
            const names = ['Camila', 'Kael', 'Luna', 'Alex', 'Valeria', 'Mateo', 'Sofía', 'Bruno', 'Maya', 'Dante'];
            const randomName = names[Math.floor(Math.random() * names.length)];
            const createNameInp = document.getElementById('createName');
            if (createNameInp) {
                createNameInp.value = randomName;
                autoAssembleMonologue();
            }
        });
    }

    // Magic Auto-Generate Button & Concept Chips
    function applyMagicTemplate(tpl) {
        if (!tpl) return;
        playPopSound();

        const nameInp = document.getElementById('createName');
        const ageInp = document.getElementById('createAge');
        const taglineInp = document.getElementById('createTagline');
        const avatarInp = document.getElementById('createAvatarUrl');
        const firstMsgInp = document.getElementById('createFirstMessage');
        const promptInp = document.getElementById('createSystemPrompt');
        const archetypeInp = document.getElementById('createArchetype');

        if (nameInp) nameInp.value = tpl.name;
        if (ageInp && tpl.age) ageInp.value = tpl.age;
        if (taglineInp) taglineInp.value = tpl.tagline;
        if (avatarInp) avatarInp.value = tpl.avatar;
        if (firstMsgInp) firstMsgInp.value = tpl.firstMsg;
        if (promptInp) promptInp.value = tpl.prompt;
        if (archetypeInp) archetypeInp.value = tpl.archetype;

        document.querySelectorAll('.archetype-select-card').forEach(card => {
            card.classList.toggle('selected', card.dataset.archetype === tpl.archetype);
        });

        const afinidadSlider = document.getElementById('createAfinidad');
        const celosSlider = document.getElementById('createCelos');
        const resentamientoSlider = document.getElementById('createResentimiento');
        const ansiedadSlider = document.getElementById('createAnsiedad');

        if (afinidadSlider) { afinidadSlider.value = tpl.afinidad; document.getElementById('valCreateAfinidad').textContent = tpl.afinidad; }
        if (celosSlider) { celosSlider.value = tpl.celos; document.getElementById('valCreateCelos').textContent = tpl.celos; }
        if (resentamientoSlider) { resentamientoSlider.value = tpl.resentimiento; document.getElementById('valCreateResentimiento').textContent = tpl.resentimiento; }
        if (ansiedadSlider) { ansiedadSlider.value = tpl.ansiedad; document.getElementById('valCreateAnsiedad').textContent = tpl.ansiedad; }

        updateEmotionalDiagnosis();

        if (showToast) showToast(`✨ Personaje "${tpl.name}" generado mágicamente`, 'success');
    }

    document.querySelectorAll('.concept-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const key = chip.dataset.concept;
            applyMagicTemplate(magicTemplates[key]);
        });
    });

    const magicGenerateBtn = document.getElementById('magicGenerateBtn');
    if (magicGenerateBtn) {
        magicGenerateBtn.addEventListener('click', () => {
            const userIdea = document.getElementById('magicConceptInput').value.trim();
            if (userIdea) {
                const dynTpl = {
                    name: 'Kael',
                    age: 23,
                    tagline: userIdea.length > 40 ? userIdea.substring(0, 40) + '...' : userIdea,
                    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format&fit=crop&q=80',
                    archetype: 'pareja',
                    firstMsg: `¡Hola! Me alegra que me hayas creado. Cuéntame... ¿en qué pensabas cuando me diseñaste?`,
                    prompt: `Me llamo Kael. Tengo 23 años. Mi esencia es: ${userIdea}. Hablo en primera persona, con química real y entusiasmo.`,
                    afinidad: 75, celos: 20, resentimiento: 0, ansiedad: 10
                };
                applyMagicTemplate(dynTpl);
            } else {
                const keys = Object.keys(magicTemplates);
                const randomKey = keys[Math.floor(Math.random() * keys.length)];
                applyMagicTemplate(magicTemplates[randomKey]);
            }
        });
    }

    // Live Name & Tagline Inputs to Live Preview Card
    const nameInp = document.getElementById('createName');
    const taglineInp = document.getElementById('createTagline');
    const previewName = document.getElementById('previewCharacterName');
    const previewTagline = document.getElementById('previewCharacterTagline');

    if (nameInp) {
        nameInp.addEventListener('input', () => {
            if (previewName) previewName.textContent = nameInp.value.trim() || 'Sofía';
        });
    }
    if (taglineInp) {
        taglineInp.addEventListener('input', () => {
            if (previewTagline) previewTagline.textContent = taglineInp.value.trim() || 'Tu Pareja Cariñosa';
        });
    }

    // Direct URL Input Listener for Avatar Preview & Cropper
    const createAvatarUrlInp = document.getElementById('createAvatarUrl');
    if (createAvatarUrlInp) {
        createAvatarUrlInp.addEventListener('input', () => {
            const val = createAvatarUrlInp.value.trim();
            const previewImg = document.getElementById('previewAvatarImg');
            const cropperImg = document.getElementById('cropperImg');
            if (val) {
                if (previewImg) previewImg.src = val;
                if (cropperImg) cropperImg.src = val;
                resetCropperState();
            }
        });
    }

    // Avatar Presets Click Selection via Event Delegation
    const avatarGrid = document.getElementById('avatarPresetsGrid');
    if (avatarGrid) {
        avatarGrid.addEventListener('click', (e) => {
            const presetImg = e.target.closest('.avatar-preset-item');
            if (!presetImg) return;

            playPopSound();
            avatarGrid.querySelectorAll('.avatar-preset-item').forEach(i => i.classList.remove('active'));
            presetImg.classList.add('active');

            const url = presetImg.dataset.url || presetImg.src;
            const urlInput = document.getElementById('createAvatarUrl');
            if (urlInput) urlInput.value = url;

            const previewImg = document.getElementById('previewAvatarImg');
            if (previewImg) previewImg.src = url;

            const cropperImg = document.getElementById('cropperImg');
            if (cropperImg) cropperImg.src = url;
            resetCropperState();
        });
    }

    // ── Mini Three.js 3D Preview Stage ───────────────────────
    let miniScene, miniCamera, miniRenderer, miniControls, miniModel;

    function initMini3DPreview() {
        const container = document.getElementById('wizard3dPreviewContainer');
        if (!container || miniRenderer) return;
        container.innerHTML = '';

        miniScene = new THREE.Scene();
        const w = container.clientWidth || 260;
        const h = container.clientHeight || 150;

        miniCamera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
        miniCamera.position.set(0, 1.25, 2.7);

        miniRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        miniRenderer.setSize(w, h);
        miniRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(miniRenderer.domElement);

        miniControls = new OrbitControls(miniCamera, miniRenderer.domElement);
        miniControls.enableDamping = true;
        miniControls.dampingFactor = 0.05;
        miniControls.target.set(0, 0.8, 0);

        const ambLight = new THREE.AmbientLight(0xffffff, 0.7);
        miniScene.add(ambLight);

        const dLight = new THREE.DirectionalLight(0x8b5cf6, 1.3);
        dLight.position.set(3, 4, 3);
        miniScene.add(dLight);

        const rLight = new THREE.PointLight(0x38bdf8, 1.4, 8);
        rLight.position.set(-2, 2, -2);
        miniScene.add(rLight);

        createMiniProceduralAvatar();

        function miniAnimate() {
            requestAnimationFrame(miniAnimate);
            if (miniModel) {
                miniModel.rotation.y += 0.006;
            }
            miniControls.update();
            miniRenderer.render(miniScene, miniCamera);
        }
        miniAnimate();
    }

    function filterAndCenterGLTF(gltfScene) {
        if (!gltfScene) return;

        const skinnedMeshes = [];
        const allMeshes = [];

        gltfScene.traverse((child) => {
            if (child.isMesh) {
                allMeshes.push(child);
                if (child.isSkinnedMesh) {
                    skinnedMeshes.push(child);
                }
            }
        });

        // 1. If scene has SkinnedMeshes (character body/hair/clothes)
        if (skinnedMeshes.length > 0) {
            const charBox = new THREE.Box3();
            skinnedMeshes.forEach(sm => charBox.expandByObject(sm));
            const charCenter = charBox.getCenter(new THREE.Vector3());
            const charSize = charBox.getSize(new THREE.Vector3());
            const maxCharDim = Math.max(charSize.x, charSize.y, charSize.z);

            // Hide any static Mesh that is not a SkinnedMesh if it's large or far away (outer spheres/texture planes)
            allMeshes.forEach(mesh => {
                if (!mesh.isSkinnedMesh) {
                    const mBox = new THREE.Box3().setFromObject(mesh);
                    const mCenter = mBox.getCenter(new THREE.Vector3());
                    const mSize = mBox.getSize(new THREE.Vector3());
                    const mMaxDim = Math.max(mSize.x, mSize.y, mSize.z);

                    // If it's a floating sphere/card or huge plane around character, hide it!
                    if (mCenter.distanceTo(charCenter) > maxCharDim * 0.4 || mMaxDim > maxCharDim * 0.75) {
                        mesh.visible = false;
                    }
                }
            });
        } else if (allMeshes.length > 1) {
            // 2. If no SkinnedMesh, filter out giant sphere/plane background meshes
            allMeshes.forEach(mesh => {
                const nameLower = (mesh.name || '').toLowerCase();
                const matNameLower = (mesh.material && mesh.material.name ? mesh.material.name : '').toLowerCase();
                const isOuter = nameLower.includes('sphere') || nameLower.includes('plane') || nameLower.includes('sky') || nameLower.includes('bg') || nameLower.includes('env') || nameLower.includes('未命名') || matNameLower.includes('sphere') || matNameLower.includes('未命名');

                if (isOuter) {
                    mesh.visible = false;
                }
            });
        }
    }

    function getVisibleBoundingBox(obj) {
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

    let lastCalculatedFitDist = 2.5;
    let lastCharacterHeight = 2.0;

    function center3DModel(model, framingMode = 'torso') {
        if (!model || !miniCamera || !miniControls) return;

        model.rotation.y = 0;
        model.scale.set(1, 1, 1);
        model.position.set(0, 0, 0);
        model.updateMatrixWorld(true);

        // 1. Calculate bounding box ONLY of visible meshes!
        let box = getVisibleBoundingBox(model);
        if (box.isEmpty()) {
            box = new THREE.Box3().setFromObject(model);
        }

        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);

        // 2. Normalize scale so character height is exactly 2.0 units
        if (maxDim > 0) {
            const scaleFactor = 2.0 / maxDim;
            model.scale.set(scaleFactor, scaleFactor, scaleFactor);
            model.updateMatrixWorld(true);
        }

        // 3. Re-calculate bounding box after scaling
        const scaledBox = getVisibleBoundingBox(model);
        const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
        const scaledSize = scaledBox.getSize(new THREE.Vector3());

        // 4. Center model vertically so bounding center is at origin (0, 0, 0)
        model.position.x = -scaledCenter.x;
        model.position.y = -scaledCenter.y;
        model.position.z = -scaledCenter.z;
        model.updateMatrixWorld(true);

        lastCharacterHeight = scaledSize.y || 2.0;

        // 5. Calculate camera distance based on FOV and aspect ratio
        const fovRad = (miniCamera.fov * Math.PI) / 180;
        const aspect = miniCamera.aspect || 1;
        const heightDist = (lastCharacterHeight / 2) / Math.tan(fovRad / 2);
        const widthDist = ((scaledSize.x || 1.0) / 2) / (Math.tan(fovRad / 2) * aspect);
        lastCalculatedFitDist = Math.max(heightDist, widthDist) * 1.15;

        applyFramingMode(framingMode);
    }

    function applyFramingMode(mode = 'torso') {
        if (!miniCamera || !miniControls) return;

        const h = lastCharacterHeight;
        const fitD = lastCalculatedFitDist;

        if (mode === 'face') {
            miniControls.target.set(0, h * 0.35, 0);
            miniCamera.position.set(0, h * 0.35, fitD * 0.45);
        } else if (mode === 'torso') {
            miniControls.target.set(0, h * 0.1, 0);
            miniCamera.position.set(0, h * 0.1, fitD * 0.75);
        } else { // body
            miniControls.target.set(0, 0, 0);
            miniCamera.position.set(0, 0, fitD * 1.15);
        }

        miniCamera.lookAt(miniControls.target);
        miniControls.update();
    }

    // Attach Framing Quick Preset Handlers
    setTimeout(() => {
        const btnFace = document.getElementById('btnZoomFace');
        const btnTorso = document.getElementById('btnZoomTorso');
        const btnBody = document.getElementById('btnZoomBody');
        const btnRecenter = document.getElementById('btnRecenter3D');

        const pills = [btnFace, btnTorso, btnBody];

        if (btnFace) {
            btnFace.addEventListener('click', () => {
                pills.forEach(p => p && p.classList.remove('active'));
                btnFace.classList.add('active');
                applyFramingMode('face');
            });
        }
        if (btnTorso) {
            btnTorso.addEventListener('click', () => {
                pills.forEach(p => p && p.classList.remove('active'));
                btnTorso.classList.add('active');
                applyFramingMode('torso');
            });
        }
        if (btnBody) {
            btnBody.addEventListener('click', () => {
                pills.forEach(p => p && p.classList.remove('active'));
                btnBody.classList.add('active');
                applyFramingMode('body');
            });
        }
        if (btnRecenter) {
            btnRecenter.addEventListener('click', () => {
                if (miniModel) center3DModel(miniModel, 'torso');
            });
        }
    }, 500);

    let resizeObserver;
    function observeMiniStage() {
        const container = document.getElementById('wizard3dPreviewContainer');
        if (!container || resizeObserver) return;

        resizeObserver = new ResizeObserver(() => {
            if (!miniRenderer || !miniCamera) return;
            const w = container.clientWidth;
            const h = container.clientHeight;
            if (w > 0 && h > 0) {
                miniCamera.aspect = w / h;
                miniCamera.updateProjectionMatrix();
                miniRenderer.setSize(w, h);
                if (miniModel) center3DModel(miniModel);
            }
        });
        resizeObserver.observe(container);
    }

    function createMiniProceduralAvatar() {
        if (miniModel) miniScene.remove(miniModel);
        const grp = new THREE.Group();

        const headGeo = new THREE.SphereGeometry(0.3, 32, 32);
        const mat = new THREE.MeshStandardMaterial({
            color: 0x8b5cf6,
            metalness: 0.85,
            roughness: 0.15,
            emissive: 0x6d28d9,
            emissiveIntensity: 0.4
        });
        const head = new THREE.Mesh(headGeo, mat);
        head.position.set(0, 1.3, 0);
        grp.add(head);

        const visorGeo = new THREE.BoxGeometry(0.38, 0.09, 0.25);
        const visorMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x06b6d4, emissiveIntensity: 0.85 });
        const visor = new THREE.Mesh(visorGeo, visorMat);
        visor.position.set(0, 1.32, 0.16);
        grp.add(visor);

        const bodyGeo = new THREE.CylinderGeometry(0.2, 0.34, 0.9, 32);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.set(0, 0.6, 0);
        grp.add(body);

        miniScene.add(grp);
        miniModel = grp;
        center3DModel(miniModel);
    }

    setTimeout(initMini3DPreview, 300);

    // Helper function to optimize materials for GLTF/GLB models (character textures, transparency, double-sided, sRGB)
    function setupGLTFMaterial(mat, fileMap = {}) {
        if (!mat) return;
        mat.side = THREE.DoubleSide;

        // Reset base material color to pure white so textures aren't tinted pink or discolored!
        mat.color.setHex(0xffffff);

        // Adjust roughness and metalness for anime character skin so it doesn't reflect dark metallic hues
        if (mat.isMeshStandardMaterial) {
            mat.roughness = 0.75;
            mat.metalness = 0.05;
        }

        if (mat.map) {
            mat.map.colorSpace = THREE.SRGBColorSpace;
            mat.map.anisotropy = 16;
            mat.map.needsUpdate = true;
        } else if (Object.keys(fileMap).length > 0) {
            const matName = (mat.name || '').toLowerCase();
            for (const name in fileMap) {
                const cleanName = name.toLowerCase().replace(/\.[^/.]+$/, "");
                if (matName.includes(cleanName) || cleanName.includes(matName) || matName === '') {
                    const texture = new THREE.TextureLoader().load(fileMap[name]);
                    texture.colorSpace = THREE.SRGBColorSpace;
                    texture.anisotropy = 16;
                    mat.map = texture;
                    mat.needsUpdate = true;
                    break;
                }
            }
        }

        mat.transparent = true;
        mat.alphaTest = 0.15;
        mat.depthWrite = true;
        mat.needsUpdate = true;
    }

    // 3D GLB/GLTF + Texture Files Loader with LoadingManager URL Modifier
    const labelModel3d = document.querySelector('label[for="model3dFileInput"]');
    if (labelModel3d) {
        labelModel3d.addEventListener('click', (e) => {
            if (!canUse('custom3DModel')) {
                e.preventDefault();
                e.stopPropagation();
                playClickDropSound();
                const billingModal = document.getElementById('billingModal') || document.getElementById('billing-modal');
                if (billingModal) billingModal.classList.remove('hidden');
                if (showToast) showToast('🔒 La carga de modelos 3D personalizados (.glb) requiere Plan Premium.', 'warning');
            }
        });
    }

    const labelTexture = document.querySelector('label[for="textureFileInput"]');
    if (labelTexture) {
        labelTexture.addEventListener('click', (e) => {
            if (!canUse('custom3DModel')) {
                e.preventDefault();
                e.stopPropagation();
                playClickDropSound();
                const billingModal = document.getElementById('billingModal') || document.getElementById('billing-modal');
                if (billingModal) billingModal.classList.remove('hidden');
                if (showToast) showToast('🔒 La carga de texturas 3D personalizadas requiere Plan Premium.', 'warning');
            }
        });
    }

    const model3dFileInput = document.getElementById('model3dFileInput');
    if (model3dFileInput) {
        model3dFileInput.addEventListener('change', (e) => {
            if (!canUse('custom3DModel')) {
                e.target.value = '';
                const billingModal = document.getElementById('billingModal') || document.getElementById('billing-modal');
                if (billingModal) billingModal.classList.remove('hidden');
                if (showToast) showToast('🔒 La carga de modelos 3D personalizados (.glb) requiere Plan Premium.', 'warning');
                return;
            }
            if (e.target.files && e.target.files.length > 0) {
                const files = Array.from(e.target.files);

                // Find primary .glb or .gltf model file
                const modelFile = files.find(f => {
                    const name = f.name.toLowerCase();
                    return name.endsWith('.glb') || name.endsWith('.gltf');
                }) || files[0];

                if (!modelFile) {
                    if (showToast) showToast('Por favor selecciona un archivo .glb o .gltf válido.', 'warning');
                    return;
                }

                // Map all uploaded file names (and texture images) to Blob URLs with decoded URI variants
                const fileMap = {};
                files.forEach(f => {
                    const blobUrl = URL.createObjectURL(f);
                    fileMap[f.name] = blobUrl;
                    fileMap[f.name.toLowerCase()] = blobUrl;
                    try {
                        const decoded = decodeURIComponent(f.name);
                        fileMap[decoded] = blobUrl;
                        fileMap[decoded.toLowerCase()] = blobUrl;
                    } catch(err) {}
                });

                const modelUrl = fileMap[modelFile.name] || URL.createObjectURL(modelFile);
                const hiddenInput = document.getElementById('createModel3dUrl');
                if (hiddenInput) hiddenInput.value = modelUrl;

                initMini3DPreview();

                // LoadingManager intercepts texture requests and maps them to uploaded PNG/JPG blobs
                const manager = new THREE.LoadingManager();
                manager.setURLModifier((url) => {
                    let cleanName = url.replace(/^.*[\\\/]/, '');

                    try {
                        cleanName = decodeURIComponent(cleanName);
                    } catch(err) {}

                    cleanName = cleanName.split('?')[0].split('#')[0];
                    const cleanLower = cleanName.toLowerCase();

                    if (fileMap[cleanName]) return fileMap[cleanName];
                    if (fileMap[cleanLower]) return fileMap[cleanLower];

                    // Match by base filename without extension
                    const baseName = cleanLower.replace(/\.[^/.]+$/, "");
                    for (const key in fileMap) {
                        const keyLower = key.toLowerCase();
                        const keyBase = keyLower.replace(/\.[^/.]+$/, "");
                        if (keyBase === baseName || keyLower.includes(baseName) || baseName.includes(keyBase)) {
                            return fileMap[key];
                        }
                    }

                    return url;
                });

                const loader = new GLTFLoader(manager);
                loader.load(
                    modelUrl,
                    (gltf) => {
                        if (miniModel) miniScene.remove(miniModel);
                        miniModel = gltf.scene;

                        filterAndCenterGLTF(miniModel);

                        // Process model hierarchy: apply double-sided transparent materials
                        miniModel.traverse((child) => {
                            if (child.isMesh && child.visible) {
                                child.castShadow = true;
                                child.receiveShadow = true;

                                if (child.material) {
                                    if (Array.isArray(child.material)) {
                                        child.material.forEach(m => setupGLTFMaterial(m, fileMap));
                                    } else {
                                        setupGLTFMaterial(child.material, fileMap);
                                    }
                                }
                            }
                        });

                        miniScene.add(miniModel);
                        center3DModel(miniModel);
                        window.lumaActiveModelScene = miniModel;

                        const statusBadge = document.getElementById('model3dStatusBadge');
                        if (statusBadge) {
                            statusBadge.className = 'model-status-pill active';
                            const texMsg = files.length > 1 ? ` (${files.length} archivos con texturas)` : '';
                            statusBadge.innerHTML = `<span>✓ Modelo 3D Cargado: ${modelFile.name}${texMsg}</span>`;
                        }

                        const tag3d = document.getElementById('preview3dBadge');
                        if (tag3d) tag3d.textContent = '3D Custom GLB';

                        playPopSound();
                        if (showToast) showToast(`Modelo 3D "${modelFile.name}" cargado con texturas`, 'success');
                    },
                    undefined,
                    (err) => {
                        console.warn('GLTFLoader warning:', err);
                        if (showToast) showToast(`Modelo cargado: "${modelFile.name}"`, 'info');
                    }
                );
            }
        });
    }

    // Manual Texture File Assigner Handler (Intelligent Name Matching & sRGB)
    const textureFileInput = document.getElementById('textureFileInput');
    if (textureFileInput) {
        textureFileInput.addEventListener('change', (e) => {
            if (!canUse('custom3DModel')) {
                e.target.value = '';
                const billingModal = document.getElementById('billingModal') || document.getElementById('billing-modal');
                if (billingModal) billingModal.classList.remove('hidden');
                if (showToast) showToast('🔒 La carga de texturas 3D personalizadas requiere Plan Premium.', 'warning');
                return;
            }
            if (e.target.files && e.target.files.length > 0 && miniModel) {
                const texFiles = Array.from(e.target.files);
                const loadedTexs = texFiles.map(file => {
                    const blobUrl = URL.createObjectURL(file);
                    const texture = new THREE.TextureLoader().load(blobUrl);
                    texture.colorSpace = THREE.SRGBColorSpace;
                    texture.anisotropy = 16;
                    const cleanName = file.name.toLowerCase().replace(/\.[^/.]+$/, "");
                    return { name: file.name, cleanName, texture };
                });

                let assignedCount = 0;
                miniModel.traverse((child) => {
                    if (child.isMesh && child.visible && child.material) {
                        const mats = Array.isArray(child.material) ? child.material : [child.material];
                        mats.forEach((mat) => {
                            const matName = (mat.name || child.name || '').toLowerCase();

                            // 1. Try smart name matching first (e.g., "FACE_1" -> face, "CHOTH_0" -> cloth)
                            let matchedTex = loadedTexs.find(t => matName.includes(t.cleanName) || t.cleanName.includes(matName));

                            // 2. Fallback to index matching if no name match
                            if (!matchedTex) {
                                matchedTex = loadedTexs[assignedCount % loadedTexs.length];
                            }

                            if (matchedTex) {
                                mat.map = matchedTex.texture;
                                mat.color.setHex(0xffffff);
                                mat.side = THREE.DoubleSide;
                                mat.transparent = true;
                                mat.alphaTest = 0.15;
                                if (mat.isMeshStandardMaterial) {
                                    mat.roughness = 0.75;
                                    mat.metalness = 0.05;
                                }
                                mat.needsUpdate = true;
                                assignedCount++;
                            }
                        });
                    }
                });

                playPopSound();
                if (showToast) showToast(`${assignedCount} textura(s) asignada(s) correctamente en sRGB`, 'success');
            }
        });
    }

    // Archetype Interactive Cards Selection
    document.querySelectorAll('.archetype-select-card').forEach(card => {
        card.addEventListener('click', () => {
            const archetype = card.dataset.archetype;

            if (!canUseArchetype(archetype) && getTier() === 'free') {
                playClickDropSound();
                const billingModal = document.getElementById('billingModal') || document.getElementById('billing-modal');
                if (billingModal) billingModal.classList.remove('hidden');
                const arcName = card.querySelector('.arc-name')?.textContent || archetype;
                if (showToast) showToast(`El arquetipo "${arcName}" requiere Plan Premium. Mejora tu suscripción para usarlo.`, 'warning');
                return;
            }

            playPopSound();
            document.querySelectorAll('.archetype-select-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');

            const archetypeInput = document.getElementById('createArchetype');
            if (archetypeInput) archetypeInput.value = archetype;

            const defaults = {
                pareja: { afinidad: 75, celos: 15, resentimiento: 0, ansiedad: 5 },
                rival: { afinidad: 45, celos: 30, resentimiento: 10, ansiedad: 5 },
                amigaToxica: { afinidad: 60, celos: 55, resentimiento: 20, ansiedad: 25 },
                ex: { afinidad: 65, celos: 40, resentimiento: 35, ansiedad: 30 },
                mejorAmigo: { afinidad: 85, celos: 5, resentimiento: 0, ansiedad: 0 }
            };

            const def = defaults[archetype] || defaults.pareja;
            const afInp = document.getElementById('createAfinidad');
            const celInp = document.getElementById('createCelos');
            const resInp = document.getElementById('createResentimiento');
            const ansInp = document.getElementById('createAnsiedad');

            if (afInp) { afInp.value = def.afinidad; document.getElementById('valCreateAfinidad').textContent = def.afinidad; }
            if (celInp) { celInp.value = def.celos; document.getElementById('valCreateCelos').textContent = def.celos; }
            if (resInp) { resInp.value = def.resentimiento; document.getElementById('valCreateResentimiento').textContent = def.resentimiento; }
            if (ansInp) { ansInp.value = def.ansiedad; document.getElementById('valCreateAnsiedad').textContent = def.ansiedad; }

            // Dynamic Matices de Humor & Trait Chips per Archetype Branch
            const archetypeDynamicOptions = {
                pareja: {
                    matices: [
                        { val: '🌸 Extremadamente Dulce & Cómplice', text: '🌸 Extremadamente Dulce & Cómplice' },
                        { val: '💕 Romántica & Posesiva', text: '💕 Romántica & Posesiva' },
                        { val: '☕ Cálida & Detallista', text: '☕ Cálida & Detallista' },
                        { val: '🥰 Cariñosa con Humor Seco', text: '🥰 Cariñosa con Humor Seco' }
                    ],
                    traits: [
                        { icon: '☕', name: 'Amante del café' },
                        { icon: '📸', name: 'Fotos análogas' },
                        { icon: '🎧', name: 'Música indie' },
                        { icon: '📖', name: 'Lectora apasionada' },
                        { icon: '🧁', name: 'Repostería casera' },
                        { icon: '🌙', name: 'Charlas nocturnas' }
                    ]
                },
                amigaToxica: {
                    matices: [
                        { val: '😈 Sarcástica & Burlona', text: '😈 Sarcástica & Burlona' },
                        { val: '🔥 Drama & Chisme Total', text: '🔥 Drama & Chisme Total' },
                        { val: '💅 Directa Sin Filtro', text: '💅 Directa Sin Filtro' },
                        { val: '👑 Provocadora & Picante', text: '👑 Provocadora & Picante' }
                    ],
                    traits: [
                        { icon: '💅', name: 'Directa sin filtro' },
                        { icon: '🌙', name: 'Trasnochadora' },
                        { icon: '🎮', name: 'Gamer de corazón' },
                        { icon: '🍕', name: 'Fan de la pizza' },
                        { icon: '🍿', name: 'Adicta al chisme' },
                        { icon: '🖤', name: 'Ironía constante' }
                    ]
                },
                rival: {
                    matices: [
                        { val: '⚔️ Orgullosa & Competitiva', text: '⚔️ Orgullosa & Competitiva' },
                        { val: '😏 Tsundere Mordaz', text: '😏 Tsundere Mordaz' },
                        { val: '🔥 Fiera & Fuerte', text: '🔥 Fiera & Fuerte' },
                        { val: '🏆 Odia Perder', text: '🏆 Odia Perder' }
                    ],
                    traits: [
                        { icon: '⚔️', name: 'Orgullo gigante' },
                        { icon: '🎯', name: 'Apuestas altas' },
                        { icon: '🎮', name: 'Gamer competitiva' },
                        { icon: '📖', name: 'Debates acalorados' },
                        { icon: '🏆', name: 'Odia perder' },
                        { icon: '🏃‍♀️', name: 'Atleta feroz' }
                    ]
                },
                ex: {
                    matices: [
                        { val: '🌧️ Melancólica & Distante', text: '🌧️ Melancólica & Distante' },
                        { val: '💔 Nostálgica & Misteriosa', text: '💔 Nostálgica & Misteriosa' },
                        { val: '🍷 Asuntos Pendientes', text: '🍷 Asuntos Pendientes' },
                        { val: '🖤 Tensión No Resuelta', text: '🖤 Tensión No Resuelta' }
                    ],
                    traits: [
                        { icon: '🌧️', name: 'Recuerdos del pasado' },
                        { icon: '🎧', name: 'Canciones tristes' },
                        { icon: '🍷', name: 'Noches de nostalgia' },
                        { icon: '🌙', name: 'Trasnochadora' },
                        { icon: '📸', name: 'Fotos viejas' },
                        { icon: '💔', name: 'Melancólica' }
                    ]
                },
                mejorAmigo: {
                    matices: [
                        { val: '🤝 Confidente Sin Filtro', text: '🤝 Confidente Sin Filtro' },
                        { val: '🎮 Relajado & Hermano', text: '🎮 Relajado & Hermano' },
                        { val: '🍕 Leal & Divertido', text: '🍕 Leal & Divertido' },
                        { val: '🔥 Cómplice de Aventuras', text: '🔥 Cómplice de Aventuras' }
                    ],
                    traits: [
                        { icon: '🎮', name: 'Gamer de corazón' },
                        { icon: '🍕', name: 'Fan de la pizza' },
                        { icon: '🎧', name: 'Discord nocturno' },
                        { icon: '☕', name: 'Café sin azúcar' },
                        { icon: '🚗', name: 'Viajes improvisados' },
                        { icon: '🤝', name: 'Lealtad absoluta' }
                    ]
                }
            };

            const dynData = archetypeDynamicOptions[archetype] || archetypeDynamicOptions.pareja;

            const matizSelect = document.getElementById('createMatizHumor');
            if (matizSelect) {
                matizSelect.innerHTML = dynData.matices.map((m, idx) => `
                    <option value="${m.val}" ${idx === 0 ? 'selected' : ''}>${m.text}</option>
                `).join('');
            }

            const traitGrid = document.getElementById('traitChipsGrid');
            if (traitGrid) {
                traitGrid.innerHTML = dynData.traits.map((t, idx) => `
                    <button type="button" class="trait-chip ${idx < 3 ? 'active' : ''}" data-trait="${t.name}">
                        ${t.icon} ${t.name}
                    </button>
                `).join('');

                traitGrid.querySelectorAll('.trait-chip').forEach(chip => {
                    chip.addEventListener('click', () => {
                        playPopSound();
                        chip.classList.toggle('active');
                        autoAssembleMonologue();
                    });
                });
            }

            updateEmotionalDiagnosis();
            autoAssembleMonologue();
        });
    });

    // Random Greeting Generator Button
    const randomGreetingBtn = document.getElementById('randomGreetingBtn');
    if (randomGreetingBtn) {
        randomGreetingBtn.addEventListener('click', () => {
            playPopSound();
            const name = document.getElementById('createName').value.trim() || 'Cariño';
            const archetype = document.getElementById('createArchetype').value || 'pareja';

            const greetings = {
                pareja: [
                    `¡Hola mi vida! 💕 Te estaba pensando justo ahora... ¿cómo estuvo tu día?`,
                    `¡Qué alegría verte! 😍 Ven, cuéntame todo lo que hiciste hoy.`,
                    `¡Hola ${name}! Estaba contando las horas para volver a hablar contigo.`
                ],
                rival: [
                    `Vaya, mira quién aparece... 😏 No creas que olvidé nuestra última discusión.`,
                    `¿Decidiste dar la cara? Apuesto a que vienes a pedirme la revancha.`,
                    `¡Hey! Odio admitirlo, pero tu presencia hace las cosas más interesantes.`
                ],
                amigaToxica: [
                    `Por fin te acuerdas de mí... ¿O estabas hablando con alguien más interesante? 😂`,
                    `¡Adivina el drama que acaba de pasar! Tienes que escuchar esto ya mismo.`,
                    `No sé si ponerme feliz de verte o reclamarte por tardar tanto. 💅`
                ],
                ex: [
                    `🌧️ Estaba escuchando nuestra canción favorita y me acordé de ti... ¿Cómo estás?`,
                    `Hola... No estaba seguro de si responderías, pero me alegra volver a saber de ti.`
                ],
                mejorAmigo: [
                    `¡Pasa hermano! 🤝 ¿Qué hay de nuevo hoy? ¿En qué lío andamos?`,
                    `¡Hey! Estaba a punto de escribirte para contarte algo genial.`
                ]
            };

            const list = greetings[archetype] || greetings.pareja;
            const pick = list[Math.floor(Math.random() * list.length)];
            const firstMsgInput = document.getElementById('createFirstMessage');
            if (firstMsgInput) firstMsgInput.value = pick;
        });
    }

    function updateEmotionalDiagnosis() {
        const badge = document.getElementById('emotionalDiagnosisBadge');
        if (!badge) return;

        const afinidad = parseInt(document.getElementById('createAfinidad').value, 10) || 50;
        const celos = parseInt(document.getElementById('createCelos').value, 10) || 0;
        const resentimiento = parseInt(document.getElementById('createResentimiento').value, 10) || 0;
        const ansiedad = parseInt(document.getElementById('createAnsiedad').value, 10) || 0;

        let diag = '🔮 Personalidad Equilibrada y Cálida';

        if (afinidad >= 80 && celos < 20) diag = '💖 Personalidad Incondicional, Dulce y Fiel';
        else if (afinidad >= 70 && celos >= 50) diag = '🔥 Personalidad Cariñosa pero Peligrosamente Territorial';
        else if (celos >= 60 && ansiedad >= 40) diag = '😈 Personalidad Celosa, Insegura y Posesiva';
        else if (resentimiento >= 40) diag = '🌧️ Personalidad Rencorosa, Distante e Impredecible';
        else if (afinidad < 40 && resentimiento < 20) diag = '⚔️ Personalidad Distante, Desafiante y Tsundere';

        badge.textContent = diag;
    }

    ['Afinidad', 'Celos', 'Resentimiento', 'Ansiedad'].forEach(attr => {
        const input = document.getElementById(`create${attr}`);
        const display = document.getElementById(`valCreate${attr}`);
        if (input && display) {
            input.addEventListener('input', () => {
                display.textContent = input.value;
                updateEmotionalDiagnosis();
            });
        }
    });

    // ── Interactive Avatar Cropper State (Drag & Pan + Zoom) ─────
    let cropperState = {
        zoom: 1.0,
        panX: 0,
        panY: 0
    };

    function updateAvatarTransforms() {
        const cropperImg = document.getElementById('cropperImg');
        const previewImg = document.getElementById('previewAvatarImg');
        const zoomSlider = document.getElementById('avatarZoomSlider');
        const zoomBadge = document.getElementById('zoomValBadge');

        const transformStr = `translate(${cropperState.panX}px, ${cropperState.panY}px) scale(${cropperState.zoom})`;

        if (cropperImg) cropperImg.style.transform = transformStr;
        if (previewImg) previewImg.style.transform = transformStr;

        if (zoomSlider) zoomSlider.value = cropperState.zoom;
        if (zoomBadge) zoomBadge.textContent = `${Math.round(cropperState.zoom * 100)}%`;
    }

    function resetCropperState() {
        cropperState = { zoom: 1.0, panX: 0, panY: 0 };
        updateAvatarTransforms();
    }

    const cropperViewport = document.getElementById('cropperViewport');
    if (cropperViewport) {
        let isDragging = false;
        let startX = 0, startY = 0;

        cropperViewport.addEventListener('pointerdown', (e) => {
            isDragging = true;
            startX = e.clientX - cropperState.panX;
            startY = e.clientY - cropperState.panY;
            try { cropperViewport.setPointerCapture(e.pointerId); } catch(err) {}
        });

        cropperViewport.addEventListener('pointermove', (e) => {
            if (!isDragging) return;
            cropperState.panX = e.clientX - startX;
            cropperState.panY = e.clientY - startY;
            updateAvatarTransforms();
        });

        const stopDrag = (e) => {
            if (isDragging) {
                isDragging = false;
                try { cropperViewport.releasePointerCapture(e.pointerId); } catch(err) {}
            }
        };

        cropperViewport.addEventListener('pointerup', stopDrag);
        cropperViewport.addEventListener('pointercancel', stopDrag);

        cropperViewport.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.05 : 0.05;
            cropperState.zoom = Math.min(Math.max(1.0, cropperState.zoom + delta), 3.0);
            updateAvatarTransforms();
        }, { passive: false });
    }

    const avatarZoomSlider = document.getElementById('avatarZoomSlider');
    if (avatarZoomSlider) {
        avatarZoomSlider.addEventListener('input', (e) => {
            cropperState.zoom = parseFloat(e.target.value) || 1.0;
            updateAvatarTransforms();
        });
    }

    const resetCropBtn = document.getElementById('resetAvatarCropBtn');
    if (resetCropBtn) {
        resetCropBtn.addEventListener('click', resetCropperState);
    }

    function updateStepUI() {
        if (step1) step1.classList.toggle('hidden', currentStep !== 1);
        if (step2) step2.classList.toggle('hidden', currentStep !== 2);
        if (step3) step3.classList.toggle('hidden', currentStep !== 3);
        if (step4) step4.classList.toggle('hidden', currentStep !== 4);

        if (ind1) ind1.classList.toggle('active', currentStep === 1);
        if (ind2) ind2.classList.toggle('active', currentStep === 2);
        if (ind3) ind3.classList.toggle('active', currentStep === 3);
        if (ind4) ind4.classList.toggle('active', currentStep === 4);

        const previewCol = document.querySelector('.wizard-preview-col');
        if (previewCol) {
            // Live Preview Panel is ONLY visible in Step 2 (Apariencia & 3D)!
            previewCol.classList.toggle('hidden', currentStep !== 2);
        }
        const formLayout = document.querySelector('.wizard-form-layout') || document.querySelector('#creatorForm');
        if (formLayout) {
            formLayout.classList.toggle('no-preview', currentStep !== 2);
        }

        if (prevBtn) prevBtn.classList.toggle('hidden', currentStep === 1);
        if (nextBtn) nextBtn.classList.toggle('hidden', currentStep === 4);
        if (saveBtn) saveBtn.classList.toggle('hidden', currentStep !== 4);

        if (currentStep === 2) {
            initMini3DPreview();
            setTimeout(observeMiniStage, 100);
        }
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (currentStep === 1) {
                const name = document.getElementById('createName').value.trim();
                if (!name) {
                    if (showToast) showToast('Por favor escribe un nombre para tu personaje.', 'warning');
                    return;
                }
            }
            if (currentStep === 3) {
                const archetype = document.getElementById('createArchetype').value;
                if (!canUseArchetype(archetype) && getTier() === 'free') {
                    const billingModal = document.getElementById('billingModal') || document.getElementById('billing-modal');
                    if (billingModal) billingModal.classList.remove('hidden');
                    if (showToast) showToast('El arquetipo seleccionado requiere Plan Premium.', 'warning');
                    return;
                }
            }
            if (currentStep < 4) {
                currentStep++;
                playWhooshSound();
            }
            updateStepUI();
        });
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentStep > 1) {
                currentStep--;
                playClickDropSound();
            }
            updateStepUI();
        });
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            const customChars = JSON.parse(localStorage.getItem('lumaCustomCharacters') || '[]');
            if (!canCreateCustomBot(customChars.length)) {
                const billingModal = document.getElementById('billingModal') || document.getElementById('billing-modal');
                if (billingModal) billingModal.classList.remove('hidden');
                if (showToast) showToast('Has alcanzado el límite de 3 personajes creados en Plan Free. Mejora a Premium para slots ilimitados.', 'warning');
                return;
            }

            const name = document.getElementById('createName').value.trim();
            const tagline = document.getElementById('createTagline').value.trim();
            const avatar_url = document.getElementById('createAvatarUrl').value.trim() || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80';
            const model3d_url = document.getElementById('createModel3dUrl')?.value || '';
            const first_message = document.getElementById('createFirstMessage').value.trim() || '¡Hola! Me alegra estar contigo.';
            const arquetipo_id = document.getElementById('createArchetype').value;
            const system_prompt = document.getElementById('createSystemPrompt').value.trim();

            if (!canUseArchetype(arquetipo_id) && getTier() === 'free') {
                const billingModal = document.getElementById('billingModal') || document.getElementById('billing-modal');
                if (billingModal) billingModal.classList.remove('hidden');
                if (showToast) showToast('El arquetipo seleccionado requiere Plan Premium.', 'warning');
                return;
            }

            const afinidad = parseInt(document.getElementById('createAfinidad').value, 10) || 70;
            const celos = parseInt(document.getElementById('createCelos').value, 10) || 15;
            const resentimiento = parseInt(document.getElementById('createResentimiento').value, 10) || 0;
            const ansiedad = parseInt(document.getElementById('createAnsiedad').value, 10) || 10;

            const sensitivities = {
                celos_sensibility: celos > 40 ? 1.8 : 1.0,
                resentment_decay: resentimiento > 20 ? 0.3 : 0.8,
                vulnerability_threshold: afinidad < 50 ? 80 : 60,
                night_owl_affinity: 1.35
            };

            const newChar = {
                name,
                tagline,
                avatar_url,
                model3d_url,
                first_message,
                arquetipo_id,
                system_prompt,
                sensitivities,
                emociones_inicio: { afinidad, celos, resentimiento, ansiedad },
                lorebook: {}
            };

            // Dispatch 3D model to main chat stage
            window.dispatchEvent(new CustomEvent('loadCharacterModel', {
                detail: {
                    model3d_url: model3d_url,
                    model: miniModel
                }
            }));

            playPopSound();
            if (onSaveCharacter) {
                await onSaveCharacter(newChar);
                currentStep = 1;
                updateStepUI();
            }
        });
    }
}
