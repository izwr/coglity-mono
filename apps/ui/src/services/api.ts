import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

/**
 * Single place that decides "session is dead, send the user to the login
 * page and preserve where they were so we can return them on success."
 * Guarded so concurrent 401s don't navigate multiple times.
 */
let redirecting = false;
export function redirectToLogin(): void {
  if (redirecting) return;
  if (window.location.pathname === "/login") return;
  redirecting = true;
  const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.href = `/login?returnTo=${returnTo}`;
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const reqUrl: string = error.config?.url ?? "";
    const isAuthCheck =
      reqUrl.includes("/auth/") ||
      reqUrl === "/users/me" ||
      reqUrl.startsWith("/users/me?");
    if (error.response?.status === 401 && !isAuthCheck) {
      redirectToLogin();
    }
    return Promise.reject(error);
  },
);
