// The original star picture stays as it is. A better answer lifts the rocket
// and darkens the sky. A worse answer than the last one brings both back down.
import { h } from "./dom.js";
import { altitudeFor, zoneFor, formatKm, TIER_RANK } from "../game/engine.js";

function art(file) {
  const base = typeof window !== "undefined" && window.__FUEL_BASE ? window.__FUEL_BASE : "";
  return base + "public/art/" + file;
}

const TIME = { drift: 4200, sky: 4800, orbit: 5600, deepspace: 6800, nebula: 8000, galaxy: 9200 };
const RATE = { drift: 10, sky: 16, orbit: 28, deepspace: 42, nebula: 56, galaxy: 72 };
const FLAME = ["#fffaf2", "#f4ead8", "#e7dcc8", "#d8d2c8", "#c4622d", "#f7f3ea"];

function heightFor(tier) {
  const rank = TIER_RANK[tier] ?? 0;
  return rank / 5;
}

export function createStage() {
  const sky = h("img", { className: "stage-photo stage-sky", src: art("stars.jpg"), alt: "" });
  const dark = h("div", { className: "stage-dark" });
  const station = h("img", { className: "stage-station", src: art("station.png"), alt: "" });
  const rocket = h("img", { className: "stage-rocket", src: art("rocket-pixel.png"), alt: "" });
  const ship = h("div", { className: "stage-ship" }, rocket);
  const km = h("p", { className: "stage-km" });
  const zone = h("p", { className: "stage-zone" });

  const el = h(
    "div",
    { className: "stage" },
    sky,
    dark,
    station,
    ship,
    h("div", { className: "stage-readout" }, h("p", { className: "stage-kicker" }, "Altitude"), km, zone),
    h("ol", { className: "stage-scale" }, h("li", {}, "Moon"), h("li", {}, "Cislunar"), h("li", {}, "Orbit"), h("li", {}, "Pad")),
  );

  let score = 0;
  let shown = 0;
  let from = 0;
  let peak = 0;
  let dest = 0;
  let animAt = 0;
  let animMs = 800;
  let flame = null;
  let lastFlame = 0;
  let frame = 0;

  function paint(cam) {
    const rocketBottom = 16 + cam * 14;
    ship.style.bottom = `${rocketBottom}%`;
    sky.style.objectPosition = `center ${72 - cam * 28}%`;
    sky.style.transform = "none";
    station.style.transform = `translateX(-50%) translateY(${cam * 70}%)`;
    dark.style.opacity = String(cam * 0.72);
    km.textContent = formatKm(altitudeFor(score));
    zone.textContent = zoneFor(altitudeFor(score)).name;
  }

  function emit() {
    const bit = h("span", { className: "flame-bit" });
    const size = [4, 4, 4, 8, 8][Math.floor(Math.random() * 5)];
    bit.style.width = `${size}px`;
    bit.style.height = `${size}px`;
    bit.style.background = FLAME[Math.floor(Math.random() * FLAME.length)];
    bit.style.marginLeft = `${Math.round((Math.random() - 0.5) * 10)}px`;
    bit.style.setProperty("--fall", `${16 + Math.round(Math.random() * 40)}px`);
    ship.append(bit);
    setTimeout(() => bit.remove(), 720);
  }

  function tick(now) {
    if (animAt) {
      const p = Math.min(1, (now - animAt) / animMs);
      const span = peak - from;
      let cam;
      if (p < 0.18) {
        const e = 1 - Math.pow(1 - p / 0.18, 3);
        cam = from + span * e;
      } else {
        const e = (p - 0.18) / 0.82;
        cam = peak + (dest - peak) * (e * e);
      }
      shown = cam;
      if (flame && now - lastFlame > 1000 / (RATE[flame] || 16)) {
        lastFlame = now;
        emit();
      }
      if (p >= 1) {
        animAt = 0;
        flame = null;
      }
    }
    paint(shown);
    frame = animAt ? requestAnimationFrame(tick) : 0;
  }

  function launch(nextPeak, nextDest, ms, flameKey) {
    from = shown;
    peak = nextPeak;
    dest = nextDest;
    animMs = ms;
    animAt = performance.now();
    flame = flameKey;
    lastFlame = 0;
    if (!frame) frame = requestAnimationFrame(tick);
  }

  function setScore(next) {
    score = next;
    paint(shown);
  }

  /**
   * Match the sky to this answer. A rarer one climbs. A worse one than the
   * last answer sinks back toward the original night.
   */
  function boost(tier = "sky") {
    const key = tier === true ? "galaxy" : tier === false || !tier ? "sky" : tier;
    const next = heightFor(key);
    const goingDown = next < shown - 0.04;
    const nextPeak = goingDown ? next : Math.min(1, next + (TIER_RANK[key] >= 4 ? 0.06 : 0.02));
    launch(nextPeak, next, goingDown ? 6400 : TIME[key] || 4800, goingDown ? null : key);
    rocket.classList.remove("is-burning");
    void rocket.offsetWidth;
    rocket.classList.add("is-burning");
  }

  paint(0);
  return {
    el,
    setScore,
    boost,
    destroy() {
      cancelAnimationFrame(frame);
    },
  };
}
