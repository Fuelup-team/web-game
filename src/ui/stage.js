// Pixel night: the rocket shoots up on each answer. Better answers go further,
// faster, and leave a longer pixel flame. The sky darkens as the score climbs.
import { h } from "./dom.js";
import { altitudeFor, zoneFor, formatKm } from "../game/engine.js";

function art(file) {
  const base = typeof window !== "undefined" && window.__FUEL_BASE ? window.__FUEL_BASE : "";
  return base + "public/art/" + file;
}

// How far past the new altitude a hit throws the rocket, in % of the screen.
const SURGE = { drift: 2, sky: 5, orbit: 14, deepspace: 28, nebula: 42, galaxy: 58 };
// Whole launch, including the long flame after the fast climb.
const TIME = { drift: 1100, sky: 1400, orbit: 1800, deepspace: 2300, nebula: 2700, galaxy: 3200 };
// New flame pixels per second while the burn lasts.
const RATE = { drift: 18, sky: 26, orbit: 40, deepspace: 58, nebula: 74, galaxy: 96 };
// Same blocks as the rocket: cream, white, ash, copper.
const FLAME = ["#fffaf2", "#f4ead8", "#e7dcc8", "#d8d2c8", "#c4622d", "#f7f3ea"];

function liftFor(score) {
  return 1 - Math.exp(-Math.max(0, score) / 120);
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
  let shown = 12;
  let from = 12;
  let peak = 12;
  let dest = 12;
  let animAt = 0;
  let animMs = 600;
  let flame = null;
  let lastFlame = 0;
  let frame = 0;

  function resting() {
    return 12 + liftFor(score) * 74;
  }

  function paintScene() {
    const lift = liftFor(score);
    station.style.transform = `translateX(-50%) translateY(${lift * 130}%)`;
    sky.style.objectPosition = `center ${82 - lift * 55}%`;
    dark.style.opacity = String(Math.min(0.82, lift * 0.9));
    km.textContent = formatKm(altitudeFor(score));
    zone.textContent = zoneFor(altitudeFor(score)).name;
  }

  function emit(bottom) {
    const bit = h("span", { className: "flame-bit" });
    const size = [4, 4, 4, 8, 8][Math.floor(Math.random() * 5)];
    bit.style.width = `${size}px`;
    bit.style.height = `${size}px`;
    bit.style.background = FLAME[Math.floor(Math.random() * FLAME.length)];
    bit.style.marginLeft = `${Math.round((Math.random() - 0.5) * 10)}px`;
    bit.style.bottom = "0";
    bit.style.setProperty("--fall", `${16 + Math.round(Math.random() * (flame === "galaxy" ? 72 : 40))}px`);
    ship.append(bit);
    setTimeout(() => bit.remove(), 680);
    void bottom;
  }

  function tick(now) {
    let bottom = shown;
    if (animAt) {
      const p = Math.min(1, (now - animAt) / animMs);
      if (p < 0.22) {
        const e = 1 - Math.pow(1 - p / 0.22, 3);
        bottom = from + (peak - from) * e;
      } else {
        const e = Math.pow((p - 0.22) / 0.78, 2);
        bottom = peak + (dest - peak) * e;
      }
      shown = bottom;
      if (flame && now - lastFlame > 1000 / (RATE[flame] || 26)) {
        lastFlame = now;
        const n = flame === "galaxy" || flame === "nebula" ? 3 : 1;
        for (let i = 0; i < n; i++) emit(bottom);
      }
      if (p >= 1) {
        animAt = 0;
        flame = null;
      }
    }
    ship.style.bottom = `${bottom}%`;
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
    paintScene();
    const nextDest = resting();
    launch(nextDest, nextDest, 420, null);
  }

  /**
   * A common answer hops. A Galaxy answer crosses most of the screen,
   * fast at the start, with the flame still falling after it arrives.
   */
  function boost(tier = "sky") {
    const key = tier === true ? "galaxy" : tier === false || !tier ? "sky" : tier;
    const surge = SURGE[key] ?? 5;
    const nextDest = resting();
    const nextPeak = Math.min(90, nextDest + surge);
    const stay = Math.min(88, nextDest + surge * 0.72);
    launch(nextPeak, stay, TIME[key] || 1400, key);
    rocket.classList.remove("is-burning");
    void rocket.offsetWidth;
    rocket.classList.add("is-burning");
  }

  paintScene();
  ship.style.bottom = `${shown}%`;
  return {
    el,
    setScore,
    boost,
    destroy() {
      cancelAnimationFrame(frame);
    },
  };
}
