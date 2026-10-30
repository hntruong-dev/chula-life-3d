import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import './style.css';

const $ = (id) => document.getElementById(id);
const loadingText = $('loading-text');

let pyodide = null;
let pyGame = null;
let gameReady = false;
let currentState = null;
let currentTarget = null;
let toastTimer = null;
let dialogueReturnLock = false;
const keys = new Set();
const interactables = [];
const floorY = (floor) => (floor - 1) * 4.15;
const floorNames = {
  1: 'LEARNING COMMONS', 2: 'GROUP STUDY', 3: 'MULTIMEDIA & MEETING',
  4: 'HUMANITIES & SCIENCE', 5: 'SOCIAL SCIENCES',
  6: 'ASEAN & RARE COLLECTIONS', 7: 'MEETING & EXHIBITION'
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9bb7bd);
scene.fog = new THREE.Fog(0x9bb7bd, 38, 95);

const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.1, 180);
camera.position.set(0, 1.7, 6.3);
camera.rotation.order = 'YXZ';

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
$('game').prepend(renderer.domElement);

const controls = new PointerLockControls(camera, renderer.domElement);
const raycaster = new THREE.Raycaster();
const center = new THREE.Vector2(0, 0);
const clock = new THREE.Clock();
const tmpDir = new THREE.Vector3();
const rightDir = new THREE.Vector3();
const moveDir = new THREE.Vector3();

scene.add(new THREE.HemisphereLight(0xe5f3ed, 0x4c5c60, 1.45));
const sun = new THREE.DirectionalLight(0xffe5c4, 2.1);
sun.position.set(-18, 28, 15);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -35;
sun.shadow.camera.right = 35;
sun.shadow.camera.top = 35;
sun.shadow.camera.bottom = -35;
scene.add(sun);

const mat = (color, roughness = 0.72, metalness = 0.02, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });

const M = {
  concrete: mat(0xb5b6ac), floor: mat(0xd0c9b9), pale: mat(0xe6e3d8),
  wall: mat(0xe4e5dc), dark: mat(0x29383a), wood: mat(0x8a6748),
  woodLight: mat(0xb58a60), metal: mat(0x66787a, 0.35, 0.7),
  glass: new THREE.MeshStandardMaterial({ color: 0x9ecbd0, roughness: 0.14, metalness: 0.08, transparent: true, opacity: 0.2, side: THREE.DoubleSide }),
  green: mat(0x53745f), lime: mat(0xd5f36a, 0.3), book1: mat(0x657c87),
  book2: mat(0xb66f50), book3: mat(0xc6ad71), book4: mat(0x687c60),
  black: mat(0x20292b), white: mat(0xf3f1e9), blue: mat(0x507b92),
  fabric: mat(0x657e7c), plant: mat(0x527a58)
};

