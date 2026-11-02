/**
 * The 3D PCA lab: a Gaussian cloud whose shape the visitor controls, its principal axes, a
 * projection plane (PCA's, or one the visitor tilts) and an animated projection
 * x → x̃ = μ + P Pᵀ (x − μ), with optional drop lines.
 *
 * Orbit with the mouse; on touch screens the scene is "parked" until tapped, so it never
 * hijacks page scrolling.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { onThemeChange, isDark } from '@lucabonaldo/design';
import { rng, normalSampler, covarianceMatrix, eigenSymmetric } from '../lib/stats.js';

var N = 320;

function themeColors() {
  var dark = isDark();
  return {
    point: new THREE.Color(dark ? 0xf0ecdf : 0x1a1712),
    proj: new THREE.Color(dark ? 0xec6a45 : 0xb02e0c),
    axis: new THREE.Color(dark ? 0x8a8478 : 0x8a8478),
    pcs: [
      new THREE.Color(dark ? 0xe8673f : 0xc2410c),
      new THREE.Color(dark ? 0x5b95da : 0x2563a8),
      new THREE.Color(dark ? 0x2fab84 : 0x13866a),
    ],
    plane: new THREE.Color(dark ? 0xec6a45 : 0xb02e0c),
  };
}

function textSprite(text, color) {
  var c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  var g = c.getContext('2d');
  g.font = '600 34px Inter, sans-serif';
  g.fillStyle = color;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 64, 32);
  var tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  var s = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }),
  );
  s.scale.set(0.9, 0.45, 1);
  return s;
}

/** Point sprite texture: a soft disc */
function discTexture() {
  var c = document.createElement('canvas');
  c.width = c.height = 64;
  var g = c.getContext('2d');
  var grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.55, 'rgba(255,255,255,1)');
  grd.addColorStop(0.7, 'rgba(255,255,255,0.6)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  var t = new THREE.CanvasTexture(c);
  return t;
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function norm(a) {
  var l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}
function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/**
 * createPca3d(host, onChange) → api
 * api.set({ s1, s2, s3, yaw, pitch, mode, theta, phi, t, drops, showPcs, showPlane })
 * onChange(state) receives { points, P, eig, projVar, pcaVar, total }
 */
export function createPca3d(host, onChange) {
  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (err) {
    host.innerHTML = '<p class="loading">WebGL is not available in this browser.</p>';
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  host.append(renderer.domElement);

  var hint = document.createElement('div');
  hint.className = 'three-hint';
  host.append(hint);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
  camera.position.set(9, 6.5, 11);
  var controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 6;
  controls.maxDistance = 30;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.6;

  var coarse = window.matchMedia('(pointer: coarse)').matches;
  var active = !coarse;
  function setActive(v) {
    active = v;
    controls.enabled = v;
    host.style.touchAction = v ? 'none' : 'pan-y';
    hint.textContent = coarse
      ? v
        ? 'Drag to orbit · pinch to zoom · tap outside to release'
        : 'Tap to explore in 3D'
      : 'Drag to orbit · scroll-zoom with ctrl/⌘';
  }
  setActive(active);
  if (coarse) {
    host.addEventListener('click', function () {
      if (!active) setActive(true);
    });
    document.addEventListener('pointerdown', function (e) {
      if (active && !host.contains(e.target)) setActive(false);
    });
  } else {
    // keep the page scrolling with the wheel; zoom only with a modifier
    controls.enableZoom = false;
    renderer.domElement.addEventListener(
      'wheel',
      function (e) {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          var f = e.deltaY > 0 ? 1.08 : 0.92;
          camera.position.multiplyScalar(f);
          camera.position.clampLength(controls.minDistance, controls.maxDistance);
        }
      },
      { passive: false },
    );
  }
  controls.addEventListener('start', function () {
    controls.autoRotate = false;
  });

  var col = themeColors();

  // ---- axes ----------------------------------------------------------------
  var axesGroup = new THREE.Group();
  scene.add(axesGroup);
  var L = 5;
  var axisMat = new THREE.LineBasicMaterial({ color: col.axis, transparent: true, opacity: 0.6 });
  var labels = [];
  [
    [L, 0, 0, 'x₁'],
    [0, L, 0, 'x₂'],
    [0, 0, L, 'x₃'],
  ].forEach(function (a) {
    var gg = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-a[0], -a[1], -a[2]),
      new THREE.Vector3(a[0], a[1], a[2]),
    ]);
    axesGroup.add(new THREE.Line(gg, axisMat));
    var s = textSprite(a[3], '#8a8478');
    s.position.set(a[0] * 1.08, a[1] * 1.08, a[2] * 1.08);
    axesGroup.add(s);
    labels.push(s);
  });
  var gridHelper = new THREE.GridHelper(10, 10, col.axis, col.axis);
  gridHelper.material.transparent = true;
  gridHelper.material.opacity = 0.12;
  gridHelper.position.y = -L;
  scene.add(gridHelper);

  // ---- points --------------------------------------------------------------
  var g = normalSampler(rng(65));
  var base = [];
  for (var i = 0; i < N; i++) base.push([g(), g(), g()]);
  var pos = new Float32Array(N * 3);
  var colArr = new Float32Array(N * 3);
  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
  var pmat = new THREE.PointsMaterial({
    size: 0.2,
    map: discTexture(),
    vertexColors: true,
    transparent: true,
    alphaTest: 0.2,
    depthWrite: false,
  });
  var points = new THREE.Points(geo, pmat);
  scene.add(points);

  // drop lines x → x̃
  var dropPos = new Float32Array(N * 6);
  var dropGeo = new THREE.BufferGeometry();
  dropGeo.setAttribute('position', new THREE.BufferAttribute(dropPos, 3));
  var dropMat = new THREE.LineBasicMaterial({ color: col.proj, transparent: true, opacity: 0.35 });
  var drops = new THREE.LineSegments(dropGeo, dropMat);
  scene.add(drops);

  // principal axes
  var arrows = [0, 1, 2].map(function (k) {
    var a = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(),
      1,
      col.pcs[k],
      0.4,
      0.22,
    );
    a.line.material.linewidth = 2;
    scene.add(a);
    return a;
  });
  var pcLabels = ['PC1', 'PC2', 'PC3'].map(function (t, k) {
    var s = textSprite(t, '#' + col.pcs[k].getHexString());
    scene.add(s);
    return s;
  });

  // projection plane
  var planeGeo = new THREE.PlaneGeometry(9, 9);
  var planeMat = new THREE.MeshBasicMaterial({
    color: col.plane,
    transparent: true,
    opacity: 0.1,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  var plane = new THREE.Mesh(planeGeo, planeMat);
  scene.add(plane);
  var planeEdge = new THREE.LineSegments(
    new THREE.EdgesGeometry(planeGeo),
    new THREE.LineBasicMaterial({ color: col.plane, transparent: true, opacity: 0.45 }),
  );
  plane.add(planeEdge);

  // ---- state -----------------------------------------------------------------
  var state = {
    s1: 2.2,
    s2: 1.1,
    s3: 0.35,
    yaw: 35,
    pitch: 25,
    roll: 10,
    mode: 'pca',
    theta: 0,
    phi: 90,
    t: 0,
    drops: false,
    showPcs: true,
    showPlane: true,
  };
  var data = [];
  var eig = null;
  var mu = [0, 0, 0];
  var P1 = [1, 0, 0];
  var P2 = [0, 1, 0];

  function rotation() {
    var e = new THREE.Euler(
      THREE.MathUtils.degToRad(state.pitch),
      THREE.MathUtils.degToRad(state.yaw),
      THREE.MathUtils.degToRad(state.roll),
      'YXZ',
    );
    return new THREE.Matrix4().makeRotationFromEuler(e);
  }

  function rebuild() {
    var R = rotation();
    var v = new THREE.Vector3();
    data = base.map(function (b) {
      v.set(b[0] * state.s1, b[1] * state.s2, b[2] * state.s3).applyMatrix4(R);
      return [v.x, v.y, v.z];
    });
    mu = [0, 1, 2].map(function (k) {
      var s = 0;
      data.forEach(function (d) {
        s += d[k];
      });
      return s / data.length;
    });
    eig = eigenSymmetric(covarianceMatrix(data));
  }

  function planeBasis() {
    if (state.mode === 'pca') {
      P1 = eig[0].vector.slice();
      P2 = eig[1].vector.slice();
    } else {
      // normal from spherical angles; build an orthonormal basis of the plane
      var th = THREE.MathUtils.degToRad(state.theta);
      var ph = THREE.MathUtils.degToRad(state.phi);
      var n = [Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)];
      var ref = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      P1 = norm(cross(ref, n));
      P2 = norm(cross(n, P1));
    }
  }

  function projVariance(a, b) {
    var cov = covarianceMatrix(data);
    function q(v) {
      var s = 0;
      for (var i2 = 0; i2 < 3; i2++) for (var j = 0; j < 3; j++) s += v[i2] * cov[i2][j] * v[j];
      return s;
    }
    return q(a) + q(b);
  }

  function apply() {
    planeBasis();
    var tt = state.t;
    var ease = tt * tt * (3 - 2 * tt);
    for (var i3 = 0; i3 < N; i3++) {
      var d = data[i3];
      var c0 = [d[0] - mu[0], d[1] - mu[1], d[2] - mu[2]];
      var y1 = dot(P1, c0);
      var y2 = dot(P2, c0);
      var tx = mu[0] + P1[0] * y1 + P2[0] * y2;
      var ty = mu[1] + P1[1] * y1 + P2[1] * y2;
      var tz = mu[2] + P1[2] * y1 + P2[2] * y2;
      pos[i3 * 3] = d[0] + (tx - d[0]) * ease;
      pos[i3 * 3 + 1] = d[1] + (ty - d[1]) * ease;
      pos[i3 * 3 + 2] = d[2] + (tz - d[2]) * ease;
      var cc = col.point.clone().lerp(col.proj, ease);
      colArr[i3 * 3] = cc.r;
      colArr[i3 * 3 + 1] = cc.g;
      colArr[i3 * 3 + 2] = cc.b;
      dropPos[i3 * 6] = d[0];
      dropPos[i3 * 6 + 1] = d[1];
      dropPos[i3 * 6 + 2] = d[2];
      dropPos[i3 * 6 + 3] = tx;
      dropPos[i3 * 6 + 4] = ty;
      dropPos[i3 * 6 + 5] = tz;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    dropGeo.attributes.position.needsUpdate = true;
    drops.visible = state.drops;

    arrows.forEach(function (a, k) {
      var v = eig[k].vector;
      var len = Math.max(0.3, 2 * Math.sqrt(eig[k].value));
      a.position.set(mu[0], mu[1], mu[2]);
      a.setDirection(new THREE.Vector3(v[0], v[1], v[2]));
      a.setLength(len, Math.min(0.45, len * 0.3), Math.min(0.25, len * 0.18));
      a.visible = state.showPcs;
      pcLabels[k].position.set(
        mu[0] + v[0] * (len + 0.45),
        mu[1] + v[1] * (len + 0.45),
        mu[2] + v[2] * (len + 0.45),
      );
      pcLabels[k].visible = state.showPcs;
    });

    var n2 = cross(P1, P2);
    var m = new THREE.Matrix4().makeBasis(
      new THREE.Vector3(P1[0], P1[1], P1[2]),
      new THREE.Vector3(P2[0], P2[1], P2[2]),
      new THREE.Vector3(n2[0], n2[1], n2[2]),
    );
    plane.quaternion.setFromRotationMatrix(m);
    plane.position.set(mu[0], mu[1], mu[2]);
    plane.visible = state.showPlane;

    var total = eig[0].value + eig[1].value + eig[2].value;
    if (onChange)
      onChange({
        data: data,
        mu: mu,
        P1: P1,
        P2: P2,
        eig: eig,
        total: total,
        projVar: projVariance(P1, P2),
        pcaVar: eig[0].value + eig[1].value,
      });
    kick();
  }

  // ---- render loop -------------------------------------------------------------
  var visible = false;
  var raf = 0;
  function resize() {
    var w = host.clientWidth;
    var h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  function frame() {
    raf = 0;
    controls.update();
    renderer.render(scene, camera);
    if (visible && !document.hidden) raf = requestAnimationFrame(frame);
  }
  function kick() {
    if (!raf && visible) raf = requestAnimationFrame(frame);
  }
  new IntersectionObserver(function (e) {
    visible = e[0].isIntersecting;
    kick();
  }).observe(host);
  new ResizeObserver(function () {
    resize();
    kick();
  }).observe(host);
  document.addEventListener('visibilitychange', kick);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) controls.autoRotate = false;

  onThemeChange(function () {
    col = themeColors();
    axisMat.color = col.axis;
    dropMat.color = col.proj;
    planeMat.color = col.plane;
    planeEdge.material.color = col.plane;
    arrows.forEach(function (a, k) {
      a.setColor(col.pcs[k]);
    });
    apply();
  });

  rebuild();
  resize();
  apply();

  return {
    set: function (patch) {
      var reshape = ['s1', 's2', 's3', 'yaw', 'pitch', 'roll'].some(function (k) {
        return k in patch && patch[k] !== state[k];
      });
      Object.assign(state, patch);
      if (reshape) rebuild();
      apply();
    },
    get state() {
      return state;
    },
    resetCamera: function () {
      camera.position.set(9, 6.5, 11);
      controls.target.set(0, 0, 0);
      controls.autoRotate = false;
      kick();
    },
    lookAlongNormal: function () {
      var n2 = cross(P1, P2);
      var d = camera.position.length();
      camera.position.set(n2[0] * d, n2[1] * d, n2[2] * d);
      camera.up.set(P2[0], P2[1], P2[2]);
      controls.autoRotate = false;
      controls.update();
      camera.up.set(0, 1, 0);
      kick();
    },
  };
}
