import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// relative base so the built app can live under any static subpath
// (e.g. religionmap.org/apps/workbench/) without a rebuild per host
export default defineConfig({
  plugins: [react()],
  base: "./",
});
