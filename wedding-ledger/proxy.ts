import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// /api/backup 은 로그인 대신 CRON_SECRET 으로 스스로 확인한다
const PUBLIC_PATHS = ["/login", "/auth/", "/api/backup"];

/** 세션 쿠키 갱신 + 비로그인 사용자는 /login 으로. 데이터 접근 권한 자체는 DB의 RLS가 판단한다. */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // The Supabase integration can be connected after the first deployment.
  // Do not crash every route while those variables are still unavailable.
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  if (!data.user && !PUBLIC_PATHS.some((p) => path.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  // 정적 파일·PWA 파일(manifest, sw, 오프라인 화면, 아이콘)은 로그인 없이도 받아져야 한다
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline.html|icons/|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
