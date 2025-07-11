// vite.config.ts
import { vitePlugin as remix } from "file:///home/hurkane/projects/1/SalamUI/node_modules/@remix-run/dev/dist/index.js";
import { defineConfig } from "file:///home/hurkane/projects/1/SalamUI/node_modules/vite/dist/node/index.js";
import tsconfigPaths from "file:///home/hurkane/projects/1/SalamUI/node_modules/vite-tsconfig-paths/dist/index.mjs";
import { execSync } from "child_process";
var localIp = execSync("node get-local-ip.cjs").toString().trim();
var vite_config_default = defineConfig({
  plugins: [
    remix({
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
        v3_singleFetch: true,
        v3_lazyRouteDiscovery: true
      }
    }),
    tsconfigPaths()
  ],
  server: {
    host: "0.0.0.0",
    // This allows other devices on the network to access the dev server
    port: 3e3,
    // You can change this port if needed
    hmr: {
      host: localIp,
      // Use the local IP address for HMR
      port: 3e3
      // The port Vite should use for HMR
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9odXJrYW5lL3Byb2plY3RzLzEvU2FsYW1VSVwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL2hvbWUvaHVya2FuZS9wcm9qZWN0cy8xL1NhbGFtVUkvdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL2hvbWUvaHVya2FuZS9wcm9qZWN0cy8xL1NhbGFtVUkvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyB2aXRlUGx1Z2luIGFzIHJlbWl4IH0gZnJvbSBcIkByZW1peC1ydW4vZGV2XCI7XG5pbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xuaW1wb3J0IHRzY29uZmlnUGF0aHMgZnJvbSBcInZpdGUtdHNjb25maWctcGF0aHNcIjtcbmltcG9ydCB7IGV4ZWNTeW5jIH0gZnJvbSBcImNoaWxkX3Byb2Nlc3NcIjsgLy8gSW1wb3J0IGV4ZWNTeW5jIHRvIGV4ZWN1dGUgc2hlbGwgY29tbWFuZFxuXG5kZWNsYXJlIG1vZHVsZSBcIkByZW1peC1ydW4vbm9kZVwiIHtcbiAgaW50ZXJmYWNlIEZ1dHVyZSB7XG4gICAgdjNfc2luZ2xlRmV0Y2g6IHRydWU7XG4gIH1cbn1cblxuY29uc3QgbG9jYWxJcCA9IGV4ZWNTeW5jKFwibm9kZSBnZXQtbG9jYWwtaXAuY2pzXCIpLnRvU3RyaW5nKCkudHJpbSgpOyAvLyBHZXQgdGhlIGxvY2FsIElQIGFkZHJlc3MgZnJvbSB0aGUgc2NyaXB0XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFtcbiAgICByZW1peCh7XG4gICAgICBmdXR1cmU6IHtcbiAgICAgICAgdjNfZmV0Y2hlclBlcnNpc3Q6IHRydWUsXG4gICAgICAgIHYzX3JlbGF0aXZlU3BsYXRQYXRoOiB0cnVlLFxuICAgICAgICB2M190aHJvd0Fib3J0UmVhc29uOiB0cnVlLFxuICAgICAgICB2M19zaW5nbGVGZXRjaDogdHJ1ZSxcbiAgICAgICAgdjNfbGF6eVJvdXRlRGlzY292ZXJ5OiB0cnVlLFxuICAgICAgfSxcbiAgICB9KSxcbiAgICB0c2NvbmZpZ1BhdGhzKCksXG4gIF0sXG4gIHNlcnZlcjoge1xuICAgIGhvc3Q6IFwiMC4wLjAuMFwiLCAvLyBUaGlzIGFsbG93cyBvdGhlciBkZXZpY2VzIG9uIHRoZSBuZXR3b3JrIHRvIGFjY2VzcyB0aGUgZGV2IHNlcnZlclxuICAgIHBvcnQ6IDMwMDAsIC8vIFlvdSBjYW4gY2hhbmdlIHRoaXMgcG9ydCBpZiBuZWVkZWRcbiAgICBobXI6IHtcbiAgICAgIGhvc3Q6IGxvY2FsSXAsIC8vIFVzZSB0aGUgbG9jYWwgSVAgYWRkcmVzcyBmb3IgSE1SXG4gICAgICBwb3J0OiAzMDAwLCAvLyBUaGUgcG9ydCBWaXRlIHNob3VsZCB1c2UgZm9yIEhNUlxuICAgIH0sXG4gIH0sXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBa1IsU0FBUyxjQUFjLGFBQWE7QUFDdFQsU0FBUyxvQkFBb0I7QUFDN0IsT0FBTyxtQkFBbUI7QUFDMUIsU0FBUyxnQkFBZ0I7QUFRekIsSUFBTSxVQUFVLFNBQVMsdUJBQXVCLEVBQUUsU0FBUyxFQUFFLEtBQUs7QUFFbEUsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUztBQUFBLElBQ1AsTUFBTTtBQUFBLE1BQ0osUUFBUTtBQUFBLFFBQ04sbUJBQW1CO0FBQUEsUUFDbkIsc0JBQXNCO0FBQUEsUUFDdEIscUJBQXFCO0FBQUEsUUFDckIsZ0JBQWdCO0FBQUEsUUFDaEIsdUJBQXVCO0FBQUEsTUFDekI7QUFBQSxJQUNGLENBQUM7QUFBQSxJQUNELGNBQWM7QUFBQSxFQUNoQjtBQUFBLEVBQ0EsUUFBUTtBQUFBLElBQ04sTUFBTTtBQUFBO0FBQUEsSUFDTixNQUFNO0FBQUE7QUFBQSxJQUNOLEtBQUs7QUFBQSxNQUNILE1BQU07QUFBQTtBQUFBLE1BQ04sTUFBTTtBQUFBO0FBQUEsSUFDUjtBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
