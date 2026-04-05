import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const appDir = fileURLToPath(new URL(".", import.meta.url));
const appName = "TON Dead Man's Switch";

function tonConnectManifestPlugin() {
  return {
    name: "tonconnect-manifest",
    configureServer(server: {
      middlewares: {
        use: (
          path: string,
          handler: (
            req: { headers: Record<string, string | string[] | undefined> },
            res: { setHeader: (name: string, value: string) => void; end: (body: string) => void },
          ) => void,
        ) => void;
      };
    }) {
      server.middlewares.use("/tonconnect-manifest.json", (req, res) => {
        const host = Array.isArray(req.headers.host) ? req.headers.host[0] : req.headers.host;
        const origin = `https://${host}`;
        const basePath = "/";
        const manifest = {
          url: `${origin}${basePath}`,
          name: appName,
          iconUrl: `${origin}${basePath}tonconnect-icon.svg`,
          termsOfUseUrl: `${origin}${basePath}`,
          privacyPolicyUrl: `${origin}${basePath}`,
        };

        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(manifest));
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), tonConnectManifestPlugin()],
  base: process.env.VITE_BASE_PATH ?? (mode === "production" ? "/ton-deadmans-switch/" : "/"),
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    fs: {
      allow: [resolve(appDir, "..")],
    },
  },
}));