function box(parent, x, y, z, w, h, d, material, cast = true, receive = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  parent.add(mesh);
  return mesh;
}
function cylinder(parent, x, y, z, rTop, rBottom, h, material, radial = 12) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, radial), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function sphere(parent, x, y, z, r, material) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}
function labelSprite(text, width = 512, height = 120, bg = 'rgba(18,35,39,.88)', fg = '#eaf0e6') {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#d5f36a'; ctx.fillRect(0, 0, 8, height);
  ctx.fillStyle = fg; ctx.font = '600 30px Arial'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 28, height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.scale.set(4.4, 1.03, 1);
  return sprite;
}
function addSign(parent, text, x, y, z, scale = 1) {
  const s = labelSprite(text);
  s.position.set(x, y, z);
  s.scale.multiplyScalar(scale);
  parent.add(s);
  return s;
}
function addMarker(action, label, x, y, z, floor) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.userData.action = action;
  g.userData.label = label;
  g.userData.floor = floor;
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.19, 18, 14),
    new THREE.MeshBasicMaterial({ color: 0xd5f36a, transparent: true, opacity: 0.9 })
  );
  glow.userData.action = action;
  g.add(glow);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.29, 0.025, 6, 24),
    new THREE.MeshBasicMaterial({ color: 0xd5f36a, transparent: true, opacity: 0.8 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -0.24;
  g.add(ring);
  const tag = labelSprite(label.toUpperCase(), 512, 100, 'rgba(17,30,31,.82)', '#f3f6eb');
  tag.position.y = 0.58;
  tag.scale.set(2.5, 0.49, 1);
  g.add(tag);
  scene.add(g);
  interactables.push(glow);
  interactables.push(ring);
  glow.userData.action = action;
  glow.userData.label = label;
  glow.userData.floor = floor;
  ring.userData.action = action;
  ring.userData.label = label;
  ring.userData.floor = floor;
  return g;
}

function createPlant(parent, x, y, z, scale = 1) {
  cylinder(parent, x, y + .38 * scale, z, .28 * scale, .34 * scale, .76 * scale, M.wood, 12);
  for (let i = 0; i < 7; i++) {
    const angle = i * Math.PI * 2 / 7;
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(.26 * scale, 10, 8), M.plant);
    leaf.scale.set(.55, 1.6, .55);
    leaf.position.set(x + Math.cos(angle) * .22 * scale, y + .95 * scale, z + Math.sin(angle) * .22 * scale);
    leaf.rotation.z = Math.cos(angle) * .35;
    parent.add(leaf);
  }
}
function createDesk(parent, x, y, z, w = 2.3, d = 1.0, chairs = 2) {
  box(parent, x, y + .78, z, w, .12, d, M.woodLight);
  for (const dx of [-w * .42, w * .42]) for (const dz of [-d * .35, d * .35]) {
    box(parent, x + dx, y + .38, z + dz, .09, .76, .09, M.metal);
  }
  for (let i = 0; i < chairs; i++) {
    const cx = x - w * .32 + (chairs === 1 ? w * .32 : i * w * .64);
    box(parent, cx, y + .42, z + d * .82, .55, .12, .52, M.fabric);
    box(parent, cx, y + .72, z + d * 1.05, .55, .58, .09, M.fabric);
    cylinder(parent, cx, y + .2, z + d * .82, .045, .045, .42, M.metal);
  }
}
function createBookshelf(parent, x, y, z, w = 2.4, h = 2.4, d = .55) {
  box(parent, x, y + h / 2, z, w, h, d, M.wood);
  for (let level = 1; level <= 3; level++) {
    const yy = y + level * h / 4;
    box(parent, x, yy, z + d * .52, w * .98, .055, .08, M.woodLight);
    for (let i = 0; i < 9; i++) {
      const colors = [M.book1, M.book2, M.book3, M.book4, M.blue];
      const bw = w / 11;
      const book = box(parent, x - w * .43 + i * (w * .86 / 9), yy + .18, z - .05, bw * .72, .34 + (i % 3) * .07, .24, colors[(i + level) % colors.length], false, false);
      book.rotation.z = (i % 2 ? 1 : -1) * .035;
    }
  }
}
function createLaptop(parent, x, y, z) {
  box(parent, x, y, z, .55, .035, .38, M.black);
  const screen = box(parent, x, y + .19, z - .15, .55, .34, .035, M.dark);
  screen.rotation.x = -.18;
  box(parent, x, y + .19, z - .128, .47, .25, .012, M.blue, false, false);
}
function createNPC(parent, x, y, z, shirt, name, action, label, floor) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  cylinder(group, 0, .78, 0, .25, .3, .85, mat(shirt), 12);
  sphere(group, 0, 1.42, 0, .24, mat(0xd7aa86));
  cylinder(group, -.31, .8, 0, .09, .09, .72, mat(shirt), 8).rotation.z = -.2;
  cylinder(group, .31, .8, 0, .09, .09, .72, mat(shirt), 8).rotation.z = .2;
  cylinder(group, -.13, .23, 0, .09, .1, .46, M.dark, 8);
  cylinder(group, .13, .23, 0, .09, .1, .46, M.dark, 8);
  const nameTag = labelSprite(name.toUpperCase(), 512, 100, 'rgba(16,30,34,.9)', '#ffffff');
  nameTag.position.set(0, 2.05, 0);
  nameTag.scale.set(1.9, .38, 1);
  group.add(nameTag);
  parent.add(group);
  addMarker(action, label, x, y + 2.15, z, floor);
  return group;
}

