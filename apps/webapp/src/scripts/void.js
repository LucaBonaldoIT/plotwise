/**
 * The title screen: ~1,200 particles that scroll from noise (phase I) into a table of objects ×
 * attributes (phase II) and then into the Iris dataset in 3D (phase III–IV).
 *
 * One BufferGeometry carries the three target layouts as attributes; the vertex shader mixes
 * them with two uniforms driven by scroll. Rendering pauses off-screen and when the tab is
 * hidden; reduced motion keeps the morph (it is scroll-driven) but drops the idle drift.
 */
import * as THREE from 'three';
import { isDark, onThemeChange } from '@lucabonaldo/design';
import { loadCsv } from '../lib/data.js';
import { rng, normalSampler } from '../lib/stats.js';

var COPIES = 8;
var N = 150 * COPIES;
var GRID_COLS = 24;
var GRID_ROWS = N / GRID_COLS;
var SPECIES = ['setosa', 'versicolor', 'virginica'];
/*
 * Dark: cream light added onto the night sky. Light: ink laid onto paper, with dim particles fading
 * toward the paper instead of toward black. Species follow the chart series of each theme.
 */
var PALETTE = {
  dark: {
    base: [0.94, 0.925, 0.875],
    accent: [0.92, 0.38, 0.22],
    species: [
      [0.91, 0.4, 0.25],
      [0.36, 0.58, 0.85],
      [0.18, 0.67, 0.52],
    ],
    axes: 0xf0ecdf,
    opacity: 1,
  },
  light: {
    base: [0.1, 0.09, 0.07],
    accent: [0.76, 0.25, 0.05],
    species: [
      [0.76, 0.25, 0.05],
      [0.15, 0.39, 0.66],
      [0.07, 0.53, 0.42],
    ],
    axes: 0x1a1712,
    opacity: 0.65,
  },
};
var PAPER = [0.96, 0.95, 0.92];

var VERT = /* glsl */ `
  uniform float uM1;
  uniform float uM2;
  uniform float uTime;
  uniform float uSize;
  uniform float uDrift;
  attribute vec3 aNoise;
  attribute vec3 aGrid;
  attribute vec3 aIris;
  attribute vec3 aC0;
  attribute vec3 aC1;
  attribute vec3 aC2;
  attribute float aSeed;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec3 n = aNoise;
    float t = uTime * 0.15 + aSeed * 6.2831;
    n += uDrift * vec3(sin(t) * 0.25, cos(t * 1.3) * 0.25, sin(t * 0.7) * 0.25);
    // stagger the morph per particle so it ripples instead of snapping
    float s = aSeed * 0.35;
    float m1 = smoothstep(s, s + 0.65, uM1);
    float m2 = smoothstep(s, s + 0.65, uM2);
    vec3 p = mix(mix(n, aGrid, m1), aIris, m2);
    vec3 c = mix(mix(aC0, aC1, m1), aC2, m2);
    vColor = c;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float twinkle = 0.75 + 0.25 * sin(uTime * 2.0 + aSeed * 40.0) * (1.0 - m1);
    vAlpha = twinkle;
    gl_PointSize = uSize * (1.0 + 0.6 * (1.0 - m1) * aSeed) / -mv.z;
  }
`;

var FRAG = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.15, d);
    gl_FragColor = vec4(vColor, a * vAlpha * uOpacity);
  }
