const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Permit cross-origin browser requests only from the explicit allowlist. */
export function isOriginAllowed(origin: string | undefined, method: string, allowedOrigins: readonly string[], production: boolean): boolean {
  const normalizedMethod = method.toUpperCase();
  const unsafeMethod = !SAFE_METHODS.has(normalizedMethod);
  if (production && unsafeMethod && (!origin || !allowedOrigins.includes(origin))) return false;
  return !origin || allowedOrigins.includes(origin);
}
