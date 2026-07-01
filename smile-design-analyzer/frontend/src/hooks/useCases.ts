/**
 * hooks/useCases.ts
 * Lista reativa de casos clinicos persistidos localmente.
 */
"use client";
import { useCallback, useEffect, useState } from "react";

import { deleteCase, listCases } from "@/services/storage";
import type { CaseRecord } from "@/types";

export function useCases() {
  const [cases, setCases] = useState<CaseRecord[]>([]);

  const refresh = useCallback(() => setCases(listCases()), []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const remove = useCallback(
    (id: string) => {
      deleteCase(id);
      refresh();
    },
    [refresh],
  );

  return { cases, refresh, remove };
}