`;

function smooth(a, b, x) {
  var t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function initVoid() {
  var host = document.getElementById('void-canvas');
  var section = document.querySelector('.void');
  if (!host || !section) return;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (err) {
    host.classList.add('void__canvas--fallback');
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  host.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
  camera.position.set(0, 0, 9);

  var group = new THREE.Group();
  scene.add(group);

  var rand = rng(1912);
  var g = normalSampler(rand);

  var noise = new Float32Array(N * 3);
  var grid = new Float32Array(N * 3);
  var iris = new Float32Array(N * 3);
  var c0 = new Float32Array(N * 3);
  var c1 = new Float32Array(N * 3);
  var c2 = new Float32Array(N * 3);
  var seed = new Float32Array(N);
  // per-particle color recipe, turned into colors by paint() for the current theme
  var dim0 = new Float32Array(N);
  var acc0 = new Uint8Array(N);
  var hot1 = new Uint8Array(N);
  var species2 = new Uint8Array(N);

  var hotCol = 7;
  var hotRow = 13;
  for (var i = 0; i < N; i++) {
    // noise: a loose spiral nebula
    var r = Math.pow(rand(), 0.6) * 5.5;
    var th = rand() * Math.PI * 2 + r * 0.6;
    noise[i * 3] = Math.cos(th) * r + g() * 0.35;
    noise[i * 3 + 1] = g() * 0.9 * (1 - r / 8);
    noise[i * 3 + 2] = Math.sin(th) * r + g() * 0.35;
    seed[i] = rand();

    // grid: rows are objects, columns attributes
    var col = i % GRID_COLS;
    var row = Math.floor(i / GRID_COLS);
    grid[i * 3] = (col - (GRID_COLS - 1) / 2) * 0.3;
    grid[i * 3 + 1] = ((GRID_ROWS - 1) / 2 - row) * 0.13;
    grid[i * 3 + 2] = 0;

    dim0[i] = 0.55 + rand() * 0.45;
    acc0[i] = rand() < 0.06 ? 1 : 0;
    hot1[i] = col === hotCol || row === hotRow ? 1 : 0;
  }

  var pal = null;

  // strength 1 is the full color; lower fades toward black (dark) or toward the paper (light)
  function put(arr, i, rgb, strength) {
    for (var k = 0; k < 3; k++) {
      arr[i * 3 + k] =
        pal === PALETTE.dark ? rgb[k] * strength : PAPER[k] + (rgb[k] - PAPER[k]) * strength;
    }
  }

  function paintSpecies() {
    for (var i = 0; i < N; i++) put(c2, i, pal.species[species2[i]], 1);
  }

  function paint() {
    pal = isDark() ? PALETTE.dark : PALETTE.light;
    for (var i = 0; i < N; i++) {
      put(c0, i, acc0[i] ? pal.accent : pal.base, dim0[i]);
      put(c1, i, hot1[i] ? pal.accent : pal.base, hot1[i] ? 1 : 0.7);
    }
    paintSpecies();
  }
  paint();

  function placeIris(rows) {
    // x: sepal length, y: petal length, z: petal width (cm), centered
    var mx = 5.84;
    var my = 3.76;
    var mz = 1.2;
    for (var i = 0; i < N; i++) {
      var k = i % rows.length;
      var d = rows[k];
      var j = 0.06;
      iris[i * 3] = (d.sepal_length - mx) * 1.45 + g() * j;
      iris[i * 3 + 1] = (d.petal_length - my) * 0.8 + g() * j;
      iris[i * 3 + 2] = (d.petal_width - mz) * 2.0 + g() * j;
      species2[i] = Math.max(0, SPECIES.indexOf(d.species));
    }
    paintSpecies();
    if (geo) {
      geo.attributes.aIris.needsUpdate = true;
      geo.attributes.aC2.needsUpdate = true;
    }
  }

  // placeholder clusters until iris.csv arrives
  var fake = [];
  [
    [5.0, 1.46, 0.25, 'setosa'],
    [5.94, 4.26, 1.33, 'versicolor'],
    [6.59, 5.55, 2.03, 'virginica'],
  ].forEach(function (m) {
    for (var k = 0; k < 50; k++) {
      fake.push({
        sepal_length: m[0] + g() * 0.4,
        petal_length: m[1] + g() * 0.4,
        petal_width: m[2] + g() * 0.2,
        species: m[3],
      });
    }
  });
  var geo = null;
  placeIris(fake);

  geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(noise, 3));
  geo.setAttribute('aNoise', new THREE.BufferAttribute(noise, 3));
  geo.setAttribute('aGrid', new THREE.BufferAttribute(grid, 3));
  geo.setAttribute('aIris', new THREE.BufferAttribute(iris, 3));
  geo.setAttribute('aC0', new THREE.BufferAttribute(c0, 3));
  geo.setAttribute('aC1', new THREE.BufferAttribute(c1, 3));
  geo.setAttribute('aC2', new THREE.BufferAttribute(c2, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 10);

  var uniforms = {
    uM1: { value: 0 },
    uM2: { value: 0 },
    uTime: { value: 0 },
    uSize: { value: 90 },
    uDrift: { value: reduced ? 0 : 1 },
    uOpacity: { value: pal.opacity },
  };
  var mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: uniforms,
    transparent: true,
    depthWrite: false,
    blending: pal === PALETTE.dark ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  var points = new THREE.Points(geo, mat);
  group.add(points);

  // axes for the iris phase
  var axesGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-2.6, -2.6, -2.4),
    new THREE.Vector3(2.8, -2.6, -2.4),
    new THREE.Vector3(-2.6, -2.6, -2.4),
    new THREE.Vector3(-2.6, 2.6, -2.4),
    new THREE.Vector3(-2.6, -2.6, -2.4),
    new THREE.Vector3(-2.6, -2.6, 2.8),
  ]);
  var axesMat = new THREE.LineBasicMaterial({ color: pal.axes, transparent: true, opacity: 0 });
  var axes = new THREE.LineSegments(axesGeo, axesMat);
  group.add(axes);

  loadCsv('iris.csv')
    .then(placeIris)
    .catch(function () {});

  /* ---- interaction ---------------------------------------------------- */

  var yaw = 0;
  var pitch = 0.18;
  var dragYaw = 0;
  var shownDrag = 0;
  var dragPitch = 0;
  var pointer = { x: 0, y: 0 };
  var dragging = false;
  var last = null;

  host.addEventListener('pointermove', function (e) {
    var r = host.getBoundingClientRect();
    pointer.x = (e.clientX - r.left) / r.width - 0.5;
    pointer.y = (e.clientY - r.top) / r.height - 0.5;
    if (dragging && last) {
      dragYaw += (e.clientX - last.x) * 0.008;
      dragPitch = Math.max(-0.9, Math.min(0.9, dragPitch + (e.clientY - last.y) * 0.004));
      last = { x: e.clientX, y: e.clientY };
    }
  });
  host.addEventListener('pointerdown', function (e) {
    dragging = true;
    last = { x: e.clientX, y: e.clientY };
  });
  window.addEventListener('pointerup', function () {
    dragging = false;
    last = null;
  });

  // the steps overlay sits above the canvas; let drags on empty space reach it
  var steps = section.querySelector('.void__steps');
  steps.addEventListener('pointerdown', function (e) {
    if (e.target.closest('a,button')) return;
    dragging = true;
    last = { x: e.clientX, y: e.clientY };
  });
  steps.addEventListener('pointermove', function (e) {
    if (dragging && last) {
      dragYaw += (e.clientX - last.x) * 0.008;
      last = { x: e.clientX, y: e.clientY };
    }
  });

  /* ---- scroll → morph ------------------------------------------------- */

  var hudSignal = document.getElementById('hud-signal');
  var hudPhase = document.getElementById('hud-phase');
  var hudCoords = document.getElementById('hud-coords');
  var progress = 0;

  function readScroll() {
    var rect = section.getBoundingClientRect();
    var total = rect.height - window.innerHeight;
    progress = Math.min(1, Math.max(0, -rect.top / Math.max(1, total)));
  }

  /* ---- render loop ---------------------------------------------------- */

  var visible = true;
  var raf = 0;
  var clock = new THREE.Clock();
  var shownSignal = 0;

  function resize() {
    var w = host.clientWidth;
    var h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the scene framed on narrow screens
    camera.position.z = w < h ? 9 + (h / w - 1) * 6 : 9;
    camera.updateProjectionMatrix();
    uniforms.uSize.value = Math.max(60, Math.min(110, h / 7));
  }

  function frame() {
    raf = 0;
    var dt = Math.min(0.05, clock.getDelta());
    uniforms.uTime.value += reduced ? 0 : dt;
    readScroll();

    // 5 steps; scroll position s in [0, 4]
    var s = progress * 4;
    var m1 = smooth(0.85, 1.55, s);
    var m2 = smooth(2.3, 3.0, s);
    uniforms.uM1.value = m1;
    uniforms.uM2.value = m2;
    axesMat.opacity = 0.35 * smooth(2.7, 3.2, s);

    // the grid faces the viewer; noise and iris rotate
    // the spin advances by speed × dt rather than being derived from uTime, so changing speed with
    // scroll never jumps the angle (it used to spin the cloud once per 63 s the page had been open);
    // facing the grid turns to the nearest front-facing angle, at most half a turn away
    var faceFront = m1 * (1 - m2);
    if (!reduced) yaw += dt * (0.06 + 0.1 * m2) * (1 - faceFront);
    var front = Math.round(yaw / (Math.PI * 2)) * Math.PI * 2;
    yaw += (front - yaw) * 0.08 * faceFront;
    shownDrag += (dragYaw - shownDrag) * 0.08;
    var targetPitch = (pitch + dragPitch) * (1 - faceFront) + pointer.y * 0.25;
    group.rotation.y = yaw + shownDrag + pointer.x * 0.35;
    group.rotation.x += (targetPitch - group.rotation.x) * 0.06;
    var zoom = (1 - 0.12 * faceFront) * (1 - 0.1 * m2);
    group.scale.setScalar(zoom);

    // HUD
    var target = Math.round(N * Math.min(1, 0.15 + s * 0.6));
    shownSignal += (target - shownSignal) * 0.08;
    hudSignal.textContent = String(Math.round(shownSignal)).padStart(4, '0');
    var phase = s < 1.2 ? 'I' : s < 2.5 ? 'II' : s < 3.4 ? 'III' : 'IV';
    hudPhase.textContent = phase + ' / IV';
    if (Math.floor(uniforms.uTime.value * 6) % 2 === 0) {
      var k = Math.floor(rand() * N);
      hudCoords.textContent =
        'obj ' +
        String(k).padStart(4, '0') +
        ' · x ' +
        noise[k * 3].toFixed(3) +
        ' · y ' +
        noise[k * 3 + 1].toFixed(3) +
        ' · z ' +
        noise[k * 3 + 2].toFixed(3);
    }

    renderer.render(scene, camera);
    if (visible && !document.hidden) raf = requestAnimationFrame(frame);
  }

  function kick() {
    if (!raf && visible && !document.hidden) {
      clock.getDelta();
      raf = requestAnimationFrame(frame);
    }
  }

  new IntersectionObserver(function (entries) {
    visible = entries[0].isIntersecting;
    kick();
  }).observe(section);
  document.addEventListener('visibilitychange', kick);
  new ResizeObserver(function () {
    resize();
    kick();
  }).observe(host);
  window.addEventListener('scroll', kick, { passive: true });

  onThemeChange(function () {
    paint();
    geo.attributes.aC0.needsUpdate = true;
    geo.attributes.aC1.needsUpdate = true;
    geo.attributes.aC2.needsUpdate = true;
    uniforms.uOpacity.value = pal.opacity;
    mat.blending = pal === PALETTE.dark ? THREE.AdditiveBlending : THREE.NormalBlending;
    mat.needsUpdate = true;
    axesMat.color.setHex(pal.axes);
    kick();
  });

  resize();
  kick();
}