function buildFloorShell(floor) {
  const y = floorY(floor);
  const floorMat = floor === 1 ? M.floor : (floor % 2 ? M.pale : M.floor);
  box(scene, 0, y - .17, 0, 28, .34, 18, floorMat);
  // Perimeter walls and broad glass facade: a stylised reconstruction, not a surveyed BIM model.
  box(scene, 0, y + 2.0, -9.0, 28, 4.0, .28, M.wall);
  box(scene, -14.0, y + 2.0, 0, .28, 4.0, 18, M.wall);
  box(scene, 14.0, y + 2.0, 0, .28, 4.0, 18, M.wall);
  for (let x = -11; x <= 11; x += 5.5) {
    box(scene, x, y + 2.0, 9.0, .12, 4.0, .12, M.metal);
    box(scene, x + 2.65, y + 2.0, 9.0, 5.15, 3.85, .055, M.glass, false, false);
  }
  box(scene, 0, y + .04, 9.0, 4.2, .08, .15, M.metal);
  // Structural columns
  for (const x of [-12.5, -5.0, 5.0, 12.5]) {
    for (const z of [-7.5, 7.5]) box(scene, x, y + 2.0, z, .48, 4.0, .48, M.concrete);
  }
  // Elevator lobby and doors
  box(scene, -11.2, y + 1.55, 6.2, 2.6, 3.1, .28, M.dark);
  box(scene, -11.2, y + 1.45, 6.0, 1.02, 2.85, .08, M.metal);
  box(scene, -11.2, y + 1.45, 5.93, .9, 2.7, .03, M.dark);
  box(scene, -9.55, y + 1.45, 5.8, .35, .95, .12, M.dark);
  addSign(scene, `LIFT · FLOOR ${floor}`, -11.2, y + 3.45, 5.9, .55);
  addMarker('elevator', 'Use elevator · F', -9.55, y + 1.65, 5.3, floor);
  // Ceiling lighting strips
  for (const x of [-8, 0, 8]) {
    const light = new THREE.PointLight(0xfff2d7, .45, 13, 2);
    light.position.set(x, y + 3.6, 0);
    scene.add(light);
    box(scene, x, y + 3.92, 0, 3.0, .035, .16, M.white, false, false);
  }
  addSign(scene, `OFFICE OF ACADEMIC RESOURCES · ${floor}F`, 0, y + 3.45, -8.75, .7);
}

