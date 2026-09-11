import { defineConfig } from "vite"
import { fileURLToPath } from "node:url"
// Local mocked UI fixture, not a production route.
export default defineConfig({
  define: { "process.env": JSON.stringify({ NODE_ENV: "development" }) },
  resolve: {
    alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) },
  },
  server: { host: "127.0.0.1", port: 15443, strictPort: true },
})
