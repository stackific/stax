// Theme-picker menu population + click handling. Mirrors the demo's
// pattern (md3/demo/src/home/page.vue lines 347-352): a `<button data-ui>`
// toggles a sibling `<menu>` via md3, and each `<li>` swaps the active
// baked theme via `ui("theme", name)`. md3 owns the visual swap and
// localStorage persistence (md3:theme); this module fills the menu and
// closes it after a pick.
//
// Display names are unslugified: "hello-pumpkin" → "Hello Pumpkin". The
// raw slug stays on the <li>'s dataset and is what `ui("theme", slug)`
// expects.

import { $, tpl } from "./dom";

const ui = window.ui;

function listThemes(): string[] {
  const themes = ui("themes") as string[] | undefined;
  return themes ? themes.slice().sort() : [];
}

function unslugify(slug: string): string {
  return slug
    .split("-")
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(" ");
}

function pickTheme(slug: string, trigger: HTMLElement): void {
  ui("theme", slug);
  trigger.closest("menu")?.classList.remove("active");
}

export function initThemePicker(): void {
  const themes = listThemes();
  for (const menu of document.querySelectorAll<HTMLElement>("[data-theme-picker]")) {
    for (const slug of themes) {
      const node = tpl("tpl-theme-picker-item");
      const li = $<HTMLLIElement>('[data-slot="name"]', node);
      li.textContent = unslugify(slug);
      li.dataset.themeSlug = slug;
      li.addEventListener("click", (e) => pickTheme(slug, e.currentTarget as HTMLElement));
      menu.appendChild(node);
    }
  }
}
