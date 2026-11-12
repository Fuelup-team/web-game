// The climb: your points are your altitude. A meter from 0 (the pad) to
// 1,000 (the Moon), with the pixel rocket sitting at your current points.
// Tall meter beside the questions on wide screens; a slim bar on phones.
import { h, asset } from "./dom.js";
import { STAGES, PERFECT_SCORE, stageFor, progressFor } from "../game/engine.js";

export function createStage() {
  const points = h("p", { className: "climb-points" });
  const stageName = h("p", { className: "climb-stage" });
  const rocket = h("img", { className: "climb-rocket", src: asset("art/rocket-pixel.png"), alt: "" });
  const fill = h("div", { className: "climb-fill" });

  // Tick marks every 200 points, labelled with the stage that starts there.
  const ticks = STAGES.filter((s) => s.from % 200 === 0).map((s) => {
    const tick = h("li", { className: "climb-tick" },
      h("span", { className: "climb-tick-label" }, s.from === 0 ? "Pad" : s.from === PERFECT_SCORE ? "Moon" : s.from),
    );
    tick.style.setProperty("--at", s.from / PERFECT_SCORE);
    return tick;
  });

  const el = h("aside", { className: "climb", attrs: { "aria-label": "Your altitude" } },
    h("div", { className: "climb-readout" },
      h("p", { className: "climb-label" }, "Altitude"),
      points,
      stageName,
    ),
    h("div", { className: "climb-track" },
      fill,
      h("ol", { className: "climb-ticks" }, ticks),
      h("div", { className: "climb-rocket-lane" }, rocket),
    ),
  );

  function setScore(score) {
    el.style.setProperty("--p", progressFor(score));
    points.replaceChildren(
      h("strong", {}, score.toLocaleString("en-US")),
      h("span", {}, ` / ${PERFECT_SCORE.toLocaleString("en-US")}`),
    );
    stageName.textContent = stageFor(score).name;
    el.setAttribute("aria-label", `Altitude ${score} of ${PERFECT_SCORE} points. ${stageFor(score).name}.`);
  }

  setScore(0);
  return {
    el,
    setScore,
    /** A kick on the rocket after a logged answer; `big` for a top answer. */
    boost(big = false) {
      rocket.classList.remove("is-boost", "is-boost-big");
      void rocket.offsetWidth;
      rocket.classList.add(big ? "is-boost-big" : "is-boost");
    },
    destroy() {},
  };
}
