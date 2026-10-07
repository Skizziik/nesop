"use client";

import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "sonner";

/** Подписка на SSE /api/events: любое событие пайплайна инвалидирует кеш списков → UI обновляется сразу. */
function LiveEvents() {
  const qc = useQueryClient();
  useEffect(() => {
    let es: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let pending = false;
    const flush = () => {
      pending = false;
      void qc.invalidateQueries({ queryKey: ["batches"] });
      void qc.invalidateQueries({ queryKey: ["videos"] });
      void qc.invalidateQueries({ queryKey: ["stats"] });
    };
    const connect = () => {
      es = new EventSource("/api/events");
      es.onmessage = () => {
        if (!pending) {
          pending = true;
          timer = setTimeout(flush, 400); // события идут пачками — схлопываем
        }
      };
      es.onerror = () => {
        es?.close();
        timer = setTimeout(connect, 3000);
      };
    };
    connect();
    return () => {
      es?.close();
      if (timer) clearTimeout(timer);
    };
  }, [qc]);
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 2000, refetchOnWindowFocus: true, retry: 1 } } }));
  return (
    <QueryClientProvider client={qc}>
      <LiveEvents />
      {children}
      <Toaster theme="dark" position="bottom-right" richColors closeButton />
    </QueryClientProvider>
  );
}
