// The flight backdrop: photos that fade from pad to Earth to Moon, twinkling
// stars, the rocket rising with your score, and an exhaust puff on each hit.
import { h } from "./dom.js";
import { altitudeFor, zoneFor, formatKm } from "../game/engine.js";

/** Rocket height on screen, as % from the bottom. */
function rocketBottom(score) {
  return 11 + (1 - Math.exp(-Math.max(0, score) / 230)) * 56;
}

export function createStage() {
  const pad = h("img", { className: "stage-photo", src: "public/art/pad.jpg", alt: "" });
  const earth = h("img", { className: "stage-photo", src: "public/art/earth.jpg", alt: "" });
  const moon = h("img", { className: "stage-photo", src: "public/art/moon.jpg", alt: "" });
  const canvas = h("canvas", { className: "stage-stars" });
  const rocket = h("img", { className: "stage-rocket", src: "public/art/rocket.png", alt: "" });
  const km = h("p", { className: "stage-km" });
  const zone = h("p", { className: "stage-zone" });

  const el = h(
    "div",
    { className: "stage" },
    pad,
    earth,
    moon,
    canvas,
    h("div", { className: "stage-scrim" }),
    rocket,
    h("div", { className: "stage-readout" }, h("p", { className: "stage-kicker" }, "Altitude"), km, zone),
    h("ol", { className: "stage-scale" }, h("li", {}, "Moon"), h("li", {}, "Cislunar"), h("li", {}, "Orbit"), h("li", {}, "Pad")),
  );

  let score = 0;
  let boostAt = 0;

  function setScore(next) {
    score = next;
    const alt = altitudeFor(score);
    pad.style.opacity = Math.max(0, 1 - score / 240);
    earth.style.opacity = Math.min(1, 0.2 + score / 160);
    moon.style.opacity = Math.max(0, Math.min(1, (score - 340) / 400));
    rocket.style.bottom = `${rocketBottom(score)}%`;
    km.textContent = formatKm(alt);
    zone.textContent = zoneFor(alt).name;
  }

  // Star field + exhaust, drawn every frame while the stage is on screen.
  const ctx = canvas.getContext("2d");
  const stars = Array.from({ length: 64 }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: Math.random() * 1.25 + 0.25,
    phase: Math.random() * Math.PI * 2,
  }));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let frame = 0;

  function draw(now) {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const hgt = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== hgt) {
      canvas.width = w;
      canvas.height = hgt;
    }
    ctx.clearRect(0, 0, w, hgt);
    for (const s of stars) {
      const alpha = reduceMotion ? 0.7 : 0.3 + Math.abs(Math.sin(now / 800 + s.phase)) * 0.55;
      ctx.fillStyle = `rgba(244, 234, 216, ${alpha})`;
      ctx.beginPath();
      ctx.arc(s.x * w, s.y * hgt * 0.8, s.r * dpr, 0, Math.PI * 2);
      ctx.fill();
    }
    const strength = boostAt > 0 ? Math.max(0, 1 - (now - boostAt) / 800) : 0;
    if (strength > 0 && !reduceMotion) {
      const y = hgt * (1 - rocketBottom(score) / 100);
      for (let i = 0; i < 12; i++) {
        const t = ((now / 50 + i * 19) % 100) / 100;
        ctx.fillStyle = `rgba(242, 193, 78, ${strength * (1 - t) * 0.75})`;
        ctx.beginPath();
        ctx.arc(w * 0.38 - t * w * 0.16, y + Math.sin(i + now / 200) * 6 * dpr, (2.4 - t * 1.4) * dpr, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    frame = requestAnimationFrame(draw);
  }
  frame = requestAnimationFrame(draw);

  setScore(0);
  return {
    el,
    setScore,
    /** Puff of exhaust, e.g. after a logged answer. */
    boost() {
      boostAt = performance.now();
    },
    destroy() {
      cancelAnimationFrame(frame);
    },
  };
}
