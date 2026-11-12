// Pixel night sky and a transparent rocket that climbs with the score.
import { h } from "./dom.js";
import { altitudeFor, zoneFor, formatKm } from "../game/engine.js";

function art(file) {
  const base = typeof window !== "undefined" && window.__FUEL_BASE ? window.__FUEL_BASE : "";
  return base + "public/art/" + file;
}

/** Rocket height on screen, as % from the bottom. */
function rocketBottom(score) {
  return 8 + (1 - Math.exp(-Math.max(0, score) / 230)) * 58;
}

export function createStage() {
  const sky = h("img", { className: "stage-photo stage-sky", src: art("stars.jpg"), alt: "" });
  const rocket = h("img", { className: "stage-rocket", src: art("rocket-pixel.png"), alt: "" });
  const km = h("p", { className: "stage-km" });
  const zone = h("p", { className: "stage-zone" });

  const el = h(
    "div",
    { className: "stage" },
    sky,
    rocket,
    h("div", { className: "stage-readout" }, h("p", { className: "stage-kicker" }, "Altitude"), km, zone),
    h("ol", { className: "stage-scale" }, h("li", {}, "Moon"), h("li", {}, "Cislunar"), h("li", {}, "Orbit"), h("li", {}, "Pad")),
  );

  let score = 0;

  function setScore(next) {
    score = next;
    const alt = altitudeFor(score);
    const lift = 1 - Math.exp(-Math.max(0, score) / 230);
    sky.style.objectPosition = `center ${70 - lift * 36}%`;
    rocket.style.bottom = `${rocketBottom(score)}%`;
    km.textContent = formatKm(alt);
    zone.textContent = zoneFor(alt).name;
  }

  setScore(0);
  return {
    el,
    setScore,
    /** A little kick on the rocket after a logged answer; `big` for a top answer. */
    boost(big = false) {
      rocket.classList.remove("is-boost", "is-boost-big");
      void rocket.offsetWidth;
      rocket.classList.add(big ? "is-boost-big" : "is-boost");
    },
    destroy() {},
  };
}
