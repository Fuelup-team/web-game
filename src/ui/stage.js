// Pixel night: a station on the ground, a rocket that launches with each answer,
// and a sky that gets darker the higher you climb.
import { h } from "./dom.js";
import { altitudeFor, zoneFor, formatKm } from "../game/engine.js";

function art(file) {
  const base = typeof window !== "undefined" && window.__FUEL_BASE ? window.__FUEL_BASE : "";
  return base + "public/art/" + file;
}

const KICK = { drift: 4, sky: 8, orbit: 14, deepspace: 24, nebula: 34, galaxy: 48 };
const PLUME = { drift: 5, sky: 8, orbit: 12, deepspace: 18, nebula: 26, galaxy: 36 };
const PLUME_COLOR = {
  drift: "#6e7278",
  sky: "#b7bcc4",
  orbit: "#3dba6a",
  deepspace: "#e23b3b",
  nebula: "#b06cff",
  galaxy: "#ffe56a",
};

function liftFor(score) {
  return 1 - Math.exp(-Math.max(0, score) / 170);
}

export function createStage() {
  const sky = h("img", { className: "stage-photo stage-sky", src: art("stars.jpg"), alt: "" });
  const dark = h("div", { className: "stage-dark" });
  const station = h("img", { className: "stage-station", src: art("station.png"), alt: "" });
  const rocket = h("img", { className: "stage-rocket", src: art("rocket-pixel.png"), alt: "" });
  const km = h("p", { className: "stage-km" });
  const zone = h("p", { className: "stage-zone" });

  const el = h(
    "div",
    { className: "stage" },
    sky,
    dark,
    station,
    rocket,
    h("div", { className: "stage-readout" }, h("p", { className: "stage-kicker" }, "Altitude"), km, zone),
    h("ol", { className: "stage-scale" }, h("li", {}, "Moon"), h("li", {}, "Cislunar"), h("li", {}, "Orbit"), h("li", {}, "Pad")),
  );

  let score = 0;
  let kick = 0;
  let kickAt = 0;
  let kickMs = 700;
  let frame = 0;

  function resting() {
    return 14 + liftFor(score) * 68;
  }

  function place(extra = 0) {
    const lift = liftFor(score);
    const bottom = Math.min(86, resting() + extra);
    rocket.style.bottom = `${bottom}%`;
    station.style.transform = `translateX(-50%) translateY(${lift * 130}%)`;
    sky.style.objectPosition = `center ${82 - lift * 55}%`;
    dark.style.opacity = String(Math.min(0.82, lift * 0.9));
    km.textContent = formatKm(altitudeFor(score));
    zone.textContent = zoneFor(altitudeFor(score)).name;
  }

  function tick(now) {
    const t = kickAt ? Math.max(0, 1 - (now - kickAt) / kickMs) : 0;
    place(kick * t * t);
    frame = t > 0 ? requestAnimationFrame(tick) : 0;
  }

  function setScore(next) {
    score = next;
    if (!frame) place(0);
  }

  /**
   * Shoot the rocket up. A common answer hops. A Galaxy answer leaves the station.
   * `tier` may be a level id, or a boolean from older callers.
   */
  function boost(tier = "sky") {
    const key = tier === true ? "galaxy" : tier === false || !tier ? "sky" : tier;
    kick = KICK[key] || 8;
    kickMs = key === "galaxy" ? 1200 : key === "nebula" ? 1000 : 750;
    kickAt = performance.now();
    rocket.classList.remove("is-boost", "is-boost-big");
    void rocket.offsetWidth;
    rocket.classList.add(key === "galaxy" || key === "nebula" || key === "deepspace" ? "is-boost-big" : "is-boost");
    const n = PLUME[key] || 8;
    const color = PLUME_COLOR[key] || "#ffe56a";
    const bottom = resting();
    for (let i = 0; i < n; i++) {
      const bit = h("span", { className: "plume" });
      bit.style.background = i % 4 === 0 ? "#fff6d0" : color;
      bit.style.left = `calc(50% + ${Math.round(Math.random() * 22 - 8)}px)`;
      bit.style.bottom = `calc(${bottom}% - ${6 + Math.round(Math.random() * 10)}px)`;
      bit.style.setProperty("--fall", `${50 + Math.round(Math.random() * 90)}px`);
      bit.style.animationDelay = `${(Math.random() * 0.14).toFixed(2)}s`;
      el.append(bit);
      setTimeout(() => bit.remove(), 1000);
    }
    if (!frame) frame = requestAnimationFrame(tick);
  }

  place(0);
  return { el, setScore, boost, destroy() { cancelAnimationFrame(frame); } };
}