function buildFloorOne() {
  const y = floorY(1);
  // Reception desk
  box(scene, -8.5, y + .65, -1.9, 4.1, 1.3, 1.05, M.wood);
  box(scene, -8.5, y + 1.34, -1.9, 4.15, .08, 1.1, M.woodLight);
  box(scene, -8.7, y + 1.42, -2.1, .55, .35, .08, M.black);
  addSign(scene, 'INFORMATION & CIRCULATION', -8.5, y + 2.2, -2.0, .7);
  addMarker('checkin', 'Check in at reception', -8.5, y + 2.0, -.7, 1);

  // Coffee corner and lunch counter
  box(scene, 9.4, y + .58, -3.0, 5.2, 1.16, 1.0, M.wood);
  box(scene, 9.4, y + 1.2, -3.0, 5.3, .08, 1.08, M.woodLight);
  box(scene, 8.5, y + 1.55, -3.0, .55, .65, .45, M.black);
  cylinder(scene, 8.5, y + 1.92, -3.0, .08, .08, .06, M.metal);
  addSign(scene, 'COFFEE CORNER', 9.3, y + 2.3, -3.0, .7);
  addMarker('coffee', 'Get an iced Thai coffee', 8.5, y + 2.05, -1.8, 1);
  addMarker('lunch', 'Take a lunch break', 10.8, y + 1.7, -4.2, 1);

  // Self-service printer / scanner
  box(scene, -9.1, y + .65, 3.0, 1.5, 1.3, 1.05, M.white);
  box(scene, -9.1, y + 1.34, 3.0, 1.2, .1, .8, M.dark);
  box(scene, -9.1, y + 1.48, 2.88, .55, .12, .22, M.blue);
  addSign(scene, 'PRINT · SCAN · COPY', -9.0, y + 2.15, 3.0, .65);
  addMarker('print', 'Print research notes · ฿10', -8.2, y + 1.8, 4.0, 1);

  // Learning commons
  createDesk(scene, -2.5, y, -1.8, 3.2, 1.15, 2);
  createLaptop(scene, -2.8, y + .9, -1.95);
  createDesk(scene, 3.0, y, -1.8, 3.2, 1.15, 2);
  createLaptop(scene, 2.7, y + .9, -1.95);
  createDesk(scene, 1.0, y, 3.2, 3.2, 1.15, 2);
  createPlant(scene, -12, y, -5, 1.1);
  createPlant(scene, 12, y, -5, 1.1);
  createPlant(scene, 11.5, y, 5.4, .9);
  createNPC(scene, 4.6, y, 1.0, 0x567b83, 'LIBRARIAN', 'water', 'Ask for help', 1);
  addSign(scene, 'LEARNING COMMONS', 0, y + 2.75, 5.8, .75);
  addMarker('relax', 'Take a short break', 0.5, y + 1.7, 5.0, 1);
}

function buildFloorTwo() {
  const y = floorY(2);
  // Glass group-study rooms
  for (const x of [-8.2, 0, 8.2]) {
    box(scene, x, y + 1.65, -3.0, 6.2, 3.3, .12, M.glass, false, false);
    box(scene, x - 3.0, y + 1.65, -1.0, .12, 3.3, 4.0, M.glass, false, false);
    box(scene, x + 3.0, y + 1.65, -1.0, .12, 3.3, 4.0, M.glass, false, false);
    createDesk(scene, x, y, -2.7, 3.5, 1.1, 3);
  }
  addSign(scene, 'GROUP STUDY ROOMS 01–06', 0, y + 3.0, -7.8, .7);
  createNPC(scene, 5.8, y, 3.4, 0xb36b58, 'LINH · VIETNAM', 'friend', 'Talk to Linh', 2);
  addMarker('groupstudy', 'Join a group study session', -5.5, y + 1.7, 4.6, 2);
  createPlant(scene, -12, y, 4.5, .9);
  createPlant(scene, 12, y, 4.5, .9);
}

function buildFloorThree() {
  const y = floorY(3);
  // AV studio and meeting room
  box(scene, 0, y + 1.55, -4.7, 12.0, 3.1, .15, M.glass, false, false);
  box(scene, -6, y + 1.55, -1.2, .15, 3.1, 7.0, M.glass, false, false);
  box(scene, 6, y + 1.55, -1.2, .15, 3.1, 7.0, M.glass, false, false);
  createDesk(scene, 0, y, -4.0, 5.0, 1.4, 4);
  box(scene, 0, y + 2.3, -7.7, 4.5, 1.5, .08, M.dark);
  box(scene, 0, y + 2.3, -7.64, 4.2, 1.2, .02, M.blue, false, false);
  addSign(scene, 'AUDIO VISUAL & MEETING', 0, y + 3.2, -7.9, .7);
  addMarker('groupstudy', 'Discuss research in the meeting room', 1.0, y + 1.8, -2.2, 3);
  createNPC(scene, 8.5, y, 1.8, 0x607d65, 'MEDIA STAFF', 'browse', 'Ask about media studio', 3);
  createPlant(scene, -11.5, y, 4.5, 1.0);
}

