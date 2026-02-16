export function firstSearchParam(value) {
  if (Array.isArray(value)) return value[0];
  return typeof value === "string" ? value : undefined;
}

export function parsePositiveIntParam(value, fallback) {
  const raw = firstSearchParam(value);
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export function isUnauthorizedAdminError(error) {
  return hasStatusCode(error, 401);
}

export function isNotFoundAdminError(error) {
  return hasStatusCode(error, 404);
}

function hasStatusCode(error, statusCode) {
  if (!(error instanceof Error)) return false;
  return new RegExp(`\\b${statusCode}\\b`).test(error.message);
}
