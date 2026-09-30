"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

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
