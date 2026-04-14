(function () {
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  var canvas = document.getElementById("scene");
  if (!canvas || typeof THREE === "undefined") return;

  var reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  var renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    alpha: true,
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    100,
  );
  camera.position.z = window.innerWidth < 640 ? 9 : 7;

  // --- Soft glow texture for particles ---
  var texCanvas = document.createElement("canvas");
  texCanvas.width = 64;
  texCanvas.height = 64;
  var texCtx = texCanvas.getContext("2d");
  var grad = texCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.2, "rgba(255,255,255,0.6)");
  grad.addColorStop(0.6, "rgba(255,255,255,0.15)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  texCtx.fillStyle = grad;
  texCtx.fillRect(0, 0, 64, 64);
  var circleTexture = new THREE.CanvasTexture(texCanvas);

  // --- Thomas strange attractor ---
  // dx/dt = sin(y) - b*x
  // dy/dt = sin(z) - b*y
  // dz/dt = sin(x) - b*z
  // Deterministic chaos — structure from turbulence
  var N = 3500;
  var B = 0.208186;
  var DT = 0.015;
  var S = 0.62;

  var state = new Float32Array(N * 3);
  var positions = new Float32Array(N * 3);
  var colors = new Float32Array(N * 3);

  for (var i = 0; i < N; i++) {
    var x = (Math.random() - 0.5) * 3;
    var y = (Math.random() - 0.5) * 3;
    var z = (Math.random() - 0.5) * 3;

    var warmup = 300 + Math.floor(Math.random() * 400);
    for (var w = 0; w < warmup; w++) {
      x += (Math.sin(y) - B * x) * DT;
      y += (Math.sin(z) - B * y) * DT;
      z += (Math.sin(x) - B * z) * DT;
    }

    var idx = i * 3;
    state[idx] = x;
    state[idx + 1] = y;
    state[idx + 2] = z;
    positions[idx] = x * S;
    positions[idx + 1] = y * S;
    positions[idx + 2] = z * S;
    colors[idx] = 0.38;
    colors[idx + 1] = 0.42;
    colors[idx + 2] = 0.64;
  }

  var geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  var material = new THREE.PointsMaterial({
    size: 0.045,
    map: circleTexture,
    vertexColors: true,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });

  var points = new THREE.Points(geometry, material);
  scene.add(points);

  // --- Background dust ---
  var dustCount = 200;
  var dustGeo = new THREE.BufferGeometry();
  var dustPos = new Float32Array(dustCount * 3);
  for (var d = 0; d < dustCount; d++) {
    dustPos[d * 3] = (Math.random() - 0.5) * 25;
    dustPos[d * 3 + 1] = (Math.random() - 0.5) * 25;
    dustPos[d * 3 + 2] = (Math.random() - 0.5) * 25;
  }
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
  var dustMat = new THREE.PointsMaterial({
    size: 0.014,
    color: 0x3a4268,
    transparent: true,
    opacity: 0.3,
    sizeAttenuation: true,
  });
  scene.add(new THREE.Points(dustGeo, dustMat));

  // --- Interaction ---
  var mouseX = 0,
    mouseY = 0,
    targetMX = 0,
    targetMY = 0;

  document.addEventListener("mousemove", function (e) {
    targetMX = (e.clientX / window.innerWidth - 0.5) * 2;
    targetMY = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  document.addEventListener(
    "touchmove",
    function (e) {
      var t = e.touches[0];
      targetMX = (t.clientX / window.innerWidth - 0.5) * 2;
      targetMY = (t.clientY / window.innerHeight - 0.5) * 2;
    },
    { passive: true },
  );

  window.addEventListener("resize", function () {
    var w = window.innerWidth,
      h = window.innerHeight;
    camera.aspect = w / h;
    camera.position.z = w < 640 ? 9 : 7;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });

  // --- Render loop ---
  function animate() {
    requestAnimationFrame(animate);

    if (!reducedMotion) {
      for (var i = 0; i < N; i++) {
        var idx = i * 3;
        var x = state[idx],
          y = state[idx + 1],
          z = state[idx + 2];
        var dx = Math.sin(y) - B * x;
        var dy = Math.sin(z) - B * y;
        var dz = Math.sin(x) - B * z;

        x += dx * DT;
        y += dy * DT;
        z += dz * DT;

        state[idx] = x;
        state[idx + 1] = y;
        state[idx + 2] = z;
        positions[idx] = x * S;
        positions[idx + 1] = y * S;
        positions[idx + 2] = z * S;

        var speed = Math.sqrt(dx * dx + dy * dy + dz * dz);
        var t = Math.min(speed / 1.4, 1);
        colors[idx] = 0.28 + t * 0.4;
        colors[idx + 1] = 0.32 + t * 0.34;
        colors[idx + 2] = 0.54 + t * 0.26;
      }

      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
      points.rotation.y += 0.0006;
    }

    mouseX += (targetMX - mouseX) * 0.03;
    mouseY += (targetMY - mouseY) * 0.03;
    camera.position.x = mouseX * 0.4;
    camera.position.y = -mouseY * 0.4;
    camera.lookAt(scene.position);

    renderer.render(scene, camera);
  }

  if (reducedMotion) {
    renderer.render(scene, camera);
  } else {
    requestAnimationFrame(animate);
  }
})();
