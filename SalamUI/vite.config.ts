import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { execSync } from "child_process"; // Import execSync to execute shell command

declare module "@remix-run/node" {
  interface Future {
    v3_singleFetch: true;
  }
}

const localIp = execSync("node get-local-ip.cjs").toString().trim(); // Get the local IP address from the script

export default defineConfig({
  plugins: [
    remix({
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
        v3_singleFetch: true,
        v3_lazyRouteDiscovery: true,
      },
    }),
    tsconfigPaths(),
  ],
  server: {
    host: "0.0.0.0", // This allows other devices on the network to access the dev server
    port: 3000, // You can change this port if needed
    hmr: {
      host: localIp, // Use the local IP address for HMR
      port: 3000, // The port Vite should use for HMR
    },
  },
});
