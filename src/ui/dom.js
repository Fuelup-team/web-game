// Tiny DOM helpers. Text always goes in as text nodes, never as HTML.

/**
 * Create an element.
 *   h("button", { className: "btn", onClick: fn, attrs: { type: "button" } }, "Go")
 * Children can be strings, numbers, elements, arrays, or null/false (skipped).
 */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value == null || value === false) continue;
    if (key === "className") el.className = value;
    else if (key === "style") Object.assign(el.style, value);
    else if (key === "attrs") for (const [a, v] of Object.entries(value)) v != null && v !== false && el.setAttribute(a, v === true ? "" : String(v));
    else if (key.startsWith("on")) el.addEventListener(key.slice(2).toLowerCase(), value);
    else el[key] = value;
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

/** Replace all children of an element. */
export function mount(el, ...children) {
  el.replaceChildren();
  append(el, children);
}

/** Path to a file in public/, respecting an optional base (window.__FUEL_BASE). */
export function asset(path) {
  const base = typeof window !== "undefined" && window.__FUEL_BASE ? window.__FUEL_BASE : "";
  return `${base}public/${path}`;
}

/**
 * A pixel icon from public/icons (pixelarticons, MIT). Drawn with a CSS mask,
 * so it takes the text color of wherever it sits.
 */
export function icon(name) {
  const el = document.createElement("span");
  el.className = "icon";
  el.setAttribute("aria-hidden", "true");
  // Full URL: a relative url() inside a CSS variable would be read relative to the stylesheet.
  el.style.setProperty("--icon", `url("${new URL(asset(`icons/${name}.svg`), document.baseURI).href}")`);
  return el;
}
