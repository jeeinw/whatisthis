// J & D 장부 서비스 워커 — 홈 화면 앱용 최소 구성.
// 데이터(Supabase)·API·로그인은 절대 캐시하지 않는다. 화면 이동이 네트워크 오류로 실패할 때만 오프라인 안내를 보여준다.
const CACHE = "wl-offline-v1";
const OFFLINE = "/offline.html";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([OFFLINE, "/icons/icon-192.png"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.mode !== "navigate") return; // 페이지 이동만 다룬다
  e.respondWith(fetch(e.request).catch(() => caches.match(OFFLINE)));
});
