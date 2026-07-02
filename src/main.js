(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const W = canvas.width;
  const H = canvas.height;

  const keys = new Set();
  const mouse = { x: W / 2, y: H / 2, down: false };

  const tankImage = new Image();
  tankImage.src = "assets/tank_top.png";

  const tank = {
    x: 130,
    y: 520,
    angle: -Math.PI / 2,
    turretAngle: -Math.PI / 2,
    vx: 0,
    vy: 0,
    angularVelocity: 0,
    radius: 24,
    boost: 1,
    heat: 0,
  };

  const bullets = [];
  const skidMarks = [];
  const particles = [];

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
  let lastTime = performance.now();

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function length(x, y) {
    return Math.hypot(x, y);
  }

  function normalizeAngle(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  function currentTerrainAt(x, y) {
    for (let i = terrain.length - 1; i >= 0; i -= 1) {
      const t = terrain[i];
      if (x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + t.h) {
        return t.type;
      }
    }
    return "dirt";
  }

  function terrainStats(type) {
    switch (type) {
      case "mud": return { grip: 0.78, drag: 1.85, accel: 0.72 };
      case "gravel": return { grip: 0.86, drag: 1.18, accel: 0.9 };
      case "ice": return { grip: 0.22, drag: 0.16, accel: 0.58 };
      case "asphalt": return { grip: 1.08, drag: 0.72, accel: 1.04 };
      default: return { grip: 0.92, drag: 0.95, accel: 0.96 };
    }
  }

  function rectCircleOverlap(rect, cx, cy, radius) {
    const nx = clamp(cx, rect.x, rect.x + rect.w);
    const ny = clamp(cy, rect.y, rect.y + rect.h);
    return length(cx - nx, cy - ny) < radius;
  }

  function collideWalls() {
    for (const wall of walls) {
      if (!rectCircleOverlap(wall, tank.x, tank.y, tank.radius)) continue;

      const left = Math.abs(tank.x - wall.x);
      const right = Math.abs(tank.x - (wall.x + wall.w));
      const top = Math.abs(tank.y - wall.y);
      const bottom = Math.abs(tank.y - (wall.y + wall.h));
      const min = Math.min(left, right, top, bottom);

      if (min === left) {
        tank.x = wall.x - tank.radius;
        tank.vx = Math.min(tank.vx, 0) * -0.24;
      } else if (min === right) {
        tank.x = wall.x + wall.w + tank.radius;
        tank.vx = Math.max(tank.vx, 0) * -0.24;
      } else if (min === top) {
        tank.y = wall.y - tank.radius;
        tank.vy = Math.min(tank.vy, 0) * -0.24;
      } else {
        tank.y = wall.y + wall.h + tank.radius;
        tank.vy = Math.max(tank.vy, 0) * -0.24;
      }
    }
  }

  function updateTank(dt) {
    const forwardX = Math.cos(tank.angle);
    const forwardY = Math.sin(tank.angle);
    const rightX = Math.cos(tank.angle + Math.PI / 2);
    const rightY = Math.sin(tank.angle + Math.PI / 2);

    const speedForward = tank.vx * forwardX + tank.vy * forwardY;
    const speedSide = tank.vx * rightX + tank.vy * rightY;
    const speed = length(tank.vx, tank.vy);

    const terrainType = currentTerrainAt(tank.x, tank.y);
    const stats = terrainStats(terrainType);
    const handbrake = keys.has(" ");
    const boosting = (keys.has("Shift") || keys.has("ShiftLeft") || keys.has("ShiftRight")) && tank.boost > 0.05;

    let throttle = 0;
    if (keys.has("w") || keys.has("W") || keys.has("ArrowUp")) throttle += 1;
    if (keys.has("s") || keys.has("S") || keys.has("ArrowDown")) throttle -= 0.78;

    let steer = 0;
    if (keys.has("a") || keys.has("A") || keys.has("ArrowLeft")) steer -= 1;
    if (keys.has("d") || keys.has("D") || keys.has("ArrowRight")) steer += 1;

    const accelPower = 410 * stats.accel * (boosting ? 1.68 : 1);
    tank.vx += forwardX * throttle * accelPower * dt;
    tank.vy += forwardY * throttle * accelPower * dt;

    if (boosting) {
      tank.boost = clamp(tank.boost - 0.34 * dt, 0, 1);
      emitDust(tank.x - forwardX * 20, tank.y - forwardY * 20, 2, "#80fff0");
    } else {
      tank.boost = clamp(tank.boost + 0.14 * dt, 0, 1);
    }

    const turnAuthority = clamp(Math.abs(speedForward) / 175, 0.22, 1.05);
    const reverseFactor = speedForward < -4 ? -0.72 : 1;
    const gripForTurn = handbrake ? stats.grip * 0.45 : stats.grip;
    const desiredAngular = steer * 3.35 * turnAuthority * reverseFactor * gripForTurn;
    tank.angularVelocity += (desiredAngular - tank.angularVelocity) * clamp(8.5 * dt, 0, 1);
    tank.angle += tank.angularVelocity * dt;

    const lateralGrip = (handbrake ? 3.2 : 10.5) * stats.grip;
    tank.vx -= rightX * speedSide * lateralGrip * dt;
    tank.vy -= rightY * speedSide * lateralGrip * dt;

    const linearDrag = stats.drag + (handbrake ? 1.1 : 0);
    tank.vx -= tank.vx * linearDrag * 0.42 * dt;
    tank.vy -= tank.vy * linearDrag * 0.42 * dt;

    const maxSpeed = boosting ? 365 : 260;
    const currentSpeed = length(tank.vx, tank.vy);
    if (currentSpeed > maxSpeed) {
      tank.vx = tank.vx / currentSpeed * maxSpeed;
      tank.vy = tank.vy / currentSpeed * maxSpeed;
    }

    tank.x += tank.vx * dt;
    tank.y += tank.vy * dt;

    collideWalls();

    const targetTurret = Math.atan2(mouse.y - tank.y, mouse.x - tank.x);
    tank.turretAngle += normalizeAngle(targetTurret - tank.turretAngle) * clamp(13 * dt, 0, 1);

    tank.heat = Math.max(0, tank.heat - dt * 1.8);

    if ((Math.abs(speedSide) > 32 || handbrake) && speed > 60) {
      skidMarks.push({
        x: tank.x - forwardX * 12,
        y: tank.y - forwardY * 12,
        angle: tank.angle,
        life: 1,
      });
      if (skidMarks.length > 160) skidMarks.shift();
    }

    if (speed > 80 && terrainType !== "asphalt") {
      emitDust(tank.x - forwardX * 22, tank.y - forwardY * 22, 1, terrainType === "ice" ? "#d7ffff" : "#c7b58c");
    }
  }

  function shoot() {
    if (tank.heat > 0.03) return;
    tank.heat = 0.28;
    const muzzleX = tank.x + Math.cos(tank.turretAngle) * 34;
    const muzzleY = tank.y + Math.sin(tank.turretAngle) * 34;
    bullets.push({
      x: muzzleX,
      y: muzzleY,
      vx: Math.cos(tank.turretAngle) * 520 + tank.vx * 0.35,
      vy: Math.sin(tank.turretAngle) * 520 + tank.vy * 0.35,
      life: 1.2,
    });
    emitDust(muzzleX, muzzleY, 6, "#f4df9b");
  }

  function updateBullets(dt) {
    for (const b of bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      for (const wall of walls) {
        if (b.x >= wall.x && b.x <= wall.x + wall.w && b.y >= wall.y && b.y <= wall.y + wall.h) {
          b.life = -1;
          emitDust(b.x, b.y, 10, "#7e8b8b");
        }
      }
    }
    while (bullets.length && bullets[0].life <= 0) bullets.shift();
  }

  function emitDust(x, y, count, color) {
    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const s = 20 + Math.random() * 70;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        r: 2 + Math.random() * 4,
        color,
        life: 0.28 + Math.random() * 0.25,
      });
    }
  }

  function updateParticles(dt) {
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - 2.4 * dt;
      p.vy *= 1 - 2.4 * dt;
      p.life -= dt;
    }
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      if (particles[i].life <= 0) particles.splice(i, 1);
    }

    for (const s of skidMarks) s.life -= dt * 0.055;
    while (skidMarks.length && skidMarks[0].life <= 0) skidMarks.shift();
  }

  function updateCheckpoints() {
    const cp = checkpoints[checkpointIndex];
    if (!cp) return;
    if (length(tank.x - cp.x, tank.y - cp.y) < cp.r + tank.radius * 0.5) {
      cp.passed = true;
      checkpointIndex += 1;
      emitDust(cp.x, cp.y, 20, "#9bfff4");

      if (checkpointIndex >= checkpoints.length) {
        const lap = (performance.now() - lapStart) / 1000;
        bestLap = bestLap == null ? lap : Math.min(bestLap, lap);
        for (const c of checkpoints) c.passed = false;
        checkpointIndex = 0;
        lapStart = performance.now();
      }
    }
  }

  function resetTank() {
    tank.x = 130;
    tank.y = 520;
    tank.angle = -Math.PI / 2;
    tank.turretAngle = -Math.PI / 2;
    tank.vx = 0;
    tank.vy = 0;
    tank.angularVelocity = 0;
  }

  function update(dt) {
    if (keys.has("r") || keys.has("R")) resetTank();
    updateTank(dt);
    updateBullets(dt);
    updateParticles(dt);
    updateCheckpoints();
  }

  function drawTerrain() {
    ctx.fillStyle = "#263437";
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = "#314346";
    for (let x = 0; x < W; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y < H; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.restore();

    for (const t of terrain) {
      if (t.type === "mud") ctx.fillStyle = "#4d4733";
      else if (t.type === "gravel") ctx.fillStyle = "#596061";
      else if (t.type === "ice") ctx.fillStyle = "#47656b";
      else ctx.fillStyle = "#303b3e";
      ctx.fillRect(t.x, t.y, t.w, t.h);

      ctx.globalAlpha = 0.18;
      ctx.fillStyle = "#ffffff";
      for (let i = 0; i < 24; i += 1) {
        const px = t.x + Math.random() * t.w;
        const py = t.y + Math.random() * t.h;
        ctx.fillRect(px, py, 2, 2);
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawWalls() {
    for (const w of walls) {
      ctx.fillStyle = "#1a2224";
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.strokeStyle = "#526164";
      ctx.lineWidth = 2;
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
      ctx.beginPath();
      ctx.arc(0, 0, cp.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = active ? "#9bfff4" : "#d6f7ed";
      ctx.font = "700 18px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(i + 1), 0, 0);
      ctx.restore();
    });
  }

  function drawTank() {
    const speed = length(tank.vx, tank.vy);
    const trackPhase = (performance.now() * 0.012 + speed * 0.04) % 14;
    const bob = Math.sin(performance.now() * 0.018) * clamp(speed / 260, 0, 1.8);
    const recoil = tank.heat > 0 ? tank.heat * 10 : 0;
    const boostGlow = clamp((tank.boost < 0.97 ? 0.15 : 0) + speed / 520, 0, 0.45);

    ctx.save();
    ctx.translate(tank.x, tank.y + bob);
    ctx.rotate(tank.angle);

    ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = "rgba(0, 0, 0, 0.42)";
    ctx.beginPath();
    ctx.ellipse(0, 4, 34, 45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    drawTrack(-24, trackPhase);
    drawTrack(24, trackPhase);

    const hull = ctx.createLinearGradient(-18, -38, 22, 38);
    hull.addColorStop(0, "#49aaa4");
    hull.addColorStop(0.45, "#2f827e");
    hull.addColorStop(1, "#1d5c5a");
    ctx.fillStyle = hull;
    ctx.strokeStyle = "#123c3d";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(-22, -34, 44, 68, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "rgba(116, 224, 213, 0.22)";
    ctx.beginPath();
    ctx.roundRect(-14, -27, 28, 16, 5);
    ctx.fill();
    ctx.fillStyle = "rgba(10, 51, 51, 0.35)";
    ctx.beginPath();
    ctx.roundRect(-13, 6, 26, 24, 5);
    ctx.fill();

    ctx.fillStyle = "#8affef";
    ctx.globalAlpha = 0.75 + Math.sin(performance.now() * 0.014) * 0.2;
    ctx.fillRect(-14, -37, 8, 4);
    ctx.fillRect(6, -37, 8, 4);
    ctx.globalAlpha = 1;

    if (boostGlow > 0) {
      ctx.globalAlpha = boostGlow;
      ctx.fillStyle = "#80fff0";
      ctx.beginPath();
      ctx.ellipse(0, 42, 18, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    ctx.save();
    ctx.translate(tank.x, tank.y + bob);
    ctx.rotate(tank.turretAngle);

    const barrel = ctx.createLinearGradient(0, -5, 46, 5);
    barrel.addColorStop(0, "#2b7471");
    barrel.addColorStop(1, "#6ed4ca");
    ctx.fillStyle = barrel;
    ctx.strokeStyle = "#113b3b";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(4 - recoil, -5, 46, 10, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#1a4f4f";
    ctx.beginPath();
    ctx.roundRect(42 - recoil, -7, 10, 14, 3);
    ctx.fill();

    const turret = ctx.createRadialGradient(-3, -4, 4, 0, 0, 21);
    turret.addColorStop(0, "#65c7bf");
    turret.addColorStop(0.55, "#2f817d");
    turret.addColorStop(1, "#194d4d");
    ctx.fillStyle = turret;
    ctx.strokeStyle = "#113b3b";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(-16, -16, 32, 32, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "rgba(152, 255, 241, 0.25)";
    ctx.beginPath();
    ctx.roundRect(-8, -10, 16, 7, 3);
    ctx.fill();

    ctx.restore();

    function drawTrack(x, phase) {
      ctx.save();
      ctx.translate(x, 0);
      ctx.fillStyle = "#151c1e";
      ctx.strokeStyle = "#485659";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(-9, -39, 18, 78, 7);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.rect(-8, -36, 16, 72);
      ctx.clip();
      for (let y = -46 + phase; y < 48; y += 14) {
        ctx.fillStyle = "#303a3d";
        ctx.fillRect(-8, y, 16, 6);
        ctx.fillStyle = "#0f1415";
        ctx.fillRect(-8, y + 6, 16, 3);
      }
      ctx.restore();
    }
  }

  function drawEffects() {
    for (const s of skidMarks) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.angle);
      ctx.globalAlpha = clamp(s.life, 0, 0.46);
      ctx.fillStyle = "#101516";
      ctx.fillRect(-22, -17, 44, 4);
      ctx.fillRect(-22, 13, 44, 4);
      ctx.restore();
    }

    for (const p of particles) {
      ctx.globalAlpha = clamp(p.life * 2.5, 0, 0.85);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = "#f3e5b0";
    for (const b of bullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawHud() {
    const speed = Math.round(length(tank.vx, tank.vy));
    const terrainName = currentTerrainAt(tank.x, tank.y);
    const currentLap = ((performance.now() - lapStart) / 1000).toFixed(2);

    ctx.fillStyle = "rgba(9, 13, 14, 0.72)";
    ctx.fillRect(18, 18, 314, 106);
    ctx.strokeStyle = "rgba(155, 255, 244, 0.35)";
    ctx.strokeRect(18.5, 18.5, 313, 105);

    ctx.fillStyle = "#e8f1ef";
    ctx.font = "700 18px system-ui";
    ctx.fillText("Tank Mobility", 34, 46);

    ctx.font = "14px system-ui";
    ctx.fillStyle = "#bdd0cc";
    ctx.fillText(`Velocidad: ${speed}`, 34, 70);
    ctx.fillText(`Terreno: ${terrainName}`, 34, 92);
    ctx.fillText(`Vuelta: ${currentLap}s`, 172, 70);
    ctx.fillText(`Mejor: ${bestLap == null ? "—" : bestLap.toFixed(2) + "s"}`, 172, 92);

    ctx.fillStyle = "#203032";
    ctx.fillRect(34, 106, 190, 9);
    ctx.fillStyle = "#80fff0";
    ctx.fillRect(34, 106, 190 * tank.boost, 9);
    ctx.fillStyle = "#bdd0cc";
    ctx.font = "11px system-ui";
    ctx.fillText("boost", 232, 115);
  }

  function render() {
    drawTerrain();
    drawCheckpoints();
    drawEffects();
    drawWalls();
    drawTank();
    drawHud();
  }

  function loop(now) {
    const dt = clamp((now - lastTime) / 1000, 0, 1 / 30);
    lastTime = now;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  window.addEventListener("keydown", (event) => {
    keys.add(event.key);
    if ([" ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
      event.preventDefault();
    }
  });

  window.addEventListener("keyup", (event) => {
    keys.delete(event.key);
  });

  canvas.addEventListener("mousemove", (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (event.clientX - rect.left) * (canvas.width / rect.width);
    mouse.y = (event.clientY - rect.top) * (canvas.height / rect.height);
  });

  canvas.addEventListener("mousedown", () => {
    mouse.down = true;
    shoot();
  });

  canvas.addEventListener("mouseup", () => {
    mouse.down = false;
  });

  requestAnimationFrame(loop);
})();
