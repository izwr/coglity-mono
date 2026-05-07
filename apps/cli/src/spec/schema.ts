import { z } from 'zod';

export const viewportSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export const frontmatterSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  viewport: viewportSchema.default({ width: 1280, height: 720 }),
  auth: z.string().optional(),
  timeout: z.number().int().positive().default(30000),
});

export type Frontmatter = z.infer<typeof frontmatterSchema>;
