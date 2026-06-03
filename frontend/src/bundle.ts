import "@stackific/md3";
import "@stackific/md3/style";
import "material-dynamic-colors";
import "./styles/app.scss";

import { home } from "./pages/home";
import { search } from "./pages/search";
import { system } from "./pages/system";
import { systems } from "./pages/systems";
import { workItem } from "./pages/work-item";
import { workItems } from "./pages/work-items";
import { syncActiveNav } from "./shared/nav";
import { initSidebar } from "./shared/sidebar";
import { initTheme } from "./shared/theme";
import { initThemePicker } from "./shared/theme-picker";

const pages: Record<string, () => void | Promise<void>> = {
  home,
  search,
  systems,
  system,
  "work-items": workItems,
  "work-item": workItem,
};

function start(): void {
  initTheme();
  initThemePicker();
  initSidebar();
  syncActiveNav();

  const name = document.body.dataset.page ?? "";
  const init = pages[name];
  if (init) {
    Promise.resolve(init()).catch((err: unknown) => {
      console.error(`[bundle] page "${name}" init failed:`, err);
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start);
} else {
  start();
}
