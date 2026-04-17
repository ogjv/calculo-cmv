import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

const shouldUseSupabaseProxy = () => {
  if (typeof window === "undefined") {
    return false;
  }

  return !["localhost", "127.0.0.1"].includes(window.location.hostname);
};

const createSupabaseFetch = () => {
  const supabaseHost = supabaseUrl ? new URL(supabaseUrl as string).host : undefined;

  return async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!supabaseHost || !shouldUseSupabaseProxy()) {
      return fetch(input, init);
    }

    const request = new Request(input, init);
    const requestUrl = new URL(request.url);

    if (requestUrl.host !== supabaseHost) {
      return fetch(input, init);
    }

    const proxiedUrl = `/.netlify/functions/supabase-proxy?target=${encodeURIComponent(
      `${requestUrl.pathname}${requestUrl.search}`
    )}`;
    const shouldSendBody = request.method !== "GET" && request.method !== "HEAD";
    const requestBody =
      shouldSendBody && init?.body
        ? init.body
        : shouldSendBody && typeof input !== "string" && !(input instanceof URL)
          ? await input.clone().arrayBuffer()
          : undefined;

    return fetch(proxiedUrl, {
      method: request.method,
      headers: request.headers,
      body: requestBody,
      signal: request.signal
    });
  };
};

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string, {
      global: {
        fetch: createSupabaseFetch()
      },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;
