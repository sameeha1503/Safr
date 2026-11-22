import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  if (command === "build" && process.env["VERCEL_ENV"] === "production") {
    const missing = [
      "VITE_SUPABASE_URL",
      "VITE_SUPABASE_PUBLISHABLE_KEY",
    ].filter((key) => !env[key]?.trim());
    if (missing.length) {
      throw new Error(
        `Set these Vercel Production variables before building: ${missing.join(", ")}`,
      );
    }
  }
  // These values belong only to server functions, never to browser defines.
  for (const key of [
    "SUPABASE_URL",
    "SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "NOTIFY_MODE",
    "NOTIFY_CHANNELS",
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_WHATSAPP_FROM",
    "TWILIO_WHATSAPP_NUMBER",
    "TWILIO_SMS_FROM",
    "TWILIO_PHONE_NUMBER",
    "GEMINI_API_KEY",
    "GEMINI_MODEL",
    "OSRM_BASE_URL",
    "OVERPASS_URL",
    "OVERPASS_FALLBACK_URL",
    "ROUTING_PROVIDER",
    "VALHALLA_BASE_URL",
  ]) {
    if (!process.env[key] && env[key]) process.env[key] = env[key];
  }
  return {
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: "react-core",
                test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
                priority: 30,
              },
              {
                name: "tanstack-core",
                test: /node_modules[\\/]@tanstack[\\/]/,
                priority: 20,
              },
              {
                name: "supabase-core",
                test: /node_modules[\\/]@supabase[\\/]/,
                priority: 20,
              },
              {
                name: "ui-core",
                test: /node_modules[\\/](@radix-ui|cmdk|vaul)[\\/]/,
                priority: 10,
              },
            ],
          },
        },
      },
    },
    plugins: [
      tailwindcss(),
      tanstackStart({
        server: { entry: "server" },
      }),
      ...(process.env["VERCEL"] === "1"
        ? [nitro({ preset: "vercel", serverEntry: false })]
        : []),
      react(),
    ],
    resolve: {
      tsconfigPaths: true,
      alias: {
        "@": "/src",
      },
    },
  };
});