function buildFloorFour() {
  const y = floorY(4);
  for (const x of [-10, -5, 0, 5, 10]) createBookshelf(scene, x, y, -6.7, 2.1, 2.45, .55);
  for (const x of [-6, 0, 6]) {
    createDesk(scene, x, y, 1.5, 3.6, 1.2, 2);
    createLaptop(scene, x - .4, y + .9, 1.3);
  }
  addSign(scene, 'HUMANITIES · SCIENCE · QUIET STUDY', 0, y + 3.1, -8.0, .7);
  addMarker('book', 'Search atmospheric science books', 0, y + 1.7, -4.8, 4);
  addMarker('study', 'Study · PM₂.₅ manuscript', 0, y + 1.7, 3.4, 4);
  createPlant(scene, -12, y, 5.4, .8);
}

function buildFloorFive() {
  const y = floorY(5);
  for (const x of [-9, -4, 1, 6, 11]) createBookshelf(scene, x, y, -6.7, 2.0, 2.4, .55);
  createDesk(scene, -3, y, 1.5, 3.8, 1.1, 2);
  createDesk(scene, 5, y, 1.5, 3.8, 1.1, 2);
  addSign(scene, 'SOCIAL SCIENCES · INTERNATIONAL INFORMATION', 0, y + 3.1, -8.0, .62);
  addMarker('browse', 'Browse international collections', 8.5, y + 1.7, -4.6, 5);
  createNPC(scene, -8.5, y, 3.8, 0x5c7991, 'ARUN · THAILAND', 'groupstudy', 'Exchange research ideas', 5);
}

function buildFloorSix() {
  const y = floorY(6);
  for (const x of [-9, -3, 3, 9]) createBookshelf(scene, x, y, -6.4, 2.5, 2.5, .65);
  box(scene, 0, y + .8, 1.0, 5.5, 1.6, 1.8, M.wood);
  box(scene, 0, y + 1.62, 1.0, 5.4, .06, 1.7, M.glass, false, false);
  addSign(scene, 'THAILAND & ASEAN INFORMATION CENTER', 0, y + 3.1, -8.0, .63);
  addMarker('browse', 'Explore ASEAN and rare collections', 0, y + 2.0, 2.3, 6);
  createPlant(scene, 12, y, 4.8, .8);
}

function buildFloorSeven() {
  const y = floorY(7);
  // Exhibition boards and meeting table
  for (const x of [-8, -2, 4, 10]) {
    box(scene, x, y + 1.55, -4.8, 2.4, 2.6, .14, M.dark);
    box(scene, x, y + 1.55, -4.7, 2.2, 2.35, .04, M.blue, false, false);
  }
  createDesk(scene, 0, y, 2.0, 5.5, 1.4, 4);
  addSign(scene, 'MEETING & EXHIBITION SPACE', 0, y + 3.1, -8.0, .72);
  addMarker('relax', 'Pause and look over the campus', 0, y + 1.7, 4.3, 7);
}

function buildExterior() {
  // Distant Bangkok campus silhouettes visible through the glazed facade.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), mat(0x7f9785));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -1.0, -42);
  ground.receiveShadow = true;
  scene.add(ground);
  for (let i = 0; i < 20; i++) {
    const x = -52 + i * 5.4;
    const h = 5 + (i % 5) * 2.1;
    box(scene, x, h / 2 - .8, -45 - (i % 3) * 4, 3.6, h, 3.2, mat(i % 2 ? 0x879b9a : 0x9baaa2), false, false);
  }
  for (let i = 0; i < 12; i++) {
    const x = -26 + i * 4.8;
    cylinder(scene, x, 1.6, -24 - (i % 2) * 3, .13, .18, 3.2, M.wood, 8);
    const crown = sphere(scene, x, 3.7, -24 - (i % 2) * 3, 1.2, M.plant);
    crown.scale.set(1.1, 1.5, 1.0);
  }
}

