import axios, { type AxiosRequestConfig } from "axios";

let accessToken: string | null = null;
let sessionTimeoutMinutes = 30;
let isRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export function setSessionTimeoutMinutes(minutes: number | null | undefined) {
  if (
    typeof minutes !== "number" ||
    !Number.isFinite(minutes) ||
    minutes <= 0
  ) {
    sessionTimeoutMinutes = 30;
    return;
  }
  sessionTimeoutMinutes = minutes;
}

export function getSessionTimeoutMinutes() {
  return sessionTimeoutMinutes;
}

const api = axios.create({
  baseURL: "/api/v1",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as AxiosRequestConfig & { _retry?: boolean };
    const status = error.response?.status;
    const code =
      error.response?.data?.code ?? error.response?.data?.detail?.code;

    if (status === 401 && !original._retry) {
      if (code === "SESSION_EXPIRED") {
        accessToken = null;
        localStorage.removeItem("refresh_token");
        window.dispatchEvent(new Event("session-expired"));
        return Promise.reject(error);
      }

      const refreshToken = localStorage.getItem("refresh_token");
      if (!refreshToken) return Promise.reject(error);

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push((token) => {
            if (!token) return reject(error);
            original._retry = true;
            original.headers = {
              ...original.headers,
              Authorization: `Bearer ${token}`,
            };
            resolve(api(original));
          });
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const resp = await axios.post("/api/v1/auth/refresh", {
          refresh_token: refreshToken,
        });
        const newToken: string = resp.data.access_token;
        const newRefresh: string = resp.data.refresh_token;
        const timeoutMinutes: number | undefined =
          resp.data.session_timeout_minutes;
        accessToken = newToken;
        setSessionTimeoutMinutes(timeoutMinutes);
        localStorage.setItem("refresh_token", newRefresh);
        refreshQueue.forEach((cb) => cb(newToken));
        refreshQueue = [];
        original.headers = {
          ...original.headers,
          Authorization: `Bearer ${newToken}`,
        };
        return api(original);
      } catch {
        accessToken = null;
        localStorage.removeItem("refresh_token");
        refreshQueue.forEach((cb) => cb(null));
        refreshQueue = [];
        window.dispatchEvent(new Event("session-expired"));
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default api;
