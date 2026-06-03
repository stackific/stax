// Mode-preference cycle (auto / light / dark) wired to every
// `[data-theme-toggle]` button. Layout sets `<html data-theme="stackific"
// data-mode="auto">`; md3's runtime owns the actual mode swap, the
// `md3:mode` localStorage persistence, and the auto→system resolution via
// CSS @media (prefers-color-scheme). All this module does is cycle the
// user's preference through ui("mode", ...) and keep the toggle's icon in
// sync with whichever stage of the cycle we're at.
//
// Pattern mirrored from md3's demo (demo/src/shared/domain.ts modeIcon +
// updateMode) so the icon vocabulary matches what the framework's own
// reference UI uses: auto → brightness_auto, light → light_mode,
// dark → dark_mode.

type ModePref = "auto" | "light" | "dark";

const MODE_CYCLE: readonly ModePref[] = ["auto", "light", "dark"] as const;

// md3 registers `ui()` on `window` as a side effect of `import
// "@stackific/md3"` in bundle.ts. The published dist has no module
// exports, so we read the global rather than importing the function.
const ui = window.ui;

function currentMode(): ModePref {
  const v = ui("mode") as string | undefined;
  return v === "light" || v === "dark" || v === "auto" ? v : "auto";
}

function modeIcon(pref: ModePref): string {
  switch (pref) {
    case "light":
      return "light_mode";
    case "dark":
      return "dark_mode";
    default:
      return "brightness_auto";
  }
}

function syncThemeIcons(): void {
  const icon = modeIcon(currentMode());
  for (const el of document.querySelectorAll("[data-theme-toggle] i")) {
    el.textContent = icon;
  }
}

function cycleMode(): void {
  const current = currentMode();
  const next = MODE_CYCLE[(MODE_CYCLE.indexOf(current) + 1) % MODE_CYCLE.length];
  ui("mode", next);
  syncThemeIcons();
}

export function initTheme(): void {
  syncThemeIcons();
  for (const btn of document.querySelectorAll("[data-theme-toggle]")) {
    btn.addEventListener("click", cycleMode);
  }
}
