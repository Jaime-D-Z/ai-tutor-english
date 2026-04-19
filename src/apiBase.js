const trimTrailingSlash = (value) => String(value || "").replace(/\/$/, "");

const isLocalHost = (host) => host === "localhost" || host === "127.0.0.1";

export const resolveApiBaseUrl = () => {
  const configured = trimTrailingSlash(import.meta.env.VITE_API_BASE_URL);
  if (configured) return configured;

  if (typeof window === "undefined") return "";

  const host = window.location.hostname;
  if (isLocalHost(host)) {
    return "http://localhost:3000";
  }

  return trimTrailingSlash(window.location.origin);
};

export const API_BASE_URL = resolveApiBaseUrl();

export const apiUrl = (path) => {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
};

const tryParseJson = (rawText) => {
  if (!rawText) return null;

  const trimmed = rawText.trim();
  if (!trimmed) return null;

  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
};

export const requestJson = async (path, options = {}) => {
  const response = await fetch(apiUrl(path), options);
  const rawText = await response.text();
  const data = tryParseJson(rawText);

  if (!response.ok) {
    const serverMessage = data?.error || data?.message;
    const fallbackMessage = rawText
      ? `Error ${response.status}: ${rawText.slice(0, 140)}`
      : `Error ${response.status} al llamar ${path}.`;
    throw new Error(serverMessage || fallbackMessage);
  }

  if (!data) {
    throw new Error(
      `Respuesta invalida del servidor en ${path}. Se esperaba JSON.`,
    );
  }

  return data;
};
