import z from "zod";

export const imageTransformSchema = z.object({
  width: z.number().optional(),
  height: z.number().optional(),
  fit: z.enum(["contain", "cover", "fill", "inside", "outside"]).optional(),
});

export const imageOutputSchema = z.object({
  format: z.enum(["image/webp", "image/jpeg", "image/png"]),
  quality: z.number().optional(),
});

export const inputSchema = z.object({
  transform: imageTransformSchema.optional(),
  output: imageOutputSchema.optional(),
});

export type ImageTransformInput = z.infer<typeof inputSchema>;