import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/** 매직링크 도착 지점: PKCE code 또는 token_hash 를 세션으로 교환. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = (url.searchParams.get("type") ?? "magiclink") as EmailOtpType;
  const supabase = await createClient();

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error("missing code") };

  return NextResponse.redirect(new URL(error ? "/login?error=link" : "/", url.origin));
}
