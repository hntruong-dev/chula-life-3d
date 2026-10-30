import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
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
let gameStarted = false;
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
scene.fog = new THREE.Fog(0x9bb7bd, 46, 130);

const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.1, 180);
camera.position.set(0, -0.65, 26.6); // Approach from outside, looking toward the real-world facade.
camera.rotation.order = 'YXZ';

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65));
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

// v0.2 reference-based architectural reconstruction.
// External visual cues follow official Chulalongkorn images: stepped entrance,
// green rails, white segmented wings, vertical fins, glazing, foliage.
// Furniture and proportions are approximate, not a measured building scan.
const obstacles = [];
function solid(x, z, w, d, floor, pad = 0.12) {
  obstacles.push({ x1:x-w/2-pad, x2:x+w/2+pad, z1:z-d/2-pad, z2:z+d/2+pad, floor });
}
function isBlocked(x, z, floor) {
  const outside = floor === 1 && z >= 8.75;
  if (outside) {
    if (x < -15 || x > 15 || z > 31.5) return true;
    if (z < 10.6 && Math.abs(x) > 2.8) return true; // glazed entrance
  } else {
    if (x < -13.45 || x > 13.45 || z < -8.45 || z > 8.75) return true;
  }
  for (const b of obstacles) {
    if (b.floor === floor && x >= b.x1 && x <= b.x2 && z >= b.z1 && z <= b.z2) return true;
  }
  return false;
}
function terrainHeight(x,z,floor) {
  if (floor !== 1) return floorY(floor);
  if (z <= 9.25) return 0;
  return -2.35 * Math.min(1, (z - 9.25) / 13.25);
}
function linearHandrail(x1,z1,y1,x2,z2,y2, material=M.green, radius=0.045) {
  const dir = new THREE.Vector3(x2-x1,y2-y1,z2-z1);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,dir.length(),9),material);
  mesh.position.set((x1+x2)/2,(y1+y2)/2,(z1+z2)/2);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.clone().normalize());
  scene.add(mesh);
}
function createBambooPlanter(x,y,z) {
  box(scene,x,y+.33,z,1.1,.65,.9,M.concrete,false);
  for(let i=0;i<5;i++) {
    const dx=(i-2)*.16;
    cylinder(scene,x+dx,y+.95,z, .035,.045,.95,M.wood,7);
    for(let a=0;a<3;a++){
      const leaf=sphere(scene,x+dx+(a-1)*.22,y+1.15+a*.22,z+.1,.24,M.plant);
      leaf.scale.set(.7,.42,1.5);
    }
  }
}
function makeTree(x,y,z,r=1.4) {
  cylinder(scene,x,y+1.9,z,.15,.25,3.8,M.wood,9);
  for(let i=0;i<5;i++) {
    const angle=i*2.399;
    const crown=sphere(scene,x+Math.cos(angle)*.65,y+3.85+(i%2)*.45,z+Math.sin(angle)*.6,r,M.plant);
    crown.scale.set(1.1,.85,1.0);
  }
}
function panelSign(text,x,y,z,w=4.0) {
  const s=labelSprite(text,768,90,'rgba(236,238,231,.96)','#25393b');
  s.position.set(x,y,z);s.scale.set(w,.57,1);scene.add(s);
}
function createFacade() {
  const ivory=mat(0xe4e7e1), white=mat(0xf7f8f3), shadow=mat(0x606e6a), greenFrame=mat(0x3f7064,.5,.18);
  const windowGlass=new THREE.MeshStandardMaterial({color:0x789aa1,roughness:.22,metalness:.16,transparent:true,opacity:.69});
  // External stair plaza is lowered below the main entrance landing.
  box(scene,0,-2.51,20.4,39,.30,28,mat(0xa8a9a0),false);
  box(scene,0,-2.47,28.0,38,.05,3.7,mat(0xb9b8ae),false);
  // Architectural side wings visible in the official exterior photograph.
  // Volumes intentionally separated from the navigable inner-floor shell.
  box(scene,-20,11.7,0.6,12,25.5,17,ivory,false);
  box(scene,20,13.7,0.4,11.6,29.5,17,ivory,false);
  for(let floor=1;floor<=6;floor++){
    const y=(floor-1)*4.15;
    // Long horizontal bands in left and right wings, with deep-set balconies.
    for(const xx of [-20,20]) {
      box(scene,xx,y+.37,9.14,11.2,.78,.40,white,false);
      box(scene,xx,y+3.76,9.14,11.2,.58,.42,white,false);
      box(scene,xx,y+2.11,9.16,11.0,2.62,.08,shadow,false);
      for(let k=-2;k<=2;k++){
        box(scene,xx+k*1.94,y+2.06,9.22,.18,2.82,.25,white,false);
        box(scene,xx+k*1.94+.72,y+2.03,9.24,1.26,2.70,.04,windowGlass,false,false);
      }
    }
    // Corner tower's unmistakable horizontal ribs + closely-spaced fins.
    if (floor>1) {
      box(scene,6.8,y+.25,9.55,14.0,.64,.8,white,false);
      box(scene,6.8,y+3.72,9.55,14.0,.58,.8,white,false);
      box(scene,6.8,y+2,9.40,13.4,2.7,.1,windowGlass,false,false);
      for(let x=.5;x<=13.3;x+=.57) {
        box(scene,x,y+2.04,9.86,.07,2.84,.24,ivory,false);
      }
    }
  }
  // A set-back roofline and parapet in off-white concrete.
  box(scene,-1,29.0,.0,31.0,.62,20.2,white,false);
  box(scene,1,29.9,9.4,29.3,1.35,.56,ivory,false);
  // Real-life cue: tall glazed entrance with bilingual Office of Academic Resources sign.
  box(scene,0,3.76,9.32,27.5,.72,.58,white,false);
  box(scene,-8.4,1.80,9.35,9.0,3.14,.12,windowGlass,false,false);
  box(scene,8.4,1.80,9.35,9.0,3.14,.12,windowGlass,false,false);
  for(let x of [-12.8,-9.7,-6.6,-3.4,3.4,6.6,9.7,12.8])
    box(scene,x,1.81,9.48,.11,3.45,.18,greenFrame,false);
  // Keep a 2.8 m clear opening in the middle (not a glass wall).
  box(scene,-2.0,1.60,9.40,1.15,2.78,.10,windowGlass,false,false);
  box(scene,2.0,1.60,9.40,1.15,2.78,.10,windowGlass,false,false);
  box(scene,0,3.48,9.55,6.3,.28,.5,white,false);
  // Parted entry doors; walk through the central opening.
  box(scene,-2.0,1.59,9.55,1.13,2.70,.08,greenFrame,false);
  box(scene,2.0,1.59,9.55,1.13,2.70,.08,greenFrame,false);
  panelSign('OFFICE OF ACADEMIC RESOURCES',0,3.48,10.02,7.2);
  addSign(scene,'สำนักวิทยทรัพยากร · CHULA LIBRARY',0,4.20,10.02,.75);
  // Raised walkway + broad split staircase and landing.
  box(scene,0,-.16,11.1,18,.32,4.2,M.concrete,false);
  const steps=12, startZ=13.0, endZ=23.3;
  for(let i=0;i<steps;i++){
    const z=startZ+(endZ-startZ)*(i+.5)/steps;
    const top=-.19-2.16*(i+1)/steps;
    const bottom=-2.45;
    box(scene,0,(top+bottom)/2,z,18,top-bottom,(endZ-startZ)/steps+.025,M.concrete,false);
    box(scene,0,top+.018,z,18.05,.035,(endZ-startZ)/steps+.035,mat(0xc5c4bb),false);
  }
  // Signature green railings along both staircase wings + centre divides.
  for(const x of [-8.7,-2.6,2.6,8.7]){
    linearHandrail(x,12.7,.68,x,23.6,-1.62,greenFrame,.052);
    for(let k=0;k<=6;k++){
      const t=k/6,z=12.7+t*10.9,y=-.13-t*2.23;
      linearHandrail(x,z,y,x,z,y+.80,greenFrame,.038);
    }
  }
  // Front planters, trees, ramped accessibility cue.
  createBambooPlanter(-10.6,-.03,11.9);createBambooPlanter(10.6,-.03,11.9);
  makeTree(-18,-2.3,20.2,1.5);makeTree(17,-2.3,24.4,1.3);
  makeTree(-21,-2.3,30.0,1.6);
  for(let x of [-12.3,12.3]){
    cylinder(scene,x,-1.95,17.5,.5,.42,.8,M.concrete);
    const b=sphere(scene,x,-1.32,17.5,.53,M.plant);b.scale.set(1.1,.55,1.0);
  }
  // Flanking large ground plane makes the campus context legible.
  box(scene,0,-2.71,18,110,.20,100,mat(0x819985),false);
  for(let x=-40;x<=40;x+=11){
    if(Math.abs(x)<20)continue;
    const h=7+Math.abs(x)%5;
    box(scene,x,h/2-2.5,-42,7,h,9,mat(0xb7c4bb),false);
  }
}
function lampStrip(x,y,z,len=3.2) {
  box(scene,x,y,z,len,.048,.15,M.white,false,false);
  const light=new THREE.PointLight(0xfff0d8,.34,11,2);
  light.position.set(x,y-.3,z);scene.add(light);
}
function createLift(floor) {
  const y=floorY(floor);
  box(scene,-11.15,y+1.65,5.3,3.70,3.28,.25,M.dark,false);
  box(scene,-11.15,y+1.61,5.05,2.38,3.00,.10,M.metal,false);
  box(scene,-11.15,y+1.64,5.02,.035,2.93,.11,M.black,false);
  box(scene,-8.96,y+1.22,5.1,.15,.5,.09,M.metal,false);
  addSign(scene,`ELEVATOR · ${floor}F`,-11.2,y+3.52,5.1,.50);
  addMarker('elevator','Select floor · F',-8.10,y+1.65,4.8,floor);
}
function baseFloor(floor) {
  const y=floorY(floor),white=mat(0xf1f1eb);
  const tile=floor===1?M.floor:(floor===2?M.pale:M.concrete);
  box(scene,0,y-.16,0,28.0,.32,18.0,tile,false);
  box(scene,0,y+3.93,0,28.0,.24,18.0,white,false);
  box(scene,0,y+1.94,-8.95,28.0,3.88,.25,M.wall,false);
  box(scene,-13.92,y+1.96,0,.20,3.92,18,M.wall,false);
  box(scene,13.92,y+1.96,0,.20,3.92,18,M.wall,false);
  // Internal front facade glass gives daylight on floors above entrance.
  if (floor===1) {
    for(const x of [-10.6,-6.0,6.0,10.6]) {
      box(scene,x,y+1.95,8.88,3.75,3.70,.035,M.glass,false,false);
      box(scene,x-1.9,y+1.95,8.90,.10,3.84,.16,M.metal,false);
    }
  } else {
    for(let x=-11.5;x<12;x+=4.5){
      box(scene,x+2.2,y+1.95,8.88,4.2,3.7,.035,M.glass,false,false);
      box(scene,x,y+1.94,8.9,.12,3.84,.16,M.metal,false);
    }
  }
  for(const x of [-12,-5.5,5.5,12])for(const z of [-7.3,7.3])
    box(scene,x,y+1.95,z,.45,3.9,.45,M.concrete,false);
  // Ceiling rails + cross-lights as seen in modern reading spaces.
  for(const x of [-8,0,8]) for(const z of [-4,3.0]) lampStrip(x,y+3.74,z,3.4);
  createLift(floor);
  addSign(scene,`${floor}F · ${floorNames[floor]||'STAFF AREA'}`,0,y+3.27,-8.60,.68);
  createPlant(scene,11.9,y,6.9,.78);
}
function placeDesk(x,y,z,w=2.4,d=1.06,chairs=2,collide=true) {
  createDesk(scene,x,y,z,w,d,chairs);
  if(collide)solid(x,z,w-.20,d+.4,Math.round(y/4.15)+1,.06);
}
function makeKiosk(x,y,z,pink=false) {
  const body=mat(pink?0xd36a8e:0xe9e7e1,.45);
  box(scene,x,y+.85,z,.70,1.7,.58,body);
  box(scene,x,y+1.37,z+.31,.52,.56,.06,M.black,false);
  box(scene,x,y+1.38,z+.351,.42,.44,.008,M.blue,false,false);
  box(scene,x,y+.70,z+.34,.43,.10,.04,M.metal,false);
  solid(x,z,.7,.58,Math.round(y/4.15)+1);
}
function loungeChair(x,y,z) {
  box(scene,x,y+.42,z,.82,.20,.85,M.fabric);
  box(scene,x,y+.83,z-.37,.82,.82,.16,M.fabric);
  box(scene,x-.43,y+.67,z,.11,.42,.80,M.wood);
  box(scene,x+.43,y+.67,z,.11,.42,.80,M.wood);
  solid(x,z,.87,.92,Math.round(y/4.15)+1,.08);
}
function buildFloorOne() {
  const y=0;
  // Service / automated borrowing: both confirmed by library public listings.
  box(scene,-8.75,y+.53,-1.25,5.65,1.06,1.1,M.wood);
  box(scene,-8.75,y+1.10,-1.25,5.8,.08,1.22,M.woodLight);
  box(scene,-8.2,y+1.34,-1.3,.52,.48,.08,M.black);
  addSign(scene,'ONE STOP SERVICE',-8.7,y+2.53,-1.50,.75);
  solid(-8.75,-1.25,5.7,1.2,1);
  addMarker('checkin','Check in at library',-8.25,1.72,.35,1);
  makeKiosk(-10.2,y,2.3,true);makeKiosk(-8.65,y,2.3,false);
  addSign(scene,'SELF-CHECK · BORROW / RETURN',-9.6,y+2.35,2.3,.56);
  // Realistic access-control devices; keep a wide central aisle.
  for(const x of [-2.3,2.3]) {
    box(scene,x,.48,5.9,.33,.96,1.22,M.metal);
    box(scene,x,.99,5.9,.36,.08,.35,M.black);
    solid(x,5.9,.36,1.22,1,.08);
  }
  addSign(scene,'LIBRARY ACCESS',0,2.6,6.0,.6);
  // Front lobby bench + modern flexible seating.
  for(const x of [-3.7,3.7]){
    loungeChair(x,0,1.15);loungeChair(x,0,-.45);
    cylinder(scene,x+.8,.5,.3,.28,.28,1.0,M.woodLight);
  }
  // Library computing: wall of digital terminals.
  for(let x=-2.7;x<=3.2;x+=2.5){
    placeDesk(x,0,-5.0,1.8,.65,1);
    createLaptop(scene,x,.89,-5.12);
  }
  addSign(scene,'LEARNING COMMONS · COMPUTERS',0,2.5,-5.8,.7);
  // Self photocopy / scanning station.
  box(scene,10.4,.55,2.5,1.45,1.1,.97,M.white);
  box(scene,10.4,1.20,2.5,1.12,.23,.82,M.dark);
  box(scene,10.4,1.40,2.5,.58,.15,.38,M.blue);
  solid(10.4,2.5,1.45,1.0,1);
  addMarker('print','Print research notes · ฿10',9.4,1.65,3.35,1);
  panelSign('COPY · PRINT · SCAN',10.5,2.25,2.5,2.8);
  // Seating and help desks, in a light airy space with tall glazed windows.
  createNPC(scene,7.3,0,-2.6,0x576a73,'STAFF','water','Ask for assistance',1);
  createPlant(scene,-12,0,-5.5,1.1);
  createPlant(scene,12,0,-5.5,1.1);
  addMarker('relax','Take a short break',3.4,1.65,1.45,1);
  // Drink stand deliberately described as a game concession, not a verified kiosk.
  box(scene,8.75,.55,-5.8,2.45,1.10,.95,M.wood);
  box(scene,8.75,1.13,-5.8,2.55,.07,1.02,M.woodLight);
  solid(8.75,-5.8,2.5,1.1,1);
  addSign(scene,'COFFEE · GAME CONCESSION',8.75,2.25,-5.8,.58);
  addMarker('coffee','Grab iced coffee · ฿85',8.65,1.77,-4.55,1);
  addMarker('lunch','Eat lunch · ฿120',10.5,1.77,-4.35,1);
}
function buildFloorTwo() {
  const y=floorY(2);
  addSign(scene,'GROUP STUDY · CO-WORKING',0,y+2.95,-7.70,.72);
  // Flexible open co-working space, glass partition rooms.
  for(const xx of [-8.5,0,8.5]){
    const glassZ=-3.3;
    box(scene,xx,y+1.62,glassZ,6.0,3.22,.07,M.glass,false,false);
    box(scene,xx-3,y+1.62,-5.5,.08,3.22,4.2,M.glass,false,false);
    box(scene,xx+3,y+1.62,-5.5,.08,3.22,4.2,M.glass,false,false);
    addSign(scene,`STUDY ROOM ${Math.round((xx+8.5)/8.5)+1}`,xx,y+2.3,glassZ+.05,.44);
    placeDesk(xx,y,-5.75,2.8,.95,2,false);
  }
  for(const xx of [-6,0,6])placeDesk(xx,y,2.5,2.95,1.04,2);
  createNPC(scene,8.4,y,5.8,0xb36b58,'LINH · VIETNAM','friend','Talk to Linh',2);
  addMarker('groupstudy','Join study group',-4.7,y+1.76,4.2,2);
  createPlant(scene,12.3,y,-5.7,1.0);
}
function buildFloorThree() {
  const y=floorY(3);
  // Floor 3 programme may vary; the limited-access AIX/media area is marked approximate.
  addSign(scene,'MEDIA · DIGITAL LEARNING (ILLUSTRATIVE)',0,y+2.92,-7.7,.62);
  box(scene,0,y+1.51,-4.4,11.5,3.02,.08,M.glass,false,false);
  box(scene,-5.75,y+1.50,-5.9,.10,3.0,4.4,M.glass,false,false);
  box(scene,5.75,y+1.50,-5.9,.10,3.0,4.4,M.glass,false,false);
  box(scene,0,y+2.12,-8.30,4.7,1.5,.08,M.black);
  box(scene,0,y+2.12,-8.24,4.3,1.15,.02,M.blue,false,false);
  placeDesk(0,y,-5.8,3.7,.94,3);
  createNPC(scene,9,y,2.0,0x607d65,'MEDIA STAFF','browse','Ask about the space',3);
  addMarker('groupstudy','Discuss a research problem',-3.0,y+1.72,2.6,3);
  for(const x of [-6,0,6])loungeChair(x,y,4.1);
}
function buildFloorFour() {
  const y=floorY(4);
  // Actual library FAQ locates Media & Entertainment Corner on 4F.
  for(const x of [-10,-6,-2,2,6,10]) {
    createBookshelf(scene,x,y,-6.8,2.4,2.4,.65);
    solid(x,-6.8,2.4,.65,4);
  }
  addSign(scene,'COLLECTIONS · QUIET STUDY',0,y+2.93,-8.0,.68);
  for(const x of [-8,0,8]){
    placeDesk(x,y,1.7,3.3,1.0,2);
    createLaptop(scene,x-.28,y+.89,1.55);
  }
  box(scene,9.6,y+1.35,5.4,4.8,2.65,.12,M.glass,false,false);
  addSign(scene,'MEDIA & ENTERTAINMENT CORNER',9.2,y+2.30,5.2,.46);
  loungeChair(8.5,y,4.45);
  addMarker('book','Find PM₂.₅ reference',-1.2,y+1.68,-5.05,4);
  addMarker('study','Work on manuscript',-.5,y+1.68,3.60,4);
  addMarker('relax','Enjoy a quiet seat',8.6,y+1.70,3.22,4);
}
function buildFloorFive() {
  const y=floorY(5);
  addSign(scene,'COLLECTIONS · INDIVIDUAL READING',0,y+2.93,-8,.65);
  for(const xx of [-10,-6,-2,2,6,10]) {
    createBookshelf(scene,xx,y,-6.7,2.3,2.5,.64);solid(xx,-6.7,2.3,.64,5);
  }
  for(const x of [-8,-2,4,10])placeDesk(x,y,1.55,2.5,1.0,1);
  for(const x of [-8,0,8])loungeChair(x,y,5.7);
  createNPC(scene,-8.4,y,3.6,0x5c7991,'ARUN','groupstudy','Exchange research ideas',5);
  addMarker('browse','Browse literature',6.0,y+1.69,-4.8,5);
}
function buildFloorSix() {
  const y=floorY(6);
  addSign(scene,'QUIET READING · COLLECTIONS',0,y+2.95,-8,.62);
  for(const xx of [-10,-6,-2,2,6,10]){
    createBookshelf(scene,xx,y,-6.8,2.3,2.45,.62);solid(xx,-6.8,2.3,.62,6);
  }
  for(const x of [-6,0,6])placeDesk(x,y,2.1,2.85,1.05,2);
  for(const x of [-10,10])loungeChair(x,y,5.8);
  addMarker('browse','Explore the upper collection',0,y+1.7,-4.7,6);
  addMarker('study','Write the discussion section',0,y+1.73,4.0,6);
}
function buildFloorSeven() {
  const y=floorY(7);
  addSign(scene,'7F · NON-PUBLIC / NOT MODELLED',0,y+2.95,-8.0,.66);
  for(const x of [-7,0,7]){
    box(scene,x,y+1.55,-5.2,4.4,2.9,.13,M.glass,false,false);
  }
}
function buildWorld() {
  // Public floors 1–6. The external tower extends to 7F; its layout is not assumed.
  for(let f=1;f<=7;f++)baseFloor(f);
  // Exterior generated by Python/trimesh, loaded as an editable GLB.
  // Falls back to equivalent procedural geometry if the GLB is unavailable.
  const architecturalLoader = new GLTFLoader();
  architecturalLoader.load('/models/chula_exterior_v02.glb', (gltf) => {
    const model = gltf.scene;
    model.name = 'Chula_Central_Library_Exterior_Python_Generated';
    model.traverse((child) => {
      if (child.isMesh) {
        child.receiveShadow = true;
        child.castShadow = false; // baked-like lighting for efficient web rendering
      }
    });
    scene.add(model);
  }, undefined, (error) => {
    console.warn('Could not load Python-generated exterior; using procedural fallback', error);
    createFacade();
  });
  addSign(scene,'OFFICE OF ACADEMIC RESOURCES',0,3.45,10.02,.76);
  buildFloorOne();buildFloorTwo();buildFloorThree();buildFloorFour();
  buildFloorFive();buildFloorSix();buildFloorSeven();
  // Interactive placard outside: orient users on the real-world reference.
  const plaque=labelSprite('CHULA CENTRAL LIBRARY · 3D RECONSTRUCTION',768,110,'rgba(20,38,41,.96)','#f0f2ec');
  plaque.position.set(-8,-.68,25.2);plaque.scale.set(5.9,.72,1);scene.add(plaque);
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
  if (state.ended && gameStarted) endDay();
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
  if (!gameReady || !gameStarted || !$('intro').classList.contains('hidden')) return;
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
  const destination = floor === 0 ? 1 : floor;
  const result = pyGame.go_to_floor(destination);
  updateFromPython(result);
  if (floor === 0) {
    camera.position.set(0, terrainHeight(0,26.5,1) + 1.7, 26.5);
  } else {
    camera.position.set(-8.0, floorY(floor) + 1.7, 4.65);
  }
  camera.rotation.set(0, 0, 0);
  closeFloorPanel();
  if (!isMobile()) controls.lock();
}
$('floor-buttons').innerHTML = '<button data-floor="0">OUT</button>' +
  Array.from({ length: 6 }, (_, i) =>
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
  if (!gameReady || !gameStarted || !currentState ||
      !$('floor-panel').classList.contains('hidden') ||
      !$('dialogue').classList.contains('hidden') ||
      !$('pause').classList.contains('hidden')) {
    $('interaction-prompt').classList.add('hidden');
    currentTarget = null;
    return;
  }
  const look = new THREE.Vector3();
  camera.getWorldDirection(look);
  let best = null, bestScore = Infinity;
  // Proximity + facing check: more reliable than aiming exactly at a tiny orb.
  for (const mesh of interactables) {
    if (mesh.geometry?.type !== 'SphereGeometry') continue;
    const d = mesh.userData;
    if (!d.action || d.floor !== currentState.floor) continue;
    const pos = new THREE.Vector3();
    mesh.getWorldPosition(pos);
    const dist = camera.position.distanceTo(pos);
    if (dist > 3.4) continue;
    const toward = pos.sub(camera.position).normalize();
    const facing = look.dot(toward);
    if (facing < (isMobile() ? -.15 : .02)) continue;
    const score = dist - .6 * facing;
    if (score < bestScore) { bestScore = score; best = d; }
  }
  currentTarget = best;
  if (best && (controls.isLocked || isMobile())) {
    $('interaction-label').textContent = best.label;
    $('interaction-prompt').classList.remove('hidden');
  } else $('interaction-prompt').classList.add('hidden');
}

