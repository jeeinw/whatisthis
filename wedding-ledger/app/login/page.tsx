"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/client";

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

function LinkError() {
  const err = useSearchParams().get("error");
  return err ? <p className="note small">{linkErrorText(err)}</p> : null;
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
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
        <LinkError />
      </Suspense>
      {state === "sent" ? (
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
