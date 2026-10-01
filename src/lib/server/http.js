// Utilidades compartidas por las rutas API (solo se usan en el servidor).

export const DEFAULT_TIMEOUT_MS = 10_000;
export const MAX_TEXT_LENGTH = 200;

/** Respuesta de error uniforme: { error } con el código HTTP indicado. */
export function jsonError(message, status) {
  return Response.json({ error: message }, { status });
}

/**
 * Lee un parámetro de texto de la query, lo recorta y valida su longitud.
 * Devuelve null si falta, está vacío o supera maxLength.
 */
export function readText(searchParams, name, maxLength = MAX_TEXT_LENGTH) {
  const value = (searchParams.get(name) || '').trim();
  if (!value || value.length > maxLength) return null;
  return value;
}

/** fetch con tiempo límite, para que un servicio externo lento no deje colgada la ruta. */
export function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
}
