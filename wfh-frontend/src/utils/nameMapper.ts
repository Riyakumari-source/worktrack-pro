// src/utils/nameMapper.ts
/**
 * Formats and returns the employee name.
 * Uses the authentic, distinct name directly from the database, preventing any duplicate name overrides.
 */
export function mapName(original: string): string {
  if (!original) return "";
  return original.trim();
}