function buildWorld() {
  buildExterior();
  for (let f = 1; f <= 7; f++) buildFloorShell(f);
  buildFloorOne();
  buildFloorTwo();
  buildFloorThree();
  buildFloorFour();
  buildFloorFive();
  buildFloorSix();
  buildFloorSeven();
  // Entrance mat and automatic sliding doors.
  box(scene, 0, .02, 8.0, 5.0, .05, 1.2, M.dark);
  box(scene, -1.15, 1.45, 8.7, .06, 2.9, .08, M.glass, false, false);
  box(scene, 1.15, 1.45, 8.7, .06, 2.9, .08, M.glass, false, false);
  addSign(scene, 'CHULALONGKORN UNIVERSITY · CENTRAL LIBRARY', 0, 3.25, 8.5, .65);
}

buildWorld();

function showToast(text, duration = 3200) {
  const el = $('toast');
  el.textContent = text;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), duration);
}

function showDialogue(speaker, text) {
  $('dialogue-speaker').textContent = speaker;
  $('dialogue-text').textContent = text;
  $('dialogue').classList.remove('hidden');
  dialogueReturnLock = controls.isLocked;
  if (controls.isLocked) controls.unlock();
}
function closeDialogue() {
  $('dialogue').classList.add('hidden');
  if (dialogueReturnLock) controls.lock();
}
$('dialogue-close').addEventListener('click', closeDialogue);
$('dialogue-next').addEventListener('click', closeDialogue);

function renderState(state) {
  currentState = state;
  $('clock').textContent = state.time;
  $('floor-name').textContent = `${state.floor}F · ${state.floor_name}`;
  $('objective').textContent = state.objective;
  $('mission-count').textContent = `${state.done_count} / ${state.task_count}`;
  $('money').textContent = `฿${state.money}`;
  for (const stat of ['energy', 'hunger', 'stress', 'research']) {
    $(`${stat}-bar`).style.width = `${state[stat]}%`;
    $(`${stat}-value`).textContent = state[stat];
  }
  $('task-list').innerHTML = state.tasks.map(task =>
    `<div class="task ${task.done ? 'done' : ''}"><span class="check">${task.done ? '✓' : ''}</span><span>${task.label}</span></div>`
  ).join('');
  if (state.ended) endDay();
}

function updateFromPython(result) {
  let parsed;
  try { parsed = JSON.parse(result); } catch { return; }
  if (parsed.state) renderState(parsed.state);
  if (parsed.message) showToast(parsed.message, 3600);
}

function interact(action) {
  if (!gameReady || !pyGame) return;
  if (action === 'elevator') {
    openFloorPanel();
    return;
  }
  const result = pyGame.interact(action);
  updateFromPython(result);
  if (action === 'friend') {
    showDialogue('LINH · VIETNAMESE PHD STUDENT',
      '“Ở Bangkok lâu chưa? Dạo này nghiên cứu thế nào rồi? Mình vừa tìm được một bài khá hay về aerosol. Có gì gửi nhau nhé. Tối nay nhớ ăn uống đàng hoàng đấy!”');
  } else if (action === 'checkin') {
    showDialogue('LIBRARY RECEPTION',
      '“Welcome to the Office of Academic Resources. Your study day starts here. Floors 1–6 provide learning and research spaces; check the floor directory for services.”');
  } else if (action === 'coffee') {
    showDialogue('COFFEE CORNER',
      'Iced Thai coffee. A familiar Bangkok ritual: one cup, one laptop, and a long list of things to finish.');
  } else if (action === 'study') {
    showDialogue('RESEARCH SESSION',
      'You work through the PM₂.₅ dataset, check a few plots, and revise the argument in your manuscript. The results are getting clearer — but the discussion still needs work.');
  }
}

