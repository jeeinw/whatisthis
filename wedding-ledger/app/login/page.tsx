"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient as createOtpClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

/**
 * 로그인 링크 요청은 implicit 흐름으로 보낸다.
 * PKCE(기본값)는 링크를 요청한 브라우저에서만 열려서 Gmail 앱 내장 브라우저·다른 기기에서 실패한다.
 * implicit 흐름은 기본 이메일 템플릿 그대로 링크가 `…#access_token=…&refresh_token=…` 로 돌아오고,
 * 이 페이지가 그 토큰으로 세션(쿠키)을 만든다. 어느 브라우저에서 열어도 된다.
 */
function otpClient() {
  return createOtpClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key", {
    auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/** URL 해시(#access_token=…)로 돌아온 로그인 링크 처리. */
function useHashSession(onError: (code: string) => void) {
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const h = new URLSearchParams(window.location.hash.slice(1));
    if (!h.has("access_token") && !h.has("error_code")) return;
    history.replaceState(null, "", window.location.pathname); // 토큰을 주소창·기록에서 지운다
    void (async () => {
      await Promise.resolve();
      const err = h.get("error_code");
      if (err) return onError(err);
      setBusy(true);
      const { error } = await createClient().auth.setSession({ access_token: h.get("access_token")!, refresh_token: h.get("refresh_token") || "" });
      if (error) {
        onError(error.code || error.message);
        setBusy(false);
      } else window.location.replace("/");
    })();
  }, [onError]);
  return busy;
}

const LINK_ERRORS: Record<string, string> = {
  otp_expired: "로그인 링크가 만료됐거나 이미 사용됐어요. 새 링크를 받아 주세요.",
  bad_code_verifier: "링크를 요청한 브라우저와 다른 곳에서 열었어요. 이 화면에서 다시 요청한 뒤, 같은 브라우저로 링크를 열어 주세요.",
  flow_state_not_found: "링크를 요청한 브라우저와 다른 곳에서 열었어요. 이 화면에서 다시 요청한 뒤, 같은 브라우저로 링크를 열어 주세요.",
};

function linkErrorText(code: string) {
  if (LINK_ERRORS[code]) return LINK_ERRORS[code];
  if (/code verifier|flow state|pkce/i.test(code)) return LINK_ERRORS.bad_code_verifier;
  return `로그인하지 못했어요 (${code}). 새 링크를 받아 주세요.`;
}

function LinkError({ hashError }: { hashError: string | null }) {
  const queryError = useSearchParams().get("error");
  const err = hashError || queryError;
  return err ? <p className="note small">{linkErrorText(err)}</p> : null;
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [msg, setMsg] = useState("");
  const [hashError, setHashError] = useState<string | null>(null);
  const signingIn = useHashSession(setHashError);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const { error } = await otpClient().auth.signInWithOtp({
      email: email.trim(),
      // 새 계정은 만들지 않는다 — Supabase에 미리 등록한 두 사람만
      options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setState("error");
      setMsg(/signups not allowed|not found/i.test(error.message) ? "등록된 이메일이 아니에요." : `보내지 못했어요 (${error.message})`);
    } else setState("sent");
  }

  return (
    <div className="login">
      <div className="initials" aria-label="J와 D">
        J<span className="amp">&amp;</span>D
      </div>
      <div className="sub">결혼 준비 장부</div>
      <Suspense>
        <LinkError hashError={hashError} />
      </Suspense>
      {signingIn ? (
        <p className="note">로그인하는 중…</p>
      ) : state === "sent" ? (
        <p className="note">{email} 로 로그인 링크를 보냈어요. 메일에서 링크를 눌러 주세요.</p>
      ) : (
        <form onSubmit={submit}>
          <input type="email" required autoComplete="email" placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="이메일" />
          <button className="btn primary" disabled={state === "sending"}>
            {state === "sending" ? "보내는 중…" : "로그인 링크 받기"}
          </button>
          {state === "error" && <p className="no small">{msg}</p>}
        </form>
      )}
    </div>
  );
}
