import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import { CortiClient } from "@corti/sdk";

const variables = [
  "CORTI_CLIENT_ID",
  "CORTI_CLIENT_SECRET",
  "CORTI_TENANT_NAME",
  "CORTI_ENVIRONMENT",
];
const prefix = "/__storybook/corti/";
const loopback = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

export function readLiveSettings(root, environment = process.env) {
  let file = {};
  try {
    file = parseEnv(readFileSync(resolve(root, ".env.local"), "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const values = variables.map((name) => (environment[name] ?? file[name])?.trim());
  if (values.every((value) => !value)) return undefined;
  const missing = variables.filter((_, index) => !values[index]);
  if (missing.length) {
    throw new Error(`Storybook live setup: missing ${missing.join(", ")} in .env.local.`);
  }
  return {
    auth: { clientId: values[0], clientSecret: values[1] },
    tenantName: values[2],
    environment: values[3],
  };
}

function send(response, status, body) {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

function isLocalRequest(request) {
  const host = request.headers.host;
  if (
    !loopback.has(request.socket.remoteAddress) ||
    !loopback.has(request.socket.localAddress) ||
    !["127.0.0.1", "localhost", "[::1]"].some(
      (name) => host === `${name}:${request.socket.localPort}`,
    )
  ) return false;
  return (
    request.headers["x-storybook-live"] === "1" &&
    request.headers["sec-fetch-site"] === "same-origin" &&
    request.headers.origin === `http://${host}`
  );
}

export function createLivePlugin(settings, createClient = (options) => new CortiClient(options)) {
  const client = createClient(settings);
  return {
    name: "storybook-corti-live",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (!request.url?.startsWith(prefix)) return next();
        if (!isLocalRequest(request)) {
          send(response, 403, { message: "Live setup is restricted to same-origin localhost requests." });
          return;
        }
        if (request.method !== "POST") {
          send(response, 405, { message: "Use POST for live setup." });
          return;
        }
        const action = request.url.slice(prefix.length);
        if (action !== "token" && action !== "interaction") {
          send(response, 404, { message: "Unknown live setup endpoint." });
          return;
        }
        void handle(action, request, response);
      });
    },
  };

  async function handle(action, request, response) {
    try {
      if (action === "token") {
        // getAuthHeaders uses the SDK's shared credential provider and refresh lifecycle.
        const headers = await client.getAuthHeaders();
        const authorization = headers.get("Authorization");
        if (!authorization?.startsWith("Bearer ")) {
          throw new Error("The SDK did not return a bearer token.");
        }
        const accessToken = authorization.slice(7);
        const claims = JSON.parse(Buffer.from(accessToken.split(".")[1], "base64url").toString("utf8"));
        const expiresIn = claims.exp - Math.floor(Date.now() / 1000);
        if (typeof claims.exp !== "number" || !Number.isFinite(expiresIn) || expiresIn <= 0) {
          throw new Error("The SDK returned a token without a valid expiry.");
        }
        send(response, 200, { accessToken, expiresIn });
      } else {
        const authorization = request.headers.authorization;
        if (authorization && !/^Bearer \S+$/.test(authorization)) {
          send(response, 400, { message: "Invalid manual bearer token." });
          return;
        }
        const interactionClient = authorization
          ? createClient({ auth: { accessToken: authorization.slice(7) } })
          : client;
        const result = await interactionClient.interactions.create({
          encounter: {
            identifier: `storybook-${randomUUID()}`,
            title: "Storybook live ambient test",
            status: "planned",
            type: "first_consultation",
          },
        }, { maxRetries: 0 });
        if (!result.interactionId) throw new Error("The SDK did not return an interaction ID.");
        send(response, 200, { interactionId: result.interactionId });
      }
    } catch (error) {
      const creationUncertain = action === "interaction" &&
        (typeof error.statusCode !== "number" || error.statusCode >= 500);
      send(response, 502, {
        message: action === "token"
          ? "Unable to fetch a Corti token. Check the local credentials and API availability."
          : "Unable to create a Corti interaction. Check API permissions and availability.",
        creationUncertain,
      });
    }
  }
}
