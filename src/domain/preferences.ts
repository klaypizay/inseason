import { z } from "zod";
export const dateFormatSchema = z.enum([
  "MM/DD/YYYY",
  "DD/MM/YYYY",
  "YYYY-MM-DD",
]);
export type DateFormat = z.infer<typeof dateFormatSchema>;
export const preferenceSchema = z.strictObject({
  displayName: z.string().trim().max(80),
  dateFormat: dateFormatSchema,
  revision: z.number().int().nonnegative(),
});
export type Preferences = z.infer<typeof preferenceSchema>;
export const defaultPreferences: Preferences = {
  displayName: "",
  dateFormat: "MM/DD/YYYY",
  revision: 0,
};
export function formatDate(
  value: string | null | undefined,
  format: DateFormat = "MM/DD/YYYY",
) {
  if (!value) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  const [, year, month, day] = match;
  return format === "DD/MM/YYYY"
    ? `${day}/${month}/${year}`
    : format === "YYYY-MM-DD"
      ? `${year}-${month}-${day}`
      : `${month}/${day}/${year}`;
}
export function formatDateText(value: string, format: DateFormat) {
  return value.replace(/\b\d{4}-\d{2}-\d{2}\b/g, (date) =>
    formatDate(date, format),
  );
}
export const libraryEditSchema = z.strictObject({
  name: z.string().trim().min(1).max(100),
  folder: z.string().trim().max(60),
  state: z.enum(["active", "archived", "trash"]),
  revision: z.number().int().positive(),
});
export type LibraryEdit = z.infer<typeof libraryEditSchema>;
export type LibraryItem = LibraryEdit & {
  id: string;
  action: string;
  status: string;
  created: string;
  planId: string | null;
  isCurrent: boolean;
};

export type LibraryFolder = { id: string; name: string; revision: number };
export const folderMutationSchema = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("create"),
    name: z.string().trim().min(1).max(60),
  }),
  z.strictObject({
    action: z.literal("rename"),
    id: z.uuid(),
    revision: z.number().int().positive(),
    name: z.string().trim().min(1).max(60),
  }),
  z.strictObject({
    action: z.literal("delete"),
    id: z.uuid(),
    revision: z.number().int().positive(),
  }),
]);
