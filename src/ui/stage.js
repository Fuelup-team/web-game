// The rocket stays on screen. A better answer scrolls the sky further and longer,
// so the climb feels high without the ship leaving the frame.
import { h } from "./dom.js";
import { altitudeFor, zoneFor, formatKm } from "../game/engine.js";

function art(file) {
  const base = typeof window !== "undefined" && window.__FUEL_BASE ? window.__FUEL_BASE : "";
  return base + "public/art/" + file;
}

// Extra sky travel on top of the score, in "screens" of scroll.
const SURGE = { drift: 0.06, sky: 0.12, orbit: 0.32, deepspace: 0.62, nebula: 0.95, galaxy: 1.25 };
// The whole climb, including the long coast after the fast start.
const TIME = { drift: 2600, sky: 3400, orbit: 4600, deepspace: 6000, nebula: 7400, galaxy: 8800 };
const RATE = { drift: 16, sky: 22, orbit: 34, deepspace: 48, nebula: 62, galaxy: 80 };
const FLAME = ["#fffaf2", "#f4ead8", "#e7dcc8", "#d8d2c8", "#c4622d", "#f7f3ea"];

function camFor(score) {
  return (1 - Math.exp(-Math.max(0, score) / 160)) * 1.15;
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
    const rocketBottom = Math.min(32, 16 + Math.min(cam, 1.2) * 10);
    ship.style.bottom = `${rocketBottom}%`;
    sky.style.transform = `translateY(${cam * 26}%)`;
    station.style.transform = `translateX(-50%) translateY(${cam * 55}%)`;
    dark.style.opacity = String(Math.min(0.78, cam * 0.34));
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
    bit.style.setProperty("--fall", `${18 + Math.round(Math.random() * (flame === "galaxy" ? 64 : 36))}px`);
    ship.append(bit);
    setTimeout(() => bit.remove(), 720);
  }

  function tick(now) {
    if (animAt) {
      const p = Math.min(1, (now - animAt) / animMs);
      let cam;
      if (p < 0.16) {
        const e = 1 - Math.pow(1 - p / 0.16, 3);
        cam = from + (peak - from) * e;
      } else {
        const e = (p - 0.16) / 0.84;
        cam = peak + (dest - peak) * (e * e);
      }
      shown = cam;
      if (flame && now - lastFlame > 1000 / (RATE[flame] || 22)) {
        lastFlame = now;
        const n = flame === "galaxy" || flame === "nebula" ? 2 : 1;
        for (let i = 0; i < n; i++) emit();
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
    const nextDest = camFor(score);
    launch(nextDest, nextDest, 700, null);
  }

  /** Common barely lifts the sky. Galaxy keeps the stars moving for a long time. */
  function boost(tier = "sky") {
    const key = tier === true ? "galaxy" : tier === false || !tier ? "sky" : tier;
    const surge = SURGE[key] ?? 0.12;
    const base = camFor(score);
    const nextPeak = base + surge;
    const stay = base + surge * 0.84;
    launch(nextPeak, stay, TIME[key] || 3400, key);
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