function openFloorPanel() {
  if (!gameReady) return;
  $('floor-panel').classList.remove('hidden');
  const active = currentState?.floor;
  document.querySelectorAll('#floor-buttons button').forEach(button => {
    button.classList.toggle('active', Number(button.dataset.floor) === active);
  });
  if (controls.isLocked) controls.unlock();
}
function closeFloorPanel() {
  $('floor-panel').classList.add('hidden');
}
$('floor-close').addEventListener('click', () => {
  closeFloorPanel();
  controls.lock();
});
function changeFloor(floor) {
  if (!gameReady || !pyGame) return;
  const result = pyGame.go_to_floor(floor);
  updateFromPython(result);
  camera.position.set(-9.55, floorY(floor) + 1.7, 5.0);
  camera.rotation.set(0, 0, 0);
  closeFloorPanel();
  controls.lock();
}
$('floor-buttons').innerHTML = Array.from({ length: 7 }, (_, i) =>
  `<button data-floor="${i + 1}">${i + 1}F</button>`
).join('');
$('floor-buttons').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-floor]');
  if (button) changeFloor(Number(button.dataset.floor));
});

function endDay() {
  if ($('end-screen').classList.contains('hidden')) {
    $('end-screen').classList.remove('hidden');
    $('hud').classList.add('hidden');
    $('mobile-controls').classList.add('hidden');
    if (controls.isLocked) controls.unlock();
    const score = Math.round((currentState.research || 0) * .65 + (currentState.social || 0) * .15 + (currentState.energy || 0) * .2);
    $('day-summary').textContent = `${currentState.done_count} / ${currentState.task_count} tasks completed`;
    $('day-detail').textContent = `Research progress: ${currentState.research} · Social connection: ${currentState.social} · Final energy: ${currentState.energy}. Your day score: ${score}/100. Tomorrow is another day in Bangkok.`;
  }
}
$('restart-button').addEventListener('click', () => window.location.reload());

function updateTarget() {
  if (!gameReady || !currentState || $('floor-panel').classList.contains('hidden') === false) return;
  raycaster.setFromCamera(center, camera);
  const hits = raycaster.intersectObjects(interactables, false);
  let found = null;
  for (const hit of hits) {
    const data = hit.object.userData;
    if (data.action && data.floor === currentState.floor && hit.distance < 5.0) {
      found = data;
      break;
    }
  }
  currentTarget = found;
  const prompt = $('interaction-prompt');
  if (found && controls.isLocked) {
    $('interaction-label').textContent = found.label;
    prompt.classList.remove('hidden');
  } else {
    prompt.classList.add('hidden');
  }
}

function movePlayer(dt) {
  if (!gameReady || !currentState || $('floor-panel').classList.contains('hidden') === false) return;
  if (!controls.isLocked && !isMobile()) return;
  const speed = keys.has('shift') ? 7.4 : 4.3;
  camera.getWorldDirection(tmpDir);
  tmpDir.y = 0;
  tmpDir.normalize();
  rightDir.crossVectors(tmpDir, camera.up).normalize();
  moveDir.set(0, 0, 0);
  if (keys.has('w')) moveDir.add(tmpDir);
  if (keys.has('s')) moveDir.sub(tmpDir);
  if (keys.has('d')) moveDir.add(rightDir);
  if (keys.has('a')) moveDir.sub(rightDir);
  if (moveDir.lengthSq() > 0) {
    moveDir.normalize();
    camera.position.addScaledVector(moveDir, speed * dt);
  }
  camera.position.x = THREE.MathUtils.clamp(camera.position.x, -12.2, 12.2);
  camera.position.z = THREE.MathUtils.clamp(camera.position.z, -7.8, 8.0);
  camera.position.y = floorY(currentState.floor) + 1.7;
}

function isMobile() { return window.matchMedia('(max-width: 760px)').matches; }

function setupMobileControls() {
  document.querySelectorAll('.move-pad button').forEach(button => {
    const key = button.dataset.key;
    const down = (e) => { e.preventDefault(); keys.add(key); };
    const up = (e) => { e.preventDefault(); keys.delete(key); };
    button.addEventListener('pointerdown', down);
    button.addEventListener('pointerup', up);
    button.addEventListener('pointerleave', up);
    button.addEventListener('pointercancel', up);
  });
  $('mobile-e').addEventListener('pointerdown', (e) => { e.preventDefault(); if (currentTarget) interact(currentTarget.action); });
  $('mobile-f').addEventListener('pointerdown', (e) => { e.preventDefault(); openFloorPanel(); });
}
setupMobileControls();

