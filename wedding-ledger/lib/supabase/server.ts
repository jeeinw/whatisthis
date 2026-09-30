import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/** 서버 컴포넌트·라우트용 클라이언트 (요청자의 세션으로 RLS 적용). 서비스 키는 쓰지 않는다. */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // 서버 컴포넌트에서는 쿠키를 쓸 수 없다 — 세션 갱신은 proxy(P1)가 맡는다.
        }
      },
    },
  });
}
