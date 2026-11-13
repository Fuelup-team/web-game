// The climb meter stays. Behind it, the pixel rocket and station play the
// full launch: a slow start, then a fast climb, with thrust. The rocket
// stays on screen, and a worse answer does not pull it back down.
import { h, asset } from "./dom.js";
import { STAGES, PERFECT_SCORE, stageFor, progressFor, TIER_RANK } from "../game/engine.js";

const CLIMB_MS = 2200;
const RATE = { drift: 14, sky: 18, orbit: 26, deepspace: 36, nebula: 46, galaxy: 58 };
const FLAME = ["#fffaf2", "#f4ead8", "#e7dcc8", "#d8d2c8", "#c4622d", "#f7f3ea"];

function heightFor(tier) {
  const rank = TIER_RANK[tier] ?? 0;
  return rank / 5;
}

export function createStage() {
  const points = h("p", { className: "climb-points" });
  const stageName = h("p", { className: "climb-stage" });
  const fill = h("div", { className: "climb-fill" });

  const ticks = STAGES.filter((s) => s.from % 200 === 0).map((s) => {
    const tick = h("li", { className: "climb-tick" },
      h("span", { className: "climb-tick-label" }, s.from === 0 ? "Pad" : s.from === PERFECT_SCORE ? "Moon" : s.from),
    );
    tick.style.setProperty("--at", s.from / PERFECT_SCORE);
    return tick;
  });

  const sky = h("img", { className: "launch-sky", src: asset("art/stars.jpg"), alt: "" });
  const dark = h("div", { className: "launch-dark" });
  const station = h("img", { className: "launch-station", src: asset("art/station.png"), alt: "" });
  const rocket = h("img", { className: "launch-rocket", src: asset("art/rocket-pixel.png"), alt: "" });
  const ship = h("div", { className: "launch-ship" }, rocket);
  const scene = h("div", { className: "launch-scene", attrs: { "aria-hidden": "true" } }, sky, dark, station, ship);

  const el = h("aside", { className: "climb", attrs: { "aria-label": "Your altitude" } },
    scene,
    h("div", { className: "climb-readout" },
      h("p", { className: "climb-label" }, "Altitude"),
      points,
      stageName,
    ),
    h("div", { className: "climb-track" },
      fill,
      h("ol", { className: "climb-ticks" }, ticks),
    ),
  );

  let shown = 0;
  let from = 0;
  let dest = 0;
  let animAt = 0;
  let animMs = CLIMB_MS;
  let flame = null;
  let lastFlame = 0;
  let frame = 0;
  let ceiling = 0;

  function paint(cam) {
    ship.style.bottom = `${Math.min(40, 8 + cam * 64)}%`;
    sky.style.objectPosition = `center ${84 - cam * 58}%`;
    station.style.transform = `translateX(-50%) translateY(${cam * 110}%)`;
    dark.style.opacity = String(Math.min(0.86, cam * 0.9));
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

  function setScore(score) {
    el.style.setProperty("--p", progressFor(score));
    points.replaceChildren(
      h("strong", {}, score.toLocaleString("en-US")),
      h("span", {}, ` / ${PERFECT_SCORE.toLocaleString("en-US")}`),
    );
    stageName.textContent = stageFor(score).name;
    el.setAttribute("aria-label", `Altitude ${score} of ${PERFECT_SCORE} points. ${stageFor(score).name}.`);
  }

  /**
   * Full launch. A common answer hops. A rarer one climbs further and throws
   * a bigger flame. The rocket never leaves the screen, and it does not sink
   * when the next answer is worse.
   */
  function boost(tier = "sky") {
    const key = tier === true ? "galaxy" : tier === false || !tier ? "sky" : tier;
    const next = Math.max(ceiling, heightFor(key));
    ceiling = next;
    launch(next, CLIMB_MS, key);
    rocket.classList.remove("is-burning");
    void rocket.offsetWidth;
    rocket.classList.add("is-burning");
  }

  setScore(0);
  paint(0);
  return { el, setScore, boost, destroy() { cancelAnimationFrame(frame); } };
}
