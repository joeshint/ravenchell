import { z } from 'zod';
import { manilaToday } from '@/utils/format';

const PH_MOBILE = /^(\+?63|0)9\d{9}$/;

export const optionalPhone = z
  .string()
  .trim()
  .refine((v) => v === '' || PH_MOBILE.test(v.replace(/[\s-]/g, '')), {
    message: 'Enter a valid PH mobile number, e.g. 09171234567',
  });

const optionalEmail = z
  .string()
  .trim()
  .refine((v) => v === '' || z.email().safeParse(v).success, { message: 'Enter a valid email address' });

const text = (max, label) => z.string().trim().max(max, `${label} must be at most ${max} characters`);

const baseFields = {
  itemName: z.string().trim().min(2, 'Enter the item name').max(120, 'Item name is too long'),
  categoryId: z.string().min(1, 'Select a category'),
  description: z
    .string()
    .trim()
    .min(10, 'Describe the item in at least 10 characters')
    .max(2000, 'Description is too long'),
  date: z
    .string()
    .min(1, 'Select the date')
    .refine((v) => v <= manilaToday(), { message: 'The date cannot be in the future' }),
  time: z.string().optional(),
  campusId: z.string().min(1, 'Select a campus'),
  locationId: z.string().optional(),
  locationDetails: text(300, 'Location details'),
  identifyingDetails: text(2000, 'Identifying details'),
};

export const lostItemSchema = z.object({
  ...baseFields,
  contactName: text(120, 'Contact name'),
  contactPhone: optionalPhone,
  contactEmail: optionalEmail,
});

export const foundItemSchema = z.object({
  ...baseFields,
  custodyLocationId: z.string().min(1, 'Select where the item is kept now'),
  additionalInfo: text(2000, 'Additional information'),
  custodyNotes: text(500, 'Custody notes'),
});

export const itemSchemas = { lost: lostItemSchema, found: foundItemSchema };

/** Empty form values, optionally pre-filled from an existing report. */
export function itemFormDefaults(type, { item, privateDetails, profile } = {}) {
  const base = {
    itemName: item?.item_name ?? '',
    categoryId: item?.category_id ?? '',
    description: item?.description ?? '',
    date: (type === 'lost' ? item?.date_lost : item?.date_found) ?? '',
    time: ((type === 'lost' ? item?.time_lost : item?.time_found) ?? '').slice(0, 5),
    campusId: item?.campus_id ?? '',
    locationId: item?.location_id ?? '',
    locationDetails: item?.location_details ?? '',
    identifyingDetails: privateDetails?.identifying_details ?? '',
  };
  if (type === 'lost') {
    return {
      ...base,
      contactName: privateDetails?.contact_name ?? profile?.full_name ?? '',
      contactPhone: privateDetails?.contact_phone ?? profile?.phone ?? '',
      contactEmail: privateDetails?.contact_email ?? profile?.institutional_email ?? '',
    };
  }
  return {
    ...base,
    custodyLocationId: item?.custody_location_id ?? '',
    additionalInfo: privateDetails?.additional_info ?? '',
    custodyNotes: privateDetails?.custody_notes ?? '',
  };
}
