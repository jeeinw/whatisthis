"use client";
import { createBrowserClient } from "@supabase/ssr";

/** 브라우저용 클라이언트 (anon 키 + 로그인 세션, RLS 적용). */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Keep static prerendering safe when project variables are not available yet.
  return createBrowserClient(url || "https://placeholder.supabase.co", key || "placeholder-anon-key");
}
