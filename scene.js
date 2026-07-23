import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.184.0/build/three.module.js';

const section = document.querySelector('#ceremonyScene');
const canvas = document.querySelector('#ceremonyCanvas');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const compactDevice = window.matchMedia('(max-width: 700px)').matches;

if (section && canvas) {
  try {
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !compactDevice,
      alpha: true,
      powerPreference: 'low-power',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x2a1723, 0.036);

    const camera = new THREE.PerspectiveCamera(37, 1, 0.1, 60);
    camera.position.set(0, 2.15, 9.8);

    const world = new THREE.Group();
    scene.add(world);

    const ivory = new THREE.MeshStandardMaterial({ color: 0xe7cdbd, roughness: 0.64, metalness: 0.02 });
    const stone = new THREE.MeshStandardMaterial({ color: 0x9b7167, roughness: 0.92 });
    const aisle = new THREE.MeshStandardMaterial({ color: 0xcaa89d, roughness: 0.84 });
    const leaf = new THREE.MeshStandardMaterial({ color: 0x243a2c, roughness: 1 });
    const rose = new THREE.MeshStandardMaterial({ color: 0x7e2148, roughness: 0.78 });
    const warm = new THREE.MeshBasicMaterial({ color: 0xffc06f });

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(34, 44), stone);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, -8);
    world.add(ground);

    const path = new THREE.Mesh(new THREE.PlaneGeometry(3.7, 34), aisle);
    path.rotation.x = -Math.PI / 2;
    path.position.set(0, 0.012, -8);
    world.add(path);

    const pillarGeometry = new THREE.CylinderGeometry(0.12, 0.17, 3.25, 10);
    const archGeometry = new THREE.TorusGeometry(3.05, 0.105, 8, 42, Math.PI);
    const planterGeometry = new THREE.DodecahedronGeometry(0.24, 0);
    const lampGeometry = new THREE.SphereGeometry(0.09, 10, 8);

    [-1.2, -5, -8.8, -12.6].forEach((z, index) => {
      const arch = new THREE.Group();
      [-3.05, 3.05].forEach((x) => {
        const pillar = new THREE.Mesh(pillarGeometry, ivory);
        pillar.position.set(x, 1.625, 0);
        arch.add(pillar);

        const lamp = new THREE.Mesh(lampGeometry, warm);
        lamp.position.set(x * 0.88, 1.05, 0.1);
        arch.add(lamp);

        for (let n = 0; n < 4; n += 1) {
          const foliage = new THREE.Mesh(planterGeometry, n % 3 === 0 ? rose : leaf);
          foliage.scale.set(1.1 + n * 0.08, 0.75, 1);
          foliage.position.set(x + (x < 0 ? -.25 : .25) + (n % 2) * .18, 0.24 + n * .12, (n - 1.5) * .18);
          arch.add(foliage);
        }
      });
      const curve = new THREE.Mesh(archGeometry, ivory);
      curve.position.y = 3.2;
      arch.add(curve);
      arch.position.z = z;
      arch.scale.setScalar(1 - index * 0.012);
      world.add(arch);
    });

    const chapel = new THREE.Group();
    const facade = new THREE.Mesh(new THREE.BoxGeometry(5.8, 4.5, 1.1), ivory);
    facade.position.y = 2.25;
    chapel.add(facade);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.25, 2.2, 4), ivory);
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 5.15;
    chapel.add(roof);
    const tower = new THREE.Mesh(new THREE.BoxGeometry(1.35, 2.7, 1.25), ivory);
    tower.position.y = 5.2;
    chapel.add(tower);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.95, 2.5, 4), ivory);
    spire.rotation.y = Math.PI / 4;
    spire.position.y = 7.75;
    chapel.add(spire);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.25), warm);
    door.position.set(0, 1.15, .56);
    chapel.add(door);
    const crossVertical = new THREE.Mesh(new THREE.BoxGeometry(.1, .8, .1), warm);
    const crossHorizontal = new THREE.Mesh(new THREE.BoxGeometry(.48, .1, .1), warm);
    crossVertical.position.y = 9.15;
    crossHorizontal.position.y = 9.25;
    chapel.add(crossVertical, crossHorizontal);
    chapel.position.z = -18.5;
    world.add(chapel);

    const petalCount = compactDevice ? 38 : 76;
    const petalPositions = new Float32Array(petalCount * 3);
    for (let i = 0; i < petalCount; i += 1) {
      petalPositions[i * 3] = (Math.random() - .5) * 10;
      petalPositions[i * 3 + 1] = Math.random() * 5.8 + .25;
      petalPositions[i * 3 + 2] = Math.random() * -19 + 4;
    }
    const petalGeometry = new THREE.BufferGeometry();
    petalGeometry.setAttribute('position', new THREE.BufferAttribute(petalPositions, 3));
    const petals = new THREE.Points(petalGeometry, new THREE.PointsMaterial({ color: 0xeaa3bd, size: .045, transparent: true, opacity: .72, sizeAttenuation: true }));
    world.add(petals);

    scene.add(new THREE.HemisphereLight(0xf6d7d1, 0x171c1a, 2.4));
    const key = new THREE.DirectionalLight(0xffc9aa, 2.5);
    key.position.set(-4, 7, 5);
    scene.add(key);
    const aisleGlow = new THREE.PointLight(0xff9f64, 28, 20, 2);
    aisleGlow.position.set(0, 2.1, -9);
    scene.add(aisleGlow);

    let pointerX = 0;
    let pointerY = 0;
    let lastFrame = 0;
    let running = false;

    function resize() {
      const width = section.clientWidth;
      const height = section.clientHeight;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, width < 700 ? 1.1 : 1.4);
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      camera.position.z = width < 700 ? 11.9 : 9.8;
      renderer.render(scene, camera);
    }

    function render(time = 0) {
      if (!reducedMotion && time - lastFrame < (compactDevice ? 40 : 32)) return;
      lastFrame = time;
      const t = time * .00012;
      petals.rotation.y = t * .22;
      petals.position.y = Math.sin(t * 2.1) * .08;
      camera.position.x += ((pointerX * .24) - camera.position.x) * .025;
      camera.position.y += ((2.15 + pointerY * .12) - camera.position.y) * .025;
      camera.lookAt(0, 2.25, -7.5);
      renderer.render(scene, camera);
    }

    function setRunning(shouldRun) {
      if (reducedMotion) {
        renderer.setAnimationLoop(null);
        render(0);
        return;
      }
      if (running === shouldRun) return;
      running = shouldRun;
      renderer.setAnimationLoop(shouldRun ? render : null);
    }

    new ResizeObserver(resize).observe(section);
    new IntersectionObserver(([entry]) => setRunning(entry.isIntersecting), { rootMargin: '15% 0px' }).observe(section);
    window.addEventListener('pointermove', (event) => {
      if (event.pointerType === 'touch') return;
      pointerX = (event.clientX / window.innerWidth - .5) * 2;
      pointerY = (event.clientY / window.innerHeight - .5) * -2;
    }, { passive: true });
    document.addEventListener('visibilitychange', () => {
      const bounds = section.getBoundingClientRect();
      setRunning(!document.hidden && bounds.top < window.innerHeight && bounds.bottom > 0);
    });
    resize();
    section.classList.add('is-rendered');
  } catch (error) {
    section.classList.add('is-fallback');
  }
}
