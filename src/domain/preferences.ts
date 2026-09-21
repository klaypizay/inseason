import { z } from "zod";
export const dateFormatSchema = z.enum([
  "MM/DD/YYYY",
  "DD/MM/YYYY",
  "YYYY-MM-DD",
]);
export type DateFormat = z.infer<typeof dateFormatSchema>;
export const timeFormatSchema = z.enum(["12-hour", "24-hour"]);
export type TimeFormat = z.infer<typeof timeFormatSchema>;
export const preferenceSchema = z.strictObject({
  displayName: z.string().trim().max(80),
  dateFormat: dateFormatSchema,
  timeFormat: timeFormatSchema,
  revision: z.number().int().nonnegative(),
});
export type Preferences = z.infer<typeof preferenceSchema>;
export const defaultPreferences: Preferences = {
  displayName: "",
  dateFormat: "MM/DD/YYYY",
  timeFormat: "12-hour",
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
export function formatTime(
  value: string | null | undefined,
  format: TimeFormat = "12-hour",
) {
  if (!value) return "";
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return value;
  if (format === "24-hour") return value;
  const hour = Number(value.slice(0, 2));
  return `${hour % 12 || 12}:${value.slice(3)} ${hour < 12 ? "AM" : "PM"}`;
}
export function formatTimeText(value: string, format: TimeFormat) {
  return value.replace(
    /\b(?:[01]\d|2[0-3]):[0-5]\d\b(?!:\d|\s*[ap]m\b)/gi,
    (time) => formatTime(time, format),
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
  wasAccepted: boolean;
  latestPlanStatus: string | null;
  isDemo: boolean;
  isExample: boolean;
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

export const moveLibrarySchema = z.strictObject({
  items: z
    .array(
      z.strictObject({ id: z.uuid(), revision: z.number().int().positive() }),
    )
    .min(1)
    .max(200)
    .refine(
      (items) => new Set(items.map((x) => x.id)).size === items.length,
      "Select each item only once.",
    ),
  folder: z
    .strictObject({ id: z.uuid(), revision: z.number().int().positive() })
    .nullable(),
});
export type LibrarySelection = z.infer<typeof moveLibrarySchema>["items"];
export function libraryStatus(item: LibraryItem) {
  if (item.status === "queued" || item.status === "running")
    return "Preparing draft";
  if (item.status === "failed") return "Draft unavailable";
  if (item.action === "assessSeason") return "Team assessment · suggestions";
  if (item.isCurrent)
    return item.latestPlanStatus === "draft"
      ? "Roadmap · changes to review"
      : "Roadmap · in use";
  if (item.latestPlanStatus === "draft") return "Roadmap · draft";
  if (item.wasAccepted) return "Roadmap · previously used";
  return "Roadmap · draft";
}

export const reorderLibrarySchema = z.strictObject({
  seasonId: z.uuid(),
  items: moveLibrarySchema.shape.items,
});

export const reorderFoldersSchema = z.strictObject({
  items: moveLibrarySchema.shape.items.refine(
    (items) => items.length <= 100,
    "Too many folders.",
  ),
});
