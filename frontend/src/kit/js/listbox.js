// listbox.js — a themed replacement for <select>, whose open list the browser draws
// and CSS can't style (guide 19, Themed controls only).
//
// The <select> stays in the page, hidden, as the source of truth: form.name.value,
// FormData and form.reset() keep working. Setting select.value from script doesn't
// fire an event, so call the returned sync() afterwards.
//
//   <label class="field"><span>Provider failures</span>
//     <select name="failures"><option value="0">0 (healthy)</option>…</select>
//   </label>
//
//   <script src="assets/js/listbox.js"></script>
//   <script>
//     const failures = Listbox.mount(form.failures);
//     failures.sync();                     // after changing form.failures.value
//   </script>
//
// Keys: Enter, Space or the arrows open it; arrows, Home, End and type-ahead move;
// Enter or Space picks; Escape or Tab closes, and focus returns to the button.
//
// No dependencies.
(function () {
  "use strict";

  let seq = 0;

  function mount(select, options = {}) {
    const id = `lb${++seq}`;
    const label = options.label ||
      select.closest("label")?.querySelector(":scope > span")?.textContent.trim() || "";

    const root = document.createElement("div");
    root.className = "listbox";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "listbox-button";
    button.setAttribute("aria-haspopup", "listbox");
    button.setAttribute("aria-expanded", "false");
    if (label) button.setAttribute("aria-label", label);
    const list = document.createElement("ul");
    list.className = "listbox-list";
    list.id = id;
    list.tabIndex = -1;
    list.hidden = true;
    list.setAttribute("role", "listbox");
    if (label) list.setAttribute("aria-label", label);
    root.append(button, list);

    const items = [...select.options].map((opt, i) => {
      const li = document.createElement("li");
      li.id = `${id}-${i}`;
      li.className = "listbox-option";
      li.setAttribute("role", "option");
      li.dataset.value = opt.value;
      li.textContent = opt.textContent;
      if (opt.disabled) li.setAttribute("aria-disabled", "true");
      list.append(li);
      return li;
    });

    let active = 0;
    let typed = "";
    let typedAt = 0;
    const isOpen = () => !list.hidden;

    function sync() {
      const selected = Math.max(0, select.selectedIndex);
      items.forEach((li, i) => li.setAttribute("aria-selected", String(i === selected)));
      button.textContent = items[selected]?.textContent ?? "";
    }

    function setActive(i) {
      active = Math.min(items.length - 1, Math.max(0, i));
      items.forEach((li, j) => li.classList.toggle("active", j === active));
      list.setAttribute("aria-activedescendant", items[active].id);
      items[active].scrollIntoView({ block: "nearest" });
    }

    function open() {
      if (isOpen()) return;
      list.hidden = false;
      // Open upward when the list would run off the bottom of the viewport.
      const room = innerHeight - button.getBoundingClientRect().bottom;
      root.classList.toggle("up", room < list.offsetHeight + 8 && button.getBoundingClientRect().top > room);
      button.setAttribute("aria-expanded", "true");
      setActive(Math.max(0, select.selectedIndex));
      list.focus();
    }

    function close(refocus = true) {
      if (!isOpen()) return;
      list.hidden = true;
      button.setAttribute("aria-expanded", "false");
      if (refocus) button.focus();
    }

    function choose(i) {
      if (items[i].getAttribute("aria-disabled") === "true") return;
      if (select.selectedIndex !== i) {
        select.selectedIndex = i;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
      sync();
      close();
    }

    button.addEventListener("click", () => (isOpen() ? close() : open()));
    button.addEventListener("keydown", (e) => {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        open();
      }
    });

    list.addEventListener("keydown", (e) => {
      const last = items.length - 1;
      if (e.key === "ArrowDown") setActive(active + 1);
      else if (e.key === "ArrowUp") setActive(active - 1);
      else if (e.key === "Home") setActive(0);
      else if (e.key === "End") setActive(last);
      else if (e.key === "Enter" || e.key === " ") choose(active);
      else if (e.key === "Escape") close();
      else if (e.key === "Tab") { close(false); return; }
      else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Type-ahead: letters typed in quick succession extend one prefix.
        const now = Date.now();
        typed = (now - typedAt < 700 ? typed : "") + e.key.toLowerCase();
        typedAt = now;
        const hit = items.findIndex((li) => li.textContent.trim().toLowerCase().startsWith(typed));
        if (hit >= 0) setActive(hit);
      } else return;
      e.preventDefault();
    });

    // The list sits inside the field's <label>, so a click on it would otherwise
    // activate the label and click the button again, reopening the list.
    list.addEventListener("click", (e) => {
      e.preventDefault();
      const li = e.target.closest(".listbox-option");
      if (li) choose(items.indexOf(li));
    });
    list.addEventListener("mousemove", (e) => {
      const li = e.target.closest(".listbox-option");
      if (li) setActive(items.indexOf(li));
    });
    list.addEventListener("focusout", (e) => {
      if (!root.contains(e.relatedTarget)) close(false);
    });

    select.form?.addEventListener("reset", () => setTimeout(sync));
    select.hidden = true;
    select.after(root);
    sync();
    return { sync, open, close, element: root };
  }

  window.Listbox = { mount };
})();
