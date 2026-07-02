(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  const keys = new Set();
  const mouse = { x: W / 2, y: H / 2 };
  const tankImage = new Image();
  tankImage.src = "assets/tank_top.png";

  const tank = {
    x: 130,
    y: 520,
    angle: -Math.PI / 2,
    turretAngle: -Math.PI / 2,
    vx: 0,
    vy: 0,
    av: 0,
    radius: 24,
    boost: 1,
    heat: 0,
  };

  const bullets = [];
  const particles = [];
  const skids = [];

  const checkpoints = [
    { x: 168, y: 516, r: 38, passed: false },
    { x: 180, y: 166, r: 38, passed: false },
    { x: 492, y: 126, r: 38, passed: false },
    { x: 780, y: 218, r: 38, passed: false },
    { x: 764, y: 514, r: 38, passed: false },
    { x: 430, y: 500, r: 38, passed: false },
  ];

  const terrain = [
    { x: 70, y: 72, w: 820, h: 500, type: "asphalt" },
    { x: 58, y: 60, w: 212, h: 180, type: "mud" },
    { x: 650, y: 66, w: 230, h: 170, type: "gravel" },
    { x: 310, y: 384, w: 236, h: 146, type: "ice" },
    { x: 56, y: 438, w: 190, h: 120, type: "mud" },
  ];

  const walls = [
    { x: 32, y: 28, w: 896, h: 28 },
    { x: 32, y: 584, w: 896, h: 28 },
    { x: 32, y: 28, w: 28, h: 584 },
    { x: 900, y: 28, w: 28, h: 584 },
    { x: 314, y: 246, w: 328, h: 34 },
    { x: 314, y: 280, w: 34, h: 136 },
    { x: 608, y: 280, w: 34, h: 136 },
  ];

  let checkpointIndex = 0;
  let lapStart = performance.now();
  let bestLap = null;
  let last = performance.now();

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const len = (x, y) => Math.hypot(x, y);
  const norm = (a) => Math.atan2(Math.sin(a), Math.cos(a));

  function terrainAt(x, y) {
    for (let i = terrain.length - 1; i >= 0; i -= 1) {
      const t = terrain[i];
      if (x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + t.h) return t.type;
    }
    return "dirt";
  }

  function stats(type) {
    if (type === "mud") return { grip: 0.78, drag: 1.85, accel: 0.72 };
    if (type === "gravel") return { grip: 0.86, drag: 1.18, accel: 0.9 };
    if (type === "ice") return { grip: 0.22, drag: 0.16, accel: 0.58 };
    if (type === "asphalt") return { grip: 1.08, drag: 0.72, accel: 1.04 };
    return { grip: 0.92, drag: 0.95, accel: 0.96 };
  }

  function overlap(w, x, y, r) {
    const nx = clamp(x, w.x, w.x + w.w);
    const ny = clamp(y, w.y, w.y + w.h);
    return len(x - nx, y - ny) < r;
  }

  function collideWalls() {
    for (const w of walls) {
      if (!overlap(w, tank.x, tank.y, tank.radius)) continue;
      const left = Math.abs(tank.x - w.x);
      const right = Math.abs(tank.x - (w.x + w.w));
      const top = Math.abs(tank.y - w.y);
      const bottom = Math.abs(tank.y - (w.y + w.h));
      const m = Math.min(left, right, top, bottom);
      if (m === left) { tank.x = w.x - tank.radius; tank.vx = Math.min(tank.vx, 0) * -0.24; }
      else if (m === right) { tank.x = w.x + w.w + tank.radius; tank.vx = Math.max(tank.vx, 0) * -0.24; }
      else if (m === top) { tank.y = w.y - tank.radius; tank.vy = Math.min(tank.vy, 0) * -0.24; }
      else { tank.y = w.y + w.h + tank.radius; tank.vy = Math.max(tank.vy, 0) * -0.24; }
    }
  }

  function dust(x, y, n, color) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const s = 20 + Math.random() * 70;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: 2 + Math.random() * 4, color, life: 0.25 + Math.random() * 0.3 });
    }
  }

  function updateTank(dt) {
    const fx = Math.cos(tank.angle), fy = Math.sin(tank.angle);
    const rx = Math.cos(tank.angle + Math.PI / 2), ry = Math.sin(tank.angle + Math.PI / 2);
    const forwardSpeed = tank.vx * fx + tank.vy * fy;
    const sideSpeed = tank.vx * rx + tank.vy * ry;
    const speed = len(tank.vx, tank.vy);
    const ground = terrainAt(tank.x, tank.y);
    const s = stats(ground);
    const handbrake = keys.has(" ");
    const boosting = (keys.has("Shift") || keys.has("ShiftLeft") || keys.has("ShiftRight")) && tank.boost > 0.05;

    let throttle = 0;
    if (keys.has("w") || keys.has("W") || keys.has("ArrowUp")) throttle += 1;
    if (keys.has("s") || keys.has("S") || keys.has("ArrowDown")) throttle -= 0.78;

    let steer = 0;
    if (keys.has("a") || keys.has("A") || keys.has("ArrowLeft")) steer -= 1;
    if (keys.has("d") || keys.has("D") || keys.has("ArrowRight")) steer += 1;

    const power = 410 * s.accel * (boosting ? 1.68 : 1);
    tank.vx += fx * throttle * power * dt;
    tank.vy += fy * throttle * power * dt;

    if (boosting) { tank.boost = clamp(tank.boost - 0.34 * dt, 0, 1); dust(tank.x - fx * 20, tank.y - fy * 20, 2, "#80fff0"); }
    else tank.boost = clamp(tank.boost + 0.14 * dt, 0, 1);

    const turnAuthority = clamp(Math.abs(forwardSpeed) / 175, 0.22, 1.05);
    const reverse = forwardSpeed < -4 ? -0.72 : 1;
    const turnGrip = handbrake ? s.grip * 0.45 : s.grip;
    const desiredAv = steer * 3.35 * turnAuthority * reverse * turnGrip;
    tank.av += (desiredAv - tank.av) * clamp(8.5 * dt, 0, 1);
    tank.angle += tank.av * dt;

    const lateralGrip = (handbrake ? 3.2 : 10.5) * s.grip;
    tank.vx -= rx * sideSpeed * lateralGrip * dt;
    tank.vy -= ry * sideSpeed * lateralGrip * dt;

    const drag = s.drag + (handbrake ? 1.1 : 0);
    tank.vx -= tank.vx * drag * 0.42 * dt;
    tank.vy -= tank.vy * drag * 0.42 * dt;

    const maxSpeed = boosting ? 365 : 260;
    const currentSpeed = len(tank.vx, tank.vy);
    if (currentSpeed > maxSpeed) {
      tank.vx = tank.vx / currentSpeed * maxSpeed;
      tank.vy = tank.vy / currentSpeed * maxSpeed;
    }

    tank.x += tank.vx * dt;
    tank.y += tank.vy * dt;
    collideWalls();

    const target = Math.atan2(mouse.y - tank.y, mouse.x - tank.x);
    tank.turretAngle += norm(target - tank.turretAngle) * clamp(13 * dt, 0, 1);
    tank.heat = Math.max(0, tank.heat - dt * 1.8);

    if ((Math.abs(sideSpeed) > 32 || handbrake) && speed > 60) {
      skids.push({ x: tank.x - fx * 12, y: tank.y - fy * 12, angle: tank.angle, life: 1 });
      if (skids.length > 160) skids.shift();
    }
    if (speed > 80 && ground !== "asphalt") dust(tank.x - fx * 22, tank.y - fy * 22, 1, ground === "ice" ? "#d7ffff" : "#c7b58c");
  }

  function shoot() {
    if (tank.heat > 0.03) return;
    tank.heat = 0.28;
    const x = tank.x + Math.cos(tank.turretAngle) * 34;
    const y = tank.y + Math.sin(tank.turretAngle) * 34;
    bullets.push({ x, y, vx: Math.cos(tank.turretAngle) * 520 + tank.vx * 0.35, vy: Math.sin(tank.turretAngle) * 520 + tank.vy * 0.35, life: 1.2 });
    dust(x, y, 6, "#f4df9b");
  }

  function updateBullets(dt) {
    for (const b of bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      for (const w of walls) {
        if (b.x >= w.x && b.x <= w.x + w.w && b.y >= w.y && b.y <= w.y + w.h) {
          b.life = -1;
          dust(b.x, b.y, 10, "#7e8b8b");
        }
      }
    }
    for (let i = bullets.length - 1; i >= 0; i -= 1) if (bullets[i].life <= 0) bullets.splice(i, 1);
  }

  function updateEffects(dt) {
    for (const p of particles) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 1 - 2.4 * dt; p.vy *= 1 - 2.4 * dt;
      p.life -= dt;
    }
    for (let i = particles.length - 1; i >= 0; i -= 1) if (particles[i].life <= 0) particles.splice(i, 1);
    for (const s of skids) s.life -= dt * 0.055;
    while (skids.length && skids[0].life <= 0) skids.shift();
  }

  function updateCheckpoints() {
    const cp = checkpoints[checkpointIndex];
    if (!cp) return;
    if (len(tank.x - cp.x, tank.y - cp.y) < cp.r + tank.radius * 0.5) {
      cp.passed = true;
      checkpointIndex += 1;
      dust(cp.x, cp.y, 20, "#9bfff4");
      if (checkpointIndex >= checkpoints.length) {
        const lap = (performance.now() - lapStart) / 1000;
        bestLap = bestLap == null ? lap : Math.min(bestLap, lap);
        for (const c of checkpoints) c.passed = false;
        checkpointIndex = 0;
        lapStart = performance.now();
      }
    }
  }

  function reset() {
    tank.x = 130; tank.y = 520; tank.angle = -Math.PI / 2; tank.turretAngle = -Math.PI / 2;
    tank.vx = 0; tank.vy = 0; tank.av = 0;
  }

  function update(dt) {
    if (keys.has("r") || keys.has("R")) reset();
    updateTank(dt);
    updateBullets(dt);
    updateEffects(dt);
    updateCheckpoints();
  }

  function drawTerrain() {
    ctx.fillStyle = "#263437";
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = "#314346";
    for (let x = 0; x < W; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.restore();
    for (const t of terrain) {
      ctx.fillStyle = t.type === "mud" ? "#4d4733" : t.type === "gravel" ? "#596061" : t.type === "ice" ? "#47656b" : "#303b3e";
      ctx.fillRect(t.x, t.y, t.w, t.h);
    }
  }

  function drawWalls() {
    for (const w of walls) {
      ctx.fillStyle = "#1a2224";
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.strokeStyle = "#526164";
      ctx.strokeRect(w.x + 1, w.y + 1, w.w - 2, w.h - 2);
    }
  }

  function drawCheckpoints() {
    checkpoints.forEach((cp, i) => {
      const active = i === checkpointIndex;
      ctx.save();
      ctx.translate(cp.x, cp.y);
      ctx.globalAlpha = cp.passed ? 0.22 : active ? 0.95 : 0.36;
      ctx.strokeStyle = active ? "#9bfff4" : "#d6f7ed";
      ctx.lineWidth = active ? 5 : 3;
      ctx.beginPath(); ctx.arc(0, 0, cp.r, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = active ? "#9bfff4" : "#d6f7ed";
      ctx.font = "700 18px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(String(i + 1), 0, 0);
      ctx.restore();
    });
  }

  function drawTank() {
    ctx.save();
    ctx.translate(tank.x, tank.y);
    ctx.rotate(tank.angle + Math.PI / 2);
    if (tankImage.complete && tankImage.naturalWidth > 0) {
      const scale = 1.08;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(tankImage, -tankImage.width * scale / 2, -tankImage.height * scale / 2, tankImage.width * scale, tankImage.height * scale);
    } else {
      ctx.fillStyle = "#2f807d";
      ctx.fillRect(-18, -24, 36, 48);
    }
    ctx.restore();

    ctx.save();
    ctx.translate(tank.x, tank.y);
    ctx.rotate(tank.turretAngle);
    ctx.fillStyle = "#245f5e";
    ctx.strokeStyle = "#143b3c";
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.roundRect(-9, -9, 18, 18, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#2d8581";
    ctx.fillRect(5, -4, 38, 8);
    ctx.strokeRect(5, -4, 38, 8);
    ctx.restore();
  }

  function drawEffects() {
    for (const s of skids) {
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.angle);
      ctx.globalAlpha = clamp(s.life, 0, 0.46);
      ctx.fillStyle = "#101516";
      ctx.fillRect(-22, -17, 44, 4); ctx.fillRect(-22, 13, 44, 4);
      ctx.restore();
    }
    for (const p of particles) {
      ctx.globalAlpha = clamp(p.life * 2.5, 0, 0.85);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#f3e5b0";
    for (const b of bullets) { ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill(); }
  }

  function drawHud() {
    const speed = Math.round(len(tank.vx, tank.vy));
    const ground = terrainAt(tank.x, tank.y);
    const lap = ((performance.now() - lapStart) / 1000).toFixed(2);
    ctx.fillStyle = "rgba(9, 13, 14, 0.72)";
    ctx.fillRect(18, 18, 314, 106);
    ctx.strokeStyle = "rgba(155, 255, 244, 0.35)";
    ctx.strokeRect(18.5, 18.5, 313, 105);
    ctx.fillStyle = "#e8f1ef"; ctx.font = "700 18px system-ui"; ctx.fillText("Tank Mobility", 34, 46);
    ctx.font = "14px system-ui"; ctx.fillStyle = "#bdd0cc";
    ctx.fillText(`Velocidad: ${speed}`, 34, 70);
    ctx.fillText(`Terreno: ${ground}`, 34, 92);
    ctx.fillText(`Vuelta: ${lap}s`, 172, 70);
    ctx.fillText(`Mejor: ${bestLap == null ? "—" : bestLap.toFixed(2) + "s"}`, 172, 92);
    ctx.fillStyle = "#203032"; ctx.fillRect(34, 106, 190, 9);
    ctx.fillStyle = "#80fff0"; ctx.fillRect(34, 106, 190 * tank.boost, 9);
    ctx.fillStyle = "#bdd0cc"; ctx.font = "11px system-ui"; ctx.fillText("boost", 232, 115);
  }

  function render() {
    drawTerrain(); drawCheckpoints(); drawEffects(); drawWalls(); drawTank(); drawHud();
  }

  function loop(now) {
    const dt = clamp((now - last) / 1000, 0, 1 / 30);
    last = now;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  window.addEventListener("keydown", (event) => {
    keys.add(event.key);
    if ([" ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) event.preventDefault();
  });
  window.addEventListener("keyup", (event) => keys.delete(event.key));

  canvas.addEventListener("mousemove", (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (event.clientX - rect.left) * (canvas.width / rect.width);
    mouse.y = (event.clientY - rect.top) * (canvas.height / rect.height);
  });
  canvas.addEventListener("mousedown", shoot);

  requestAnimationFrame(loop);
})();
