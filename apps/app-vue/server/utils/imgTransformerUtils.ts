import { z } from "zod";

type ImgTransformerPreset = { transform?: ImageTransform; output: ImageOutputOptions };

const presetKeys = ["webp", "thumb60", "thumb160", "thumb400", "2k"] as const;

export const imagePresets: Record<typeof presetKeys[number], ImgTransformerPreset> = {
  webp: { output: { format: "image/webp" } },
  thumb60: { output: { format: "image/webp" }, transform: { width: 60, height: 60, fit: "contain" } },
  thumb160: { output: { format: "image/webp" }, transform: { width: 160, height: 160, fit: "contain" } },
  thumb400: { output: { format: "image/webp" }, transform: { width: 400, height: 400, fit: "contain" } },
  "2k": { output: { format: "image/webp" }, transform: { width: 2000, height: 2000, fit: "contain" } },
} as const;

export type ImgTransformerPresets = keyof typeof imagePresets;

export const imgTransformerQuerySchema = z
  .object({
    p: z.enum(presetKeys),
  })
  .required();
export type ImgTransformerQuery = z.infer<typeof imgTransformerQuerySchema>;

export async function getPresetFromUrl(url: URL) {
  const queryObj = Object.fromEntries(url.searchParams.entries());

  let query: ImgTransformerQuery | null = null;
  const queryKeys = Object.keys(queryObj);
  if (queryKeys.includes("p")) {
    try {
      query = await imgTransformerQuerySchema.parse(queryObj);
    } catch (error) {
      console.error("Error Validating Input", error);
      throw new Error("Error Validating Input");
    }
  }
  const presetName = query?.p;
  const preset = presetName && imagePresets[presetName];

  return { preset, presetName };
}

// Replace the current R2.put logic with this multipart upload function
export async function uploadToR2InChunks(
  bucket: R2Bucket,
  key: string,
  responseStream: ReadableStream,
  httpMetadata: Headers
): Promise<R2Object> {
  // Create multipart upload
  const multipartUpload = await bucket.createMultipartUpload(key, {
    httpMetadata,
  });

  const reader = responseStream.getReader();
  const uploadedParts: R2UploadedPart[] = [];
  let partNumber = 1;
  const chunks: Uint8Array[] = [];
  let totalSize = 0;
  const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB minimum part size for R2

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        // Upload any remaining data as the final part
        if (chunks.length > 0) {
          const finalPart = new Uint8Array(totalSize);
          let offset = 0;
          for (const chunk of chunks) {
            finalPart.set(chunk, offset);
            offset += chunk.length;
          }

          const uploadedPart = await multipartUpload.uploadPart(partNumber, finalPart);
          uploadedParts.push(uploadedPart);
        }
        break;
      }

      chunks.push(value);
      totalSize += value.length;

      // When we have enough data for a part, upload it
      if (totalSize >= CHUNK_SIZE) {
        const partData = new Uint8Array(totalSize);
        let offset = 0;
        for (const chunk of chunks) {
          partData.set(chunk, offset);
          offset += chunk.length;
        }

        const uploadedPart = await multipartUpload.uploadPart(partNumber, partData);
        uploadedParts.push(uploadedPart);

        // Reset for next part
        chunks.length = 0;
        totalSize = 0;
        partNumber++;
      }
    }

    // Complete the multipart upload
    return await multipartUpload.complete(uploadedParts);
  } catch (error) {
    // Abort the multipart upload on error
    await multipartUpload.abort();
    throw error;
  }
}