const DEFAULT_API_ORIGIN =
  import.meta.env.VITE_API_ORIGIN || "http://127.0.0.1:8787";

function resolveApiUrl(input: RequestInfo | URL): string | null {
  const request = input instanceof Request ? input : new Request(input);
  const url = new URL(request.url, window.location.href);

  if (url.pathname.startsWith("/v1/")) {
    return `${DEFAULT_API_ORIGIN}${url.pathname}${url.search}`;
  }

  return null;
}

export function installDesktopFetchShim() {
  if (typeof window === "undefined") return;
  if (
    (window as unknown as { __dudeDesktopFetchShim?: boolean })
      .__dudeDesktopFetchShim
  ) {
    return;
  }
  (
    window as unknown as { __dudeDesktopFetchShim?: boolean }
  ).__dudeDesktopFetchShim = true;

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const target = resolveApiUrl(input);
    if (!target) return nativeFetch(input, init);

    const request = input instanceof Request ? input : new Request(input, init);
    return nativeFetch(target, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      credentials: request.credentials,
      mode: "cors",
      redirect: request.redirect,
      signal: request.signal,
    });
  };
}
