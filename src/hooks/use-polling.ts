"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface PollingState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Fetch a JSON endpoint on mount and then poll it on an interval — the basis
 * for the dashboard's "live refresh every few seconds" requirement.
 */
export function usePolling<T>(
  url: string,
  intervalMs: number,
  options?: { enabled?: boolean },
): PollingState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const enabled = options?.enabled ?? true;
  const mounted = useRef(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        const message =
          res.status === 401
            ? "Your session expired — please sign in again."
            : `Request failed (${res.status})`;
        throw new Error(message);
      }
      const jsonData = (await res.json()) as T;
      if (mounted.current) {
        setData(jsonData);
        setError(null);
      }
    } catch (err) {
      if (mounted.current) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    mounted.current = true;
    if (!enabled) return;
    void fetchData();
    const timer = setInterval(() => void fetchData(), intervalMs);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, [fetchData, intervalMs, enabled]);

  return { data, error, loading, refresh: fetchData };
}
