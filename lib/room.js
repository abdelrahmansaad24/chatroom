/**
 * Normalizes a room identifier from any user, mobile browser, or client input.
 * Handles:
 * - Converting Eastern Arabic-Indic numerals (٠-٩) and Persian/Urdu numerals (۰-۹) to standard ASCII 0-9
 * - Converting Full-width digits (０-９) to standard ASCII 0-9
 * - Stripping invisible whitespace, control chars, zero-width characters (\u200B-\u200D, \uFEFF, \u200E, \u200F, \u00A0)
 * - Parsing to clean numeric string (or clean trimmed alphanumeric string)
 */
export function normalizeRoom(input) {
  if (input === null || input === undefined) return "";
  let str = String(input).trim();

  // Convert Eastern Arabic-Indic numerals (\u0660-\u0669) -> 0-9
  str = str.replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660));

  // Convert Persian/Urdu numerals (\u06F0-\u06F9) -> 0-9
  str = str.replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0));

  // Convert Fullwidth numerals (\uFF10-\uFF19) -> 0-9
  str = str.replace(/[\uFF10-\uFF19]/g, (d) => String(d.charCodeAt(0) - 0xff10));

  // Remove zero-width spaces, bidi markers, BOM, non-breaking spaces, control chars
  str = str.replace(/[\u200B-\u200D\uFEFF\u200E\u200F\u00A0\r\n\t]/g, "").trim();

  // If input contains digits, extract standard clean digits (e.g. "1234")
  const digits = str.replace(/[^0-9]/g, "");
  if (digits.length > 0) {
    return digits.slice(0, 10);
  }

  // Fallback for named rooms
  return str.slice(0, 20);
}
