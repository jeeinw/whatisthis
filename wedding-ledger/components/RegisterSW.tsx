"use client";
import { useEffect } from "react";

/** 운영 환경에서만 서비스 워커 등록 (개발 중 캐시 혼동 방지). */
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return null;
}
