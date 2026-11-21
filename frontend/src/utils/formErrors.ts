import { ApiError } from '../api/client'

// One place for turning an API error into text, so every page shows problems the same way.

// The API sends field names like "FirstName", "Doctor.LicenseNumber" (or "$.firstName" for JSON errors);
// our forms use "firstName" and "doctor.licenseNumber". Keep the first message for each field.
export function errorsByField(fieldErrors: Record<string, string[]>) {
  const result: Record<string, string> = {}
  for (const [key, messages] of Object.entries(fieldErrors)) {
    const field = key
      .replace(/^\$\./, '')
      .split('.')
      .map((part) => part.charAt(0).toLowerCase() + part.slice(1))
      .join('.')
    result[field] = messages[0]
  }
  return result
}

// Every message the API sent (field problems first), or the fallback when the request failed
// without an answer from the API (for example, no network).
export function allErrors(err: unknown, fallback: string): string[] {
  if (!(err instanceof ApiError)) return [fallback]
  const messages = Object.values(err.fieldErrors).flat()
  return messages.length > 0 ? messages : [err.message]
}

// The first message only, for a short line next to a button.
export function firstError(err: unknown, fallback: string): string {
  return allErrors(err, fallback)[0]
}
