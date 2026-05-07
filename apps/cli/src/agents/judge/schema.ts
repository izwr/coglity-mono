import { z } from 'zod';

export const verdictSchema = z.object({
  outcome: z.enum(['pass', 'fail', 'inconclusive']),
  reasoning: z.string().min(1),
});

export type VerdictOutput = z.infer<typeof verdictSchema>;
