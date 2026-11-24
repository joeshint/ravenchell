import { z } from 'zod';
import { optionalPhone } from './item.schema';

export const claimSchema = z.object({
  ownershipDescription: z
    .string()
    .trim()
    .min(20, 'Explain in at least 20 characters why this item is yours')
    .max(3000, 'Description is too long'),
  answers: z.array(z.string().trim().min(1, 'Please answer this question').max(1000, 'Answer is too long')),
  lostItemId: z.string().optional(),
  contactPhone: optionalPhone,
  confirm: z.literal(true, { error: 'Please confirm that this item belongs to you' }),
});
