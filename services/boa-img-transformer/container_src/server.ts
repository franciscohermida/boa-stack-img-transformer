import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { stream } from "hono/streaming";
import sharp from "sharp";
import { Readable } from "stream";
import { type ImageTransformInput, inputSchema } from "../src/schemas";

const app = new Hono();

app.post("*", async (c) => {
  try {
    // Get the request body as a stream - use the raw property to access the underlying stream
    const requestBody = c.req.raw.body;
    if (!requestBody) {
      throw new Error("No image data provided");
    }

    // Get input from query param "input" and decode it
    const inputParam = c.req.query("input");
    let parsedInput: ImageTransformInput | null = null;

    if (inputParam) {
      try {
        const decodedInput = decodeURIComponent(inputParam);
        const jsonInput = JSON.parse(decodedInput);
        parsedInput = inputSchema.parse(jsonInput);
      } catch (error) {
        console.warn("Failed to parse input parameter:", error);
      }
    }

    // Convert Web ReadableStream to Node.js Readable stream
    const reader = requestBody.getReader();
    const nodeReadable = new Readable({
      async read() {
        try {
          const { done, value } = await reader.read();
          if (done) {
            this.push(null);
          } else {
            this.push(Buffer.from(value));
          }
        } catch (error) {
          this.destroy(error as Error);
        }
      },
    });

    // Create Sharp transformer with safety limits
    const transformer = sharp({ limitInputPixels: 50000 * 50000 });

    // Apply transformations based on input or defaults
    if (parsedInput?.transform) {
      const { width, height, fit } = parsedInput.transform;
      transformer.resize(width, height, {
        withoutEnlargement: true,
        fit: fit || "inside",
      });
    }

    // Apply output format based on input or default
    const outputFormat = parsedInput?.output?.format ?? "image/webp";
    const quality = parsedInput?.output?.quality || 85;

    switch (outputFormat) {
      case "image/webp":
        transformer.webp({ quality });
        break;
      case "image/png":
        transformer.png({ quality });
        break;
      case "image/jpeg":
        transformer.jpeg({ quality });
        break;
    }

    // Determine content type and set headers before streaming
    c.header("Content-Type", outputFormat);
    c.header("Cache-Control", "public, max-age=31536000");

    // Use Hono's stream helper for true streaming response
    return stream(c, async (responseStream) => {
      const processedStream = nodeReadable.pipe(transformer);

      // Handle abort signal
      responseStream.onAbort(() => {
        console.log("Request aborted, destroying pipeline");
        processedStream.destroy();
      });

      // Manually pipe the processed stream to the response stream
      for await (const chunk of processedStream) {
        if (chunk instanceof Buffer) {
          await responseStream.write(
            new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength)
          );
        }
      }
    });
  } catch (error) {
    console.error("Image processing error:", error);
    return new Response(JSON.stringify({ error: "Failed to process image" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});

console.log("Server started on port 3000");
const server = serve({
  fetch: app.fetch,
  port: 3000,
});

// graceful shutdown
process.on("SIGINT", () => {
  server.close();
  process.exit(0);
});
process.on("SIGTERM", () => {
  server.close((err) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    process.exit(0);
  });
});
