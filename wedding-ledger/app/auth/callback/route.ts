import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * 매직링크 도착 지점.
 * - token_hash: 이메일 템플릿이 `/auth/callback?token_hash={{ .TokenHash }}&type=magiclink` 일 때.
 *   어느 브라우저·기기에서 열어도 된다 (권장).
 * - code: 기본 템플릿(PKCE). 링크를 요청한 같은 브라우저에서만 교환된다.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = (url.searchParams.get("type") ?? "magiclink") as EmailOtpType;
  // Supabase가 검증 단계에서 실패하면 error_code 를 붙여 보낸다 (예: otp_expired)
  const upstream = url.searchParams.get("error_code") || url.searchParams.get("error");

  // implicit 흐름 링크는 토큰을 URL 해시(#…)로 보낸다. 해시는 서버에 오지 않고 리다이렉트를 따라가므로
  // 쿼리가 비어 있으면 /login 으로 넘겨 거기서 세션을 만든다.
  if (!upstream && !code && !tokenHash) return NextResponse.redirect(new URL("/login", url.origin));

  let reason: string | null = upstream;
  if (!reason) {
    const supabase = await createClient();
    const { error } = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : tokenHash
        ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
        : { error: { message: "missing code", code: "missing_code" } };
    if (error) reason = ("code" in error && error.code) || error.message;
  }
  if (reason) {
    console.error(`[auth/callback] 로그인 실패: ${reason} (${code ? "pkce" : tokenHash ? "token_hash" : "none"})`);
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(reason)}`, url.origin));
  }
  return NextResponse.redirect(new URL("/", url.origin));
}
