/**
 * One-time OAuth flow to print a Google Calendar refresh token for Virgil.
 *
 * Prerequisites:
 *   - GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET in .env.local
 *   - Google Cloud: OAuth client (Web or Desktop) with this exact redirect URI
 *     (default port; override with GOOGLE_CALENDAR_OAUTH_PORT if needed):
 *       http://127.0.0.1:8765/oauth2callback
 *
 * Usage:
 *   pnpm google-calendar:refresh-token
 *
 * Copy the printed refresh_token into GOOGLE_CALENDAR_REFRESH_TOKEN and set
 * VIRGIL_CALENDAR_INTEGRATION=1. Never commit the token.
 */

import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { config } from "dotenv";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
const rawPort = process.env.GOOGLE_CALENDAR_OAUTH_PORT;
const PORT = Number(rawPort) || 8765;
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65_535) {
  console.error(
    "GOOGLE_CALENDAR_OAUTH_PORT must be an integer from 1 to 65535 if set."
  );
  process.exit(1);
}
const REDIRECT_PATH = "/oauth2callback";
const REDIRECT_URI = `http://127.0.0.1:${PORT}${REDIRECT_PATH}`;

function openBrowser(url: string): void {
  try {
    if (process.platform === "darwin") {
      execFileSync("open", [url], { stdio: "ignore" });
    } else if (process.platform === "win32") {
      execFileSync("cmd", ["/c", "start", "", url], { stdio: "ignore" });
    } else {
      execFileSync("xdg-open", [url], { stdio: "ignore" });
    }
  } catch {
    // ignore — user can open the URL manually
  }
}

async function exchangeCode(code: string): Promise<{
  access_token?: string;
  refresh_token?: string;
  error?: string;
  error_description?: string;
}> {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing GOOGLE_CALENDAR_CLIENT_ID or GOOGLE_CALENDAR_CLIENT_SECRET in .env.local"
    );
  }
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: REDIRECT_URI,
    grant_type: "authorization_code",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  return (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    error?: string;
    error_description?: string;
  };
}

function main(): void {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    console.error(
      "Set GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET in .env.local first."
    );
    process.exit(1);
  }

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", SCOPE);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
    if (url.pathname !== REDIRECT_PATH) {
      res.writeHead(404).end("Not found");
      return;
    }
    const err = url.searchParams.get("error");
    const code = url.searchParams.get("code");
    if (err) {
      const desc = url.searchParams.get("error_description") ?? err;
      res
        .writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
        .end(`<p>Authorization failed: ${desc}</p>`);
      console.error("OAuth error:", desc);
      server.close();
      process.exit(1);
      return;
    }
    if (!code) {
      res.writeHead(400).end("Missing code");
      server.close();
      process.exit(1);
      return;
    }

    try {
      const data = await exchangeCode(code);
      if (data.error) {
        throw new Error(data.error_description ?? data.error);
      }
      res
        .writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
        .end(
          "<p>Success. You can close this tab and return to the terminal.</p>"
        );

      console.log("");
      if (data.refresh_token) {
        console.log("Add this to .env.local (keep it secret):");
        console.log("");
        console.log(`GOOGLE_CALENDAR_REFRESH_TOKEN=${data.refresh_token}`);
        console.log("");
      } else {
        console.log(
          "No refresh_token in response. Revoke app access at https://myaccount.google.com/permissions and run this script again, or ensure prompt=consent is used."
        );
        console.log("");
        server.close();
        process.exit(1);
        return;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res
        .writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
        .end(`<p>Token exchange failed: ${msg}</p>`);
      console.error("Token exchange failed:", msg);
      server.close();
      process.exit(1);
      return;
    }
    server.close();
    process.exit(0);
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `Port ${PORT} is already in use (another refresh-token run?).\n` +
          "Stop that process, or set GOOGLE_CALENDAR_OAUTH_PORT to a free port and add the matching redirect URI in Google Cloud.\n" +
          `Find listener: lsof -nP -iTCP:${PORT} -sTCP:LISTEN`
      );
    } else {
      console.error(err);
    }
    process.exit(1);
  });

  server.listen(PORT, "127.0.0.1", () => {
    console.log("");
    console.log(
      "1. In Google Cloud Console → Credentials → your OAuth client:"
    );
    console.log(`   Add Authorized redirect URI: ${REDIRECT_URI}`);
    console.log("");
    console.log(
      "2. A browser window should open. Sign in and allow Calendar (read-only)."
    );
    console.log("");
    const url = authUrl.toString();
    openBrowser(url);
    console.log("If the browser did not open, visit:");
    console.log(url);
    console.log("");
  });
}

main();