document.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (['w','a','s','d','shift'].includes(key)) keys.add(key);
  if (key === 'e' && !event.repeat && currentTarget && controls.isLocked) interact(currentTarget.action);
  if (key === 'f' && !event.repeat) openFloorPanel();
  if (key >= '1' && key <= '7' && !$('floor-panel').classList.contains('hidden')) changeFloor(Number(key));
});
document.addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());

let dragging = false, lastPointerX = 0, lastPointerY = 0;
renderer.domElement.addEventListener('pointerdown', (event) => {
  if (!controls.isLocked && isMobile()) {
    dragging = true; lastPointerX = event.clientX; lastPointerY = event.clientY;
  }
});
window.addEventListener('pointerup', () => dragging = false);
window.addEventListener('pointermove', (event) => {
  if (!dragging || controls.isLocked) return;
  const dx = event.clientX - lastPointerX;
  const dy = event.clientY - lastPointerY;
  lastPointerX = event.clientX; lastPointerY = event.clientY;
  camera.rotation.order = 'YXZ';
  camera.rotation.y -= dx * .004;
  camera.rotation.x = THREE.MathUtils.clamp(camera.rotation.x - dy * .003, -1.25, 1.25);
});

controls.addEventListener('unlock', () => {
  if (!$('intro').classList.contains('hidden') || !$('end-screen').classList.contains('hidden')) return;
  if ($('dialogue').classList.contains('hidden') && $('floor-panel').classList.contains('hidden')) {
    $('pause').classList.remove('hidden');
  }
});
controls.addEventListener('lock', () => $('pause').classList.add('hidden'));
$('resume-button').addEventListener('click', () => controls.lock());

$('start-button').addEventListener('click', () => {
  $('intro').classList.add('hidden');
  $('hud').classList.remove('hidden');
  if (isMobile()) $('mobile-controls').classList.remove('hidden');
  if (!isMobile()) controls.lock();
});
renderer.domElement.addEventListener('click', () => {
  if (!$('intro').classList.contains('hidden') || !$('end-screen').classList.contains('hidden')) return;
  if (!isMobile() && !controls.isLocked && $('floor-panel').classList.contains('hidden') && $('dialogue').classList.contains('hidden')) controls.lock();
});

async function bootPython() {
  try {
    loadingText.textContent = 'Loading Python runtime…';
    pyodide = await window.loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/' });
    loadingText.textContent = 'Loading the student-life simulation…';
    const response = await fetch('/game_logic.py');
    if (!response.ok) throw new Error('Could not load public/game_logic.py');
    const source = await response.text();
    await pyodide.runPythonAsync(source);
    pyGame = pyodide.globals.get('game');
    gameReady = true;
    renderState(JSON.parse(pyGame.state_json()));
    $('loading').classList.add('hidden');
    $('intro').classList.remove('hidden');
  } catch (error) {
    console.error(error);
    loadingText.textContent = `Could not start the Python engine: ${error.message}. Check your internet connection and reload.`;
  }
}
bootPython();

function animate() {
  const dt = Math.min(clock.getDelta(), .05);
  if (gameReady && pyGame && $('end-screen').classList.contains('hidden')) {
    pyGame.tick(dt);
    const now = performance.now();
    if (!animate.lastStateUpdate || now - animate.lastStateUpdate > 600) {
      renderState(JSON.parse(pyGame.state_json()));
      animate.lastStateUpdate = now;
    }
  }
  movePlayer(dt);
  updateTarget();
  const t = performance.now() * .001;
  for (const marker of interactables) {
    if (marker.geometry && marker.geometry.type === 'SphereGeometry') {
      marker.scale.setScalar(1 + Math.sin(t * 2.5 + marker.position.x) * .08);
    }
  }
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
