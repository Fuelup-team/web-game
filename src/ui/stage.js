// The original star picture stays as it is. A better answer lifts the rocket
// and darkens the sky. A worse answer than the last one brings both back down.
import { h } from "./dom.js";
import { altitudeFor, zoneFor, formatKm, TIER_RANK } from "../game/engine.js";

function art(file) {
  const base = typeof window !== "undefined" && window.__FUEL_BASE ? window.__FUEL_BASE : "";
  return base + "public/art/" + file;
}

const CLIMB_MS = 2200;
const RATE = { drift: 14, sky: 18, orbit: 26, deepspace: 36, nebula: 46, galaxy: 58 };
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
  let ceiling = 0;

  function paint(cam) {
    const rocketBottom = Math.min(40, 8 + cam * 64);
    ship.style.bottom = `${rocketBottom}%`;
    sky.style.objectPosition = `center ${84 - cam * 58}%`;
    sky.style.transform = "none";
    station.style.transform = `translateX(-50%) translateY(${cam * 110}%)`;
    dark.style.opacity = String(Math.min(0.86, cam * 0.9));
    km.textContent = formatKm(altitudeFor(score));
    zone.textContent = zoneFor(altitudeFor(score)).name;
  }

  function emit(burst) {
    const count = burst ? 4 : 1;
    for (let i = 0; i < count; i++) {
      const bit = h("span", { className: "flame-bit" });
      const size = burst
        ? [8, 8, 12, 12, 16][Math.floor(Math.random() * 5)]
        : [4, 4, 4, 8][Math.floor(Math.random() * 4)];
      bit.style.width = `${size}px`;
      bit.style.height = `${size}px`;
      bit.style.background = FLAME[Math.floor(Math.random() * FLAME.length)];
      bit.style.marginLeft = `${Math.round((Math.random() - 0.5) * (burst ? 22 : 10))}px`;
      bit.style.setProperty("--fall", `${(burst ? 36 : 16) + Math.round(Math.random() * (burst ? 70 : 36))}px`);
      ship.append(bit);
      setTimeout(() => bit.remove(), burst ? 820 : 720);
    }
  }

  function tick(now) {
    if (animAt) {
      const p = Math.min(1, (now - animAt) / animMs);
      const e = p * p * p;
      shown = from + (dest - from) * e;
      const burst = flame && p > 0.42;
      if (flame && now - lastFlame > 1000 / ((RATE[flame] || 18) * (burst ? 3.4 : 0.55))) {
        lastFlame = now;
        emit(burst);
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
    const next = Math.max(ceiling, heightFor(key));
    ceiling = next;
    launch(next, next, CLIMB_MS, key);
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
