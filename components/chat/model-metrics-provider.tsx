"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";
import type { ModelMetricsPayload } from "@/lib/types";

type ModelMetricsContextValue = {
  lastMetrics: ModelMetricsPayload | null;
  setLastMetrics: (value: ModelMetricsPayload | null) => void;
};

const ModelMetricsContext = createContext<ModelMetricsContextValue | null>(
  null
);

export function ModelMetricsProvider({ children }: { children: ReactNode }) {
  const [lastMetrics, setLastMetrics] = useState<ModelMetricsPayload | null>(
    null
  );

  const value = useMemo(() => ({ lastMetrics, setLastMetrics }), [lastMetrics]);

  return (
    <ModelMetricsContext.Provider value={value}>
      {children}
    </ModelMetricsContext.Provider>
  );
}

export function useModelMetrics() {
  const ctx = useContext(ModelMetricsContext);
  if (!ctx) {
    throw new Error("useModelMetrics must be used within ModelMetricsProvider");
  }
  return ctx;
}
