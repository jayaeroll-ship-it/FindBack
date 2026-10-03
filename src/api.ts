let csrf = "";
export const setCsrf = (value: string) => {
  csrf = value;
};
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  if (csrf) headers.set("X-CSRF-Token", csrf);
  const response = await fetch(
    (import.meta.env.VITE_API_BASE || "/api") + path,
    { ...options, headers, credentials: "same-origin" },
  );
  if (!response.ok) {
    const result = await response
      .json()
      .catch(() => ({
        detail: "The service is unavailable. Please try again.",
      }));
    const detail = Array.isArray(result.detail)
      ? result.detail
          .map(
            (e: { loc?: string[]; msg: string }) =>
              `${e.loc?.filter((x) => x !== "body").join(" ") || "Form"}: ${e.msg}`,
          )
          .join(". ")
      : result.detail;
    throw new Error(detail || "Something went wrong. Try again.");
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
export const json = (method: string, body: unknown): RequestInit => ({
  method,
  body: JSON.stringify(body),
});
