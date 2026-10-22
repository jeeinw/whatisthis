"use client";
import { createBrowserClient } from "@supabase/ssr";

/** 작은 JSON 요청은 keepalive로 보내서 탭·앱을 닫는 순간에도 저장이 끝까지 가게 한다 (사진 업로드 같은 큰 본문은 제외 — 브라우저 제한 64KB). */
const keepaliveFetch: typeof fetch = (input, init) =>
  fetch(input, typeof init?.body === "string" && init.body.length < 32_000 && init.method && init.method !== "GET" ? { ...init, keepalive: true } : init);

/** 브라우저용 클라이언트 (anon 키 + 로그인 세션, RLS 적용). */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Keep static prerendering safe when project variables are not available yet.
  return createBrowserClient(url || "https://placeholder.supabase.co", key || "placeholder-anon-key", { global: { fetch: keepaliveFetch } });
}
