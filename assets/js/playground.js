/* A small, dependency-free soft-body playground. Distances act as springs;
   convex polygon contacts keep the shapes in a pile rather than overlapping. */
(function () {
  "use strict";
  var section = document.querySelector(".playground");
  if (!section) return;
  var canvas = section.querySelector("canvas");
  var ctx = canvas.getContext("2d");
  if (!ctx) return;
  section.hidden = false;

  var pauseButton = section.querySelector("[data-playground-pause]");
  var motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var colors = ["#00c984", "#09c9e6", "#ffbc14", "#ff3289", "#8855ff"];
  var bodies = [], width = 0, height = 0, drag = null, pointerId = null;
  var visible = false, paused = motion.matches, frame = 0, last = 0, accumulator = 0;
  var keyboardIndex = -1;
  var hoverBody = null;
  var light = document.documentElement.dataset.theme === "light";

  function center(body) {
    var c = { x: 0, y: 0 };
    body.points.forEach(function (p) { c.x += p.x; c.y += p.y; });
    c.x /= body.points.length; c.y /= body.points.length;
    return c;
  }

  function createBody(x, y, size, index) {
    var count = index % 5 === 0 ? 3 : index % 7 === 0 ? 5 : 4;
    var angle = -Math.PI / 4 + Math.sin(index * 7) * 0.65;
    var points = Array.from({ length: count }, function (_, n) {
      var a = angle + n / count * Math.PI * 2;
      var px = x + Math.cos(a) * size, py = y + Math.sin(a) * size;
      return { x: px, y: py, px: px, py: py };
    });
    var springs = [];
    for (var i = 0; i < count; i++) {
      for (var j = i + 1; j < count; j++) {
        springs.push({ a: i, b: j, length: Math.hypot(points[j].x - points[i].x, points[j].y - points[i].y),
          stiffness: j === i + 1 || (i === 0 && j === count - 1) ? 0.22 : 0.075 });
      }
    }
    return { points: points, springs: springs, color: colors[index % colors.length], pattern: index % 5, size: size,
      squash: 0, squashVelocity: 0, shear: 0, shearVelocity: 0, touchCooldown: 0 };
  }

  // Two underdamped material modes keep jiggling even after contact has
  // stopped the body's travel. The outline, texture, and handles deform together.
  function excite(body, strength, direction) {
    if (paused || motion.matches) return;
    body.squashVelocity = Math.max(-0.065, Math.min(0.065, body.squashVelocity + strength));
    body.shearVelocity = Math.max(-0.05, Math.min(0.05, body.shearVelocity + strength * direction * 0.7));
  }

  function surface(body) {
    var c = center(body), points = body.points;
    var angle = Math.atan2(points[1].y - points[0].y, points[1].x - points[0].x);
    var cos = Math.cos(angle), sin = Math.sin(angle);
    var deformed = points.map(function (p) {
      var dx = p.x - c.x, dy = p.y - c.y;
      var x = dx * cos + dy * sin, y = -dx * sin + dy * cos;
      var sx = x * (1 + body.squash) + y * body.shear;
      var sy = y / (1 + body.squash);
      return { x: c.x + sx * cos - sy * sin, y: c.y + sx * sin + sy * cos };
    });
    var box = bounds({ points: deformed });
    var offsetX = Math.max(6 - box.left, Math.min(0, width - 6 - box.right));
    var offsetY = Math.max(6 - box.top, Math.min(0, height - 6 - box.bottom));
    return deformed.map(function (p) { return { x: p.x + offsetX, y: p.y + offsetY }; });
  }

  function reset() {
    release();
    keyboardIndex = -1;
    hoverBody = null;
    var columns = width < 500 ? 5 : 9;
    var spacing = width / columns;
    var baseSize = Math.min(spacing * 0.62, 57);
    bodies = Array.from({ length: columns * 2 }, function (_, i) {
      var row = Math.floor(i / columns);
      return createBody(spacing * (i % columns + 0.5), height - 14 - baseSize - row * baseSize * 1.65,
        baseSize * (0.82 + (i % 3) * 0.12), i);
    });
    // Start with a settled composition, including when reduced motion is enabled.
    for (var i = 0; i < 160; i++) step();
    bodies.forEach(function (body) {
      body.points.forEach(function (p) { p.px = p.x; p.py = p.y; });
      body.squash = body.shear = body.squashVelocity = body.shearVelocity = 0;
    });
    draw();
    wake();
  }

  function resize() {
    var nextWidth = canvas.getBoundingClientRect().width;
    if (!nextWidth) return;
    var nextHeight = nextWidth < 500 ? 330 : 400;
    var ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(nextWidth * ratio);
    canvas.height = Math.round(nextHeight * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    if (Math.abs(nextWidth - width) > 1 || nextHeight !== height) {
      width = nextWidth; height = nextHeight; reset();
    } else draw();
  }

  function bounds(body) {
    var box = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
    body.points.forEach(function (p) {
      box.left = Math.min(box.left, p.x); box.right = Math.max(box.right, p.x);
      box.top = Math.min(box.top, p.y); box.bottom = Math.max(box.bottom, p.y);
    });
    return box;
  }

  function separate(a, b, detectImpact) {
    var ba = bounds(a), bb = bounds(b);
    if (ba.right < bb.left || bb.right < ba.left || ba.bottom < bb.top || bb.bottom < ba.top) return;
    var overlap = Infinity, nx = 0, ny = 0;
    var polygons = [a.points, b.points];
    for (var k = 0; k < 2; k++) {
      var polygon = polygons[k];
      for (var i = 0; i < polygon.length; i++) {
        var p = polygon[i], q = polygon[(i + 1) % polygon.length];
        var length = Math.hypot(q.x - p.x, q.y - p.y) || 1;
        var ax = -(q.y - p.y) / length, ay = (q.x - p.x) / length;
        var minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity;
        a.points.forEach(function (v) { var d = v.x * ax + v.y * ay; minA = Math.min(minA, d); maxA = Math.max(maxA, d); });
        b.points.forEach(function (v) { var d = v.x * ax + v.y * ay; minB = Math.min(minB, d); maxB = Math.max(maxB, d); });
        var distance = Math.min(maxA, maxB) - Math.max(minA, minB);
        if (distance <= 0) return;
        if (distance < overlap) { overlap = distance; nx = ax; ny = ay; }
      }
    }
    var ca = center(a), cb = center(b);
    if ((cb.x - ca.x) * nx + (cb.y - ca.y) * ny < 0) { nx = -nx; ny = -ny; }
    if (detectImpact) {
      function speed(body) {
        return body.points.reduce(function (total, p) { return total + (p.x - p.px) * nx + (p.y - p.py) * ny; }, 0) / body.points.length;
      }
      var impact = speed(a) - speed(b);
      if (impact > 1.4) {
        excite(a, Math.min(0.028, impact * 0.004), nx + ny);
        excite(b, Math.min(0.028, impact * 0.004), -nx - ny);
      }
    }
    var shift = (overlap + 0.1) * 0.5;
    [a, b].forEach(function (body, index) {
      var sign = index === 0 ? -1 : 1;
      body.points.forEach(function (p) {
        var vx = p.x - p.px, vy = p.y - p.py;
        p.x += nx * shift * sign; p.y += ny * shift * sign;
        // Remove inward speed and damp tangential sliding at a contact.
        var inward = Math.min(0, (vx * nx + vy * ny) * sign);
        p.px = p.x - (vx - nx * inward * sign) * 0.96;
        p.py = p.y - (vy - ny * inward * sign) * 0.96;
      });
    });
  }

  function step() {
    bodies.forEach(function (body) {
      body.touchCooldown = Math.max(0, body.touchCooldown - 1);
      if (motion.matches) {
        body.squash = body.shear = body.squashVelocity = body.shearVelocity = 0;
      } else {
        body.squashVelocity = (body.squashVelocity - body.squash * 0.105) * 0.94;
        body.shearVelocity = (body.shearVelocity - body.shear * 0.075) * 0.93;
        body.squash = Math.max(-0.23, Math.min(0.23, body.squash + body.squashVelocity));
        body.shear = Math.max(-0.2, Math.min(0.2, body.shear + body.shearVelocity));
      }
      body.points.forEach(function (p) {
        var vx = Math.max(-24, Math.min(24, (p.x - p.px) * 0.985));
        var vy = Math.max(-24, Math.min(24, (p.y - p.py) * 0.985));
        p.px = p.x; p.py = p.y; p.x += vx; p.y += vy + 0.36;
      });
    });
    for (var pass = 0; pass < 6; pass++) {
      bodies.forEach(function (body) {
        body.springs.forEach(function (spring) {
          var a = body.points[spring.a], b = body.points[spring.b];
          var dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy) || 1;
          // The held corner yields more than the rest of a falling body. This
          // lets a pull visibly stretch the face before the other points catch up.
          var softness = drag && drag.body === body ? 0.16 : 1;
          var force = (distance - spring.length) / distance * spring.stiffness * softness;
          a.x += dx * force; a.y += dy * force; b.x -= dx * force; b.y -= dy * force;
        });
      });
      for (var i = 0; i < bodies.length; i++) {
        for (var j = i + 1; j < bodies.length; j++) separate(bodies[i], bodies[j], pass === 0);
      }
      if (drag) {
        var p = drag.body.points[drag.point];
        p.x += (drag.x - p.x) * 0.28; p.y += (drag.y - p.y) * 0.28;
      }
      bodies.forEach(function (body) {
        body.points.forEach(function (p) {
          if (p.x < 7) { p.x = 7; p.px = p.x; }
          if (p.x > width - 7) { p.x = width - 7; p.px = p.x; }
          if (p.y < 7) { p.y = 7; p.py = p.y; }
          if (p.y > height - 8) {
            var landing = p.y - p.py;
            if (pass === 0 && landing > 1.8) excite(body, Math.min(0.03, landing * 0.004), 1);
            p.y = height - 8; p.py = p.y; p.px += (p.x - p.px) * 0.15; }
        });
      });
    }
  }

  function path(points) {
    ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach(function (p) { ctx.lineTo(p.x, p.y); });
    ctx.closePath();
  }

  function drawBody(body) {
    var points = surface(body), c = center({ points: points }), color = body.color;
    path(points); ctx.fillStyle = color + (light ? "27" : "30"); ctx.fill();
    ctx.save(); ctx.clip();
    // Pattern coordinates follow the first edge, so textures turn with a shape.
    ctx.translate(c.x, c.y);
    ctx.rotate(Math.atan2(points[1].y - points[0].y, points[1].x - points[0].x));
    ctx.transform(1 + body.squash, 0, body.shear, 1 / (1 + body.squash), 0, 0);
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.globalAlpha = light ? 0.62 : 0.65;
    ctx.lineWidth = 1.5;
    var s = body.size * 2.8;
    if (body.pattern === 0) {
      for (var x = -s; x < s; x += 13) {
        ctx.beginPath(); ctx.moveTo(x, -s); ctx.lineTo(x + s, s); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, -s); ctx.lineTo(x - s, s); ctx.stroke();
      }
    } else if (body.pattern === 1) {
      ctx.lineWidth = 7;
      for (var r = 10; r < s; r += 17) { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke(); }
    } else if (body.pattern === 2) {
      for (var dx = -s; dx < s; dx += 10) {
        for (var dy = -s; dy < s; dy += 10) { ctx.beginPath(); ctx.arc(dx, dy, 1.8, 0, Math.PI * 2); ctx.fill(); }
      }
    } else if (body.pattern === 3) {
      ctx.lineWidth = 11;
      for (var y = -s; y < s; y += 23) {
        ctx.beginPath(); ctx.moveTo(-s, y); ctx.bezierCurveTo(-s * 0.3, y - 55, s * 0.3, y + 55, s, y); ctx.stroke();
      }
    } else {
      for (var line = -s; line < s; line += 13) {
        ctx.beginPath(); ctx.moveTo(line, -s); ctx.lineTo(line, s); ctx.moveTo(-s, line); ctx.lineTo(s, line); ctx.stroke();
      }
    }
    ctx.restore();
    ctx.strokeStyle = color; ctx.lineWidth = 1.5;
    path(points); ctx.stroke();
    // A second, inset face gives the flat soft bodies their wireframe-cube feel.
    var inner = points.map(function (p) { return { x: c.x + (p.x - c.x) * 0.58 + 6, y: c.y + (p.y - c.y) * 0.58 - 8 }; });
    ctx.globalAlpha = 0.8; path(inner); ctx.stroke();
    points.forEach(function (p, i) {
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(inner[i].x, inner[i].y); ctx.stroke();
    });
    ctx.globalAlpha = 1;
    points.forEach(function (p, i) {
      var selected = drag && drag.body === body && drag.point === i;
      ctx.beginPath(); ctx.arc(p.x, p.y, selected ? 7 : 4, 0, Math.PI * 2);
      ctx.fillStyle = light ? "#fbf5eb" : "#101014"; ctx.fill(); ctx.stroke();
      if (selected) { ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); }
    });
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    bodies.forEach(drawBody);
  }

  function tick(now) {
    frame = 0;
    if (!visible || document.hidden || paused) return;
    accumulator += Math.min((now - (last || now)) / 1000, 0.05); last = now;
    while (accumulator >= 1 / 60) { step(); accumulator -= 1 / 60; }
    draw(); frame = requestAnimationFrame(tick);
  }

  function wake() {
    if (!frame && visible && !document.hidden && !paused) {
      last = 0; accumulator = 0; frame = requestAnimationFrame(tick);
    }
  }

  function contains(body, x, y) {
    var inside = false, points = surface(body);
    for (var i = 0, j = points.length - 1; i < points.length; j = i++) {
      var a = points[i], b = points[j];
      if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  }

  function pick(x, y) {
    for (var i = bodies.length - 1; i >= 0; i--) {
      var body = bodies[i], nearest = 0, distance = Infinity;
      surface(body).forEach(function (p, index) {
        var d = Math.hypot(p.x - x, p.y - y);
        if (d < distance) { distance = d; nearest = index; }
      });
      if (distance < 20 || contains(body, x, y)) {
        var p = body.points[nearest];
        drag = { body: body, point: nearest, x: p.x, y: p.y, offsetX: p.x - x, offsetY: p.y - y };
        bodies.splice(i, 1); bodies.push(body);
        excite(body, 0.045, (x - center(body).x) >= 0 ? 1 : -1);
        canvas.classList.add("is-grabbing"); draw(); return true;
      }
    }
    return false;
  }

  function position(event) {
    var box = canvas.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  }

  function release(wobble) {
    if (drag && wobble === true) {
      var held = drag.body.points[drag.point];
      var speed = Math.hypot(held.x - held.px, held.y - held.py);
      excite(drag.body, Math.min(0.06, 0.035 + speed * 0.003), held.x >= center(drag.body).x ? 1 : -1);
    }
    drag = null;
    if (pointerId !== null && canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
    pointerId = null; canvas.classList.remove("is-grabbing"); draw();
  }

  canvas.addEventListener("pointerdown", function (event) {
    if (event.button !== 0 || pointerId !== null) return;
    var p = position(event);
    if (pick(p.x, p.y)) {
      pointerId = event.pointerId; canvas.setPointerCapture(pointerId); canvas.focus({ preventScroll: true });
    }
  });
  canvas.addEventListener("pointermove", function (event) {
    var p = position(event);
    if (drag && event.pointerId === pointerId) {
      drag.x = Math.max(8, Math.min(width - 8, p.x + drag.offsetX));
      drag.y = Math.max(8, Math.min(height - 8, p.y + drag.offsetY));
      if (paused) { step(); draw(); }
    } else if (!drag && event.pointerType !== "touch") {
      var touched = null;
      for (var i = bodies.length - 1; i >= 0; i--) {
        if (contains(bodies[i], p.x, p.y)) { touched = bodies[i]; break; }
      }
      if (touched && touched !== hoverBody && touched.touchCooldown === 0) {
        excite(touched, 0.025, p.x >= center(touched).x ? 1 : -1);
        touched.touchCooldown = 40;
      }
      hoverBody = touched;
    }
  });
  canvas.addEventListener("pointerleave", function () { hoverBody = null; });
  canvas.addEventListener("pointerup", function () { release(true); });
  canvas.addEventListener("pointercancel", release);
  canvas.addEventListener("lostpointercapture", function () { if (drag) release(); });
  canvas.addEventListener("blur", release);
  canvas.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      event.preventDefault(); release(); keyboardIndex = (keyboardIndex + 1) % bodies.length;
      var body = bodies[keyboardIndex], p = body.points[0];
      drag = { body: body, point: 0, x: p.x, y: p.y }; excite(body, 0.045, 1); draw();
    } else if (event.key === "Escape") { release(true); }
    else if (drag && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
      event.preventDefault();
      var amount = event.shiftKey ? 35 : 15;
      drag.x = Math.max(8, Math.min(width - 8, drag.x + (event.key === "ArrowRight" ? amount : event.key === "ArrowLeft" ? -amount : 0)));
      drag.y = Math.max(8, Math.min(height - 8, drag.y + (event.key === "ArrowDown" ? amount : event.key === "ArrowUp" ? -amount : 0)));
      if (paused) { step(); draw(); }
    }
  });

  function updatePause() {
    pauseButton.textContent = paused ? "Resume" : "Pause";
    pauseButton.setAttribute("aria-pressed", String(paused));
    if (paused) { cancelAnimationFrame(frame); frame = 0; } else wake();
  }
  pauseButton.addEventListener("click", function () { paused = !paused; updatePause(); });
  section.querySelector("[data-playground-reset]").addEventListener("click", reset);
  motion.addEventListener("change", function () { paused = motion.matches; updatePause(); });
  document.addEventListener("visibilitychange", function () { if (document.hidden) release(); wake(); });
  new IntersectionObserver(function (entries) {
    visible = entries[0].isIntersecting;
    if (!visible) release();
    wake();
  }, { rootMargin: "80px" }).observe(section);
  new MutationObserver(function () { light = document.documentElement.dataset.theme === "light"; draw(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  new ResizeObserver(resize).observe(canvas);
  updatePause(); resize();
})();