function movePlayer(dt) {
  if (!gameReady || !gameStarted || !currentState ||
      !$('floor-panel').classList.contains('hidden') ||
      !$('dialogue').classList.contains('hidden') ||
      !$('pause').classList.contains('hidden')) return;
  if (!controls.isLocked && !isMobile()) return;
  const speed = keys.has('shift') ? 6.0 : 3.7;
  camera.getWorldDirection(tmpDir);
  tmpDir.y = 0; tmpDir.normalize();
  rightDir.crossVectors(tmpDir, camera.up).normalize();
  moveDir.set(0,0,0);
  if (keys.has('w')) moveDir.add(tmpDir);
  if (keys.has('s')) moveDir.sub(tmpDir);
  if (keys.has('d')) moveDir.add(rightDir);
  if (keys.has('a')) moveDir.sub(rightDir);
  if (moveDir.lengthSq() > 0) {
    moveDir.normalize().multiplyScalar(speed * dt);
    const nextX = camera.position.x + moveDir.x;
    const nextZ = camera.position.z + moveDir.z;
    const floor = currentState.floor;
    if (!isBlocked(nextX,camera.position.z,floor)) camera.position.x = nextX;
    if (!isBlocked(camera.position.x,nextZ,floor)) camera.position.z = nextZ;
  }
  camera.position.y = terrainHeight(camera.position.x,camera.position.z,currentState.floor) + 1.7;
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
  if (key === 'e' && !event.repeat && currentTarget && (controls.isLocked || isMobile())) interact(currentTarget.action);
  if (key === 'f' && !event.repeat) openFloorPanel();
  if (key >= '0' && key <= '6' && !$('floor-panel').classList.contains('hidden')) changeFloor(Number(key));
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
  gameStarted = true;
  $('intro').classList.add('hidden');
  $('hud').classList.remove('hidden');
  showToast('Khởi hành từ cầu thang trước tòa nhà. WASD lên thư viện, F để chọn tầng.', 5900);
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
  if (gameStarted && gameReady && pyGame &&
      $('end-screen').classList.contains('hidden') &&
      $('pause').classList.contains('hidden') &&
      $('dialogue').classList.contains('hidden') &&
      $('floor-panel').classList.contains('hidden')) {
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
