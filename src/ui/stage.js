// Full-screen night behind the questions. The rocket stays on screen.
// It starts slow, then climbs. A worse answer does not pull it back down.
import { h, asset } from "./dom.js";
import { TIER_RANK, stageFor } from "../game/engine.js";

const CLIMB_MS = 2200;
const RATE = { drift: 14, sky: 18, orbit: 26, deepspace: 36, nebula: 46, galaxy: 58 };
const FLAME = ["#fffaf2", "#f4ead8", "#e7dcc8", "#d8d2c8", "#c4622d", "#f7f3ea"];

function heightFor(tier) {
  const rank = TIER_RANK[tier] ?? 0;
  return rank / 5;
}

export function createStage() {
  const sky = h("img", { className: "stage-photo stage-sky", src: asset("art/stars.jpg"), alt: "" });
  const dark = h("div", { className: "stage-dark" });
  const station = h("img", { className: "stage-station", src: asset("art/station.png"), alt: "" });
  const rocket = h("img", { className: "stage-rocket", src: asset("art/rocket-pixel.png"), alt: "" });
  const ship = h("div", { className: "stage-ship" }, rocket);
  const km = h("p", { className: "stage-km" });
  const zone = h("p", { className: "stage-zone" });

  const el = h(
    "div",
    { className: "stage", attrs: { "aria-hidden": "true" } },
    sky,
    dark,
    station,
    ship,
    h("div", { className: "stage-readout" }, h("p", { className: "stage-kicker" }, "Altitude"), km, zone),
  );

  let score = 0;
  let shown = 0;
  let from = 0;
  let dest = 0;
  let animAt = 0;
  let animMs = 800;
  let flame = null;
  let lastFlame = 0;
  let frame = 0;
  let ceiling = 0;

  function paint(cam) {
    ship.style.bottom = `${Math.min(40, 8 + cam * 64)}%`;
    sky.style.objectPosition = `center ${84 - cam * 58}%`;
    station.style.transform = `translateX(-50%) translateY(${cam * 110}%)`;
    dark.style.opacity = String(Math.min(0.86, cam * 0.9));
    km.textContent = `${Math.round(score).toLocaleString("en-US")} pts`;
    zone.textContent = stageFor(score).name;
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

  function launch(nextDest, ms, flameKey) {
    from = shown;
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

  function boost(tier = "sky") {
    const key = tier === true ? "galaxy" : tier === false || !tier ? "sky" : tier;
    const next = Math.max(ceiling, heightFor(key));
    ceiling = next;
    launch(next, CLIMB_MS, key);
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
