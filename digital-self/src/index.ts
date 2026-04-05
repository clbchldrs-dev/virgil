import "dotenv/config";
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { loadEnv } from "./config.js";
import { createServerContext } from "./server-context.js";

const env = loadEnv(process.env);
const ctx = createServerContext({ env });
const app = createApp(ctx);

serve(
  {
    fetch: app.fetch,
    port: env.PORT,
  },
  (info) => {
    process.stdout.write(
      `digital-self listening on http://localhost:${String(info.port)}\n`
    );
  }
);
