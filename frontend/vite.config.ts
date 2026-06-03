import {
  existsSync,
  readdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type PluginOption } from "vite";
import handlebars from "vite-plugin-handlebars";

const root = dirname(fileURLToPath(import.meta.url));

const pages = ["index", "search", "systems", "system", "work-items", "work-item", "404"] as const;

// Rename the deduplicated entry chunk (Vite/Rollup emits `bundleN.js` when
// multiple HTML entries all request the same `bundle.js` name) back to
// `bundle.js`, and rewrite HTML references. Build-only.
const renameBundle = (): PluginOption => ({
  name: "stax-rename-bundle",
  apply: "build",
  closeBundle() {
    const dist = resolve(root, "dist");
    if (!existsSync(dist)) return;
    const files = readdirSync(dist);
    const target = files.find((f) => /^bundle\d+\.js$/.test(f));
    if (!target) return;
    const final = "bundle.js";
    renameSync(resolve(dist, target), resolve(dist, final));
    for (const f of files) {
      if (!f.endsWith(".html")) continue;
      const p = resolve(dist, f);
      writeFileSync(p, readFileSync(p, "utf8").split(target).join(final));
    }
  },
});

// md3 ships @font-face declarations for four Material Symbols variants
// (Outlined, Rounded, Sharp, Subset) and references them with relative
// `url(./assets/material-symbols-*.woff2)` paths that Vite resolves and
// emits into `dist/assets/`. Only Outlined is ever rendered — it's the
// `--font-icon` default and the only family the `i` selector resolves to —
// so the three other woff2 files are dead weight (~1.4 MB combined). This
// plugin strips the dead @font-face blocks from bundle.css and deletes
// the orphan woff2 files Vite emitted to dist/assets/. Build-only.
const md3SymbolFonts = (): PluginOption => ({
  name: "stax-md3-symbol-fonts",
  apply: "build",
  closeBundle() {
    const dist = resolve(root, "dist");
    if (!existsSync(dist)) return;
    const unusedVariants = ["Rounded", "Sharp", "Subset"] as const;

    const cssPath = resolve(dist, "bundle.css");
    if (existsSync(cssPath)) {
      let css = readFileSync(cssPath, "utf8");
      for (const variant of unusedVariants) {
        // @font-face blocks have no nested braces, so [^}]* is safe.
        const block = new RegExp(`@font-face\\{[^}]*Material Symbols ${variant}[^}]*\\}`, "g");
        css = css.replace(block, "");
      }
      writeFileSync(cssPath, css);
    }

    for (const variant of unusedVariants) {
      const file = `material-symbols-${variant.toLowerCase()}.woff2`;
      const p = resolve(dist, "assets", file);
      if (existsSync(p)) unlinkSync(p);
    }
  },
});

// Rewrite extensionless URLs (`/systems`) to their `.html` file during dev so
// the in-browser experience matches production (where static hosts serve
// `systems.html` for `/systems` natively). Skips files, Vite internals, and root.
const htmlFallback = (): PluginOption => ({
  name: "stax-html-fallback",
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      const url = req.url ?? "";
      if (
        url === "/" ||
        url.includes(".") ||
        url.startsWith("/@") ||
        url.startsWith("/src/") ||
        url.startsWith("/node_modules/")
      ) {
        return next();
      }
      const [path, query] = url.split("?", 2);
      const candidate = resolve(root, `${path.slice(1)}.html`);
      if (existsSync(candidate)) {
        req.url = `${path}.html${query ? `?${query}` : ""}`;
      }
      next();
    });
  },
});

export default defineConfig({
  appType: "mpa",
  plugins: [
    htmlFallback(),
    handlebars({
      partialDirectory: resolve(root, "partials"),
    }),
    renameBundle(),
    md3SymbolFonts(),
  ],
  server: {
    proxy: {
      "/api": "http://localhost:7829",
    },
  },
  build: {
    target: "es2022",
    minify: "terser",
    terserOptions: {
      compress: {
        passes: 3,
        drop_console: true,
        drop_debugger: true,
        ecma: 2020,
      },
      mangle: true,
      format: { comments: false },
    },
    cssCodeSplit: false,
    cssMinify: true,
    rollupOptions: {
      // bundle.ts has no exports — let Rollup merge entry chunks into one.
      preserveEntrySignatures: false,
      input: Object.fromEntries(pages.map((p) => [p, resolve(root, `${p}.html`)])),
      output: {
        entryFileNames: "bundle.js",
        chunkFileNames: "bundle.js",
        assetFileNames: (info) => {
          if (info.name?.endsWith(".css")) return "bundle.css";
          return "assets/[name][extname]";
        },
      },
    },
  },
});
