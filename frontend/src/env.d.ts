/// <reference types="vite/client" />

declare module "@stackific/md3";
declare module "@stackific/md3/style";

interface Window {
  ui: (...args: unknown[]) => unknown;
}
