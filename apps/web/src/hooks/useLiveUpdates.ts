import { useEffect, useRef } from "react";

export function useLiveUpdates(callback: () => void) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  useEffect(() => {
    const timer = setInterval(() => callbackRef.current(), 12000);
    const controller = new AbortController();
    const token = localStorage.getItem("anama:token");
    const base = import.meta.env.VITE_API_URL ?? "http://localhost:3333/api/v1";
    if (token) {
      void (async () => {
        try {
          const response = await fetch(`${base}/updates/stream`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
          if (!response.ok || !response.body) return;
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          while (!controller.signal.aborted) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let split = buffer.indexOf("\n\n");
            while (split >= 0) {
              const packet = buffer.slice(0, split);
              buffer = buffer.slice(split + 2);
              if (packet.includes("event: change")) callbackRef.current();
              split = buffer.indexOf("\n\n");
            }
          }
        } catch { /* Polling periódico cobre desconexões. */ }
      })();
    }
    return () => { controller.abort(); clearInterval(timer); };
  }, []);
}
