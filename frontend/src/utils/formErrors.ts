// The API sends field names like "FirstName" (or "$.firstName" for JSON errors);
// our forms use "firstName". Keep the first message for each field.
export function errorsByField(fieldErrors: Record<string, string[]>) {
  const result: Record<string, string> = {}
  for (const [key, messages] of Object.entries(fieldErrors)) {
    const field = key.replace(/^\$\./, '')
    result[field.charAt(0).toLowerCase() + field.slice(1)] = messages[0]
  }
  return result
}
