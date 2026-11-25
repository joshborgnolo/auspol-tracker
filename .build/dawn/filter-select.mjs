function nativeOptions(select) {
  return [...select.children].flatMap(e => {
    if (e.tagName === "OPTGROUP") return [...e.children].map(o => ({ value: o.value, label: o.textContent, group: e.label, disabled: o.disabled }));
    return [{ value: e.value, label: e.textContent, disabled: e.disabled }];
  });
}

/* Dawn's shared selector: the trigger and listbox, not the choice itself.
   An ordinary select can supply the native change contract; the pollster
   menu supplies its own set and callback instead. */
export function filterSelect(cfg) {
  const select = cfg.select, multi = !!cfg.multiple;
  const trigger = cfg.trigger || document.createElement("button");
  const root = cfg.root || (select ? select.closest(".pick") : trigger.parentNode);
  const pop = cfg.popup || document.createElement("div");
  const labelFor = cfg.label || (select && select.getAttribute("aria-label")) || "Filter";
  const selected = cfg.selected || (() => select.value);
  const optionsOf = cfg.options || (() => nativeOptions(select));
  let shown = [], active = 0;
  if (!cfg.trigger) { trigger.type = "button"; root.appendChild(trigger); }
  if (select) select.hidden = true;
  let text = trigger.querySelector(".fd-text");
  if (cfg.textElement) text = cfg.textElement;
  if (!text) { text = document.createElement("span"); text.className = "fd-text"; trigger.appendChild(text); }
  trigger.classList.add("fd-trigger");
  trigger.setAttribute("role", "combobox");
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-label", labelFor);
  pop.classList.remove("pop");
  pop.classList.add("fd-pop"); pop.setAttribute("role", "listbox");
  pop.setAttribute("aria-label", labelFor); pop.hidden = true;
  if (select) pop.id = select.id + "-pop";
  for (let i = 0; i < 10; i++) if (!pop.id) { const id = "filter-" + labelFor.toLowerCase().replace(/[^a-z0-9]+/g, "-") + (i ? "-" + i : ""); if (!document.getElementById(id)) { pop.id = id; break; } }
  trigger.setAttribute("aria-controls", pop.id);
  trigger.setAttribute("aria-expanded", "false");
  if (multi) pop.setAttribute("aria-multiselectable", "true");
  pop.tabIndex = -1;
  if (!pop.parentNode) root.appendChild(pop);
  if (!trigger.querySelector(".fd-chev")) {
    const chev = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    chev.classList.add("fd-chev"); chev.setAttribute("viewBox", "0 0 20 20"); chev.setAttribute("aria-hidden", "true");
    chev.innerHTML = '<path d="m6 8 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>';
    trigger.appendChild(chev);
  }
  const valueChosen = value => { const v = selected(); return multi ? (value ? v.has(value) : v.size === 0) : v === value; };
  const focusCurrent = () => { const b = pop.querySelector('[role="option"][tabindex="0"]'); if (b) b.focus({ preventScroll: true }); };
  function refresh() {
    shown = optionsOf() || [];
    if (cfg.disabled) { trigger.disabled = !!cfg.disabled(); if (trigger.disabled) close(false); }
    if (!trigger.disabled) text.textContent = cfg.summary ? cfg.summary(shown) : ((shown.find(o => valueChosen(o.value)) || shown[0] || {}).label || "");
    if (pop.hidden) return;
    pop.replaceChildren();
    let lastGroup;
    shown.forEach((o, i) => {
      if (o.group && o.group !== lastGroup) { const h = document.createElement("div"); h.className = "fd-group"; h.textContent = o.group; h.setAttribute("aria-hidden", "true"); pop.appendChild(h); lastGroup = o.group; }
      const b = document.createElement("button"); b.type = "button"; b.className = "fd-opt";
      b.setAttribute("role", "option"); b.dataset.value = o.value; b.textContent = o.label;
      if (o.data) for (const [k, v] of Object.entries(o.data)) b.dataset[k] = v;
      b.setAttribute("aria-selected", String(valueChosen(o.value)));
      b.disabled = !!o.disabled; if (o.disabled) b.setAttribute("aria-disabled", "true");
      if (i === active && !o.disabled) b.tabIndex = 0; else b.tabIndex = -1;
      b.addEventListener("focus", () => { active = i; [...pop.children].forEach(x => { if (x.matches('[role="option"]')) x.tabIndex = x === b ? 0 : -1; }); });
      b.addEventListener("click", () => {
        active = i;
        if (select) { select.value = o.value; select.dispatchEvent(new Event("change", { bubbles: true })); }
        if (cfg.onPick) cfg.onPick(o.value);
        if (!multi) close(true); else refresh();
      });
      pop.appendChild(b);
    });
  }
  function place() {
    pop.style.left = "0px";
    const r = pop.getBoundingClientRect(), overflow = Math.min(0, innerWidth - 18 - r.right);
    pop.style.left = overflow + "px";
  }
  function open() {
    if (trigger.disabled) return;
    if (cfg.beforeOpen && cfg.beforeOpen() === false) return;
    if (active >= shown.length || !shown[active] || shown[active].disabled) active = Math.max(0, shown.findIndex((o, i) => valueChosen(o.value) && !o.disabled), 0);
    pop.hidden = false; trigger.setAttribute("aria-expanded", "true"); refresh(); place(); focusCurrent();
  }
  function close(restore) { pop.hidden = true; trigger.setAttribute("aria-expanded", "false"); if (restore) trigger.focus({ preventScroll: true }); }
  trigger.addEventListener("click", () => pop.hidden ? open() : close(true));
  trigger.addEventListener("keydown", e => { if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); if (pop.hidden) { if (e.key === "ArrowUp") active = Math.max(0, shown.length - 1); open(); } else move(e.key === "ArrowDown" ? 1 : -1); } });
  pop.addEventListener("keypress", e => { if (e.key === "Escape") { e.preventDefault(); close(true); } });
  function move(delta) {
    if (!shown.length) return;
    for (let i = 0; i < shown.length; i++) { active = (active + delta + shown.length) % shown.length; if (!shown[active].disabled) { focusCurrent(); return; } }
  }
  pop.addEventListener("keydown", e => {
    if (e.key === "Escape") { e.preventDefault(); close(true); return; }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); move(e.key === "ArrowDown" ? 1 : -1); }
    if (e.key === "Home" || e.key === "End") { e.preventDefault(); active = e.key === "Home" ? -1 : shown.length; move(e.key === "Home" ? 1 : -1); }
  });
  document.addEventListener("click", e => { if (!pop.hidden && !e.composedPath().includes(pop) && !trigger.contains(e.target)) close(false); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !pop.hidden) { e.preventDefault(); close(true); } });
  if (select) {
    select.addEventListener("change", refresh);
    if (typeof MutationObserver !== "undefined") new MutationObserver(refresh).observe(select, { childList: true, attributes: true, attributeFilter: ["disabled"] });
  }
  refresh();
  return { trigger, popup: pop, refresh, close };
}
