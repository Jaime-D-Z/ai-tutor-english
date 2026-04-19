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
