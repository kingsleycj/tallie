import { z } from "zod";

// Helper for HH:mm validation
const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

export const restaurantSchema = z.object({
  name: z.string().min(1, "Name is required"),
  openingTime: z.string().regex(timeRegex, "Must be HH:mm format"),
  closingTime: z.string().regex(timeRegex, "Must be HH:mm format"),
  totalTables: z.number().int().positive().default(10),
});

export const tableSchema = z.object({
  restaurantId: z.string().optional(), // Usually comes from URL params or body
  tableNumber: z.number().int().positive(),
  capacity: z.number().int().positive(),
});

export const reservationSchema = z.object({
  restaurantId: z.string().optional(),
  tableId: z.string().optional(), // Might be assigned by system
  customerName: z.string().min(1, "Name is required"),
  phone: z.string().min(10, "Phone validation needed"),
  partySize: z.number().int().positive(),
  dateTime: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid date format",
  }),
  duration: z.number().int().positive().max(180, "Max duration is 3 hours"), // Safety cap
});
