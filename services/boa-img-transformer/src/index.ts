import { Container, loadBalance, getContainer } from "@cloudflare/containers";
import { WorkerEntrypoint } from "cloudflare:workers";
import { Hono } from "hono";

export * from "./schemas";

export class BoaImgTransformer extends Container {
  // Port the container listens on (default: 3000)
  defaultPort = 3000;
  // Time before container sleeps due to inactivity (default: 30s)
  sleepAfter = "2m";
  // Environment variables passed to the container
  envVars = {
    MESSAGE: "I was passed in via the container class!",
  };

  // Optional lifecycle hooks
  override onStart() {
    console.log("Container successfully started");
  }

  override onStop() {
    console.log("Container successfully shut down");
  }

  override onError(error: unknown) {
    console.log("Container error:", error);
  }
}

// Create Hono app with proper typing for Cloudflare Workers
const app = new Hono<{
  Bindings: Env;
}>();

app.post("*", async (c) => {
  // this is only for local development because wrangler dev container is not supported on windows
  if (c.env.MODE === "development") {
    const newUrl = new URL(c.req.url);
    newUrl.host = "localhost:3000";
    return fetch(newUrl, {
      method: "POST",
      body: c.req.raw.body,
    });
  }

  // use whatever load balancing that is suitable for your use case
  const container = getContainer(c.env.BOA_IMG_TRANSFORMER);
  return await container.fetch(c.req.raw);
});

export default class extends WorkerEntrypoint<Env> {
  constructor(ctx: ExecutionContext, env: Env) {
    super(ctx, env);
  }

  // disabled in production can only be accessed via internalFetch service binding
  async fetch(request: Request) {
    if (this.env.MODE !== "development")
      return new Response("Not allowed", { status: 403 });
    return app.fetch(request, this.env, this.ctx);
  }

  async internalFetch(request: Request) {
    return app.fetch(request, this.env, this.ctx);
  }
}
