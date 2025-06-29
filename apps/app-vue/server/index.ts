import { BoaImgTransformerWorker } from "@boxofapps/img-transformer";
import { getPresetFromUrl, uploadToR2InChunks } from "./utils/imgTransformerUtils";

type Env = {
  ASSETS: Fetcher;
  BOA_IMG_TRANSFORMER: Service<BoaImgTransformerWorker>;
  R2: R2Bucket;
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/clear-cache")) {
      const list = await env.R2.list({
        prefix: "cached/",
      });
      for (const item of list.objects) {
        console.log("deleting", item.key);
        await env.R2.delete(item.key);
      }
      return new Response("OK");
    }

    if (url.pathname.startsWith("/api/assets/")) {
      // Extract the key from the URL (everything after /api/assets/)
      const key = decodeURIComponent(url.pathname.substring("/api/assets/".length));

      if (!key || key === "") {
        return new Response("No asset key provided", { status: 400 });
      }

      const { preset, presetName } = await getPresetFromUrl(url);

      const assetPath = url.pathname.replace("/api/assets", "");

      if (presetName == null) {
        return env.ASSETS.fetch(new URL(assetPath, request.url));
      } else {
        const cachedKey = `cached/assets/${key}/${presetName}/${JSON.stringify(preset)}`;
        const cachedObject = await env.R2.get(cachedKey);

        if (cachedObject != null) {
          const headers = new Headers();
          cachedObject.writeHttpMetadata(headers);
          headers.set("etag", cachedObject.httpEtag);
          headers.set("content-length", cachedObject.size.toString());

          return new Response(cachedObject.body, {
            headers,
          });
        } else {
          // cache miss
          const assetResponse = await env.ASSETS.fetch(new URL(assetPath, request.url));

          const encodedInput = encodeURIComponent(JSON.stringify(preset));

          const transformUrl = new URL(assetPath, request.url);
          transformUrl.searchParams.set("input", encodedInput);

          // Create a new request with the image data for the service binding
          const transformRequest = new Request(transformUrl, {
            method: "POST",
            body: assetResponse.body,
            headers: {
              "Content-Type": assetResponse.headers.get("Content-Type") || "image/png",
            },
          });

          const transformResponse = await env.BOA_IMG_TRANSFORMER.internalFetch(transformRequest);

          if (transformResponse.body == null || transformResponse.status !== 200) {
            console.error("Error transforming asset", transformResponse.status, transformResponse.statusText);
            return new Response("Error transforming asset", { status: 500 });
          }

          // upload to r2 in chunks since we can't use R2.put() with streams without knowing the content-length
          const putResponse = await uploadToR2InChunks(
            env.R2,
            cachedKey,
            transformResponse.body,
            transformResponse.headers,
          );

          const transformObject = await env.R2.get(cachedKey);

          if (transformObject == null) {
            return new Response("Object Not Found", { status: 404 });
          }

          const headers = new Headers();
          transformObject.writeHttpMetadata(headers);
          headers.set("etag", transformObject.httpEtag);
          headers.set("content-length", putResponse.size.toString());

          return new Response(transformObject.body, {
            headers,
          });
        }
      }
    }

    return new Response("Not found", {
      status: 404,
    });
  },
} satisfies ExportedHandler<Env>;
