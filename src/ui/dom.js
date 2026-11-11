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

const ICON_PATHS = {
  "arrow-left": '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  menu: '<path d="M4 12h16"/><path d="M4 18h16"/><path d="M4 6h16"/>',
  "volume-2":
    '<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.364 18.364a9 9 0 0 0 0-12.728"/>',
  "volume-x":
    '<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><line x1="22" x2="16" y1="9" y2="15"/><line x1="16" x2="22" y1="9" y2="15"/>',
};

/** A Lucide-style line icon. Only names from ICON_PATHS are allowed. */
export function icon(name) {
  const wrap = document.createElement("span");
  wrap.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-${name}" aria-hidden="true">${ICON_PATHS[name]}</svg>`;
  return wrap.firstElementChild;
}
