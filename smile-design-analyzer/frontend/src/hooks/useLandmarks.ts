/**
 * hooks/useLandmarks.ts
 * Carrega o banco de pontos uma vez e o disponibiliza indexado.
 */
"use client";
import { useEffect, useMemo, useState } from "react";

import { fetchLandmarks } from "@/services/api";
import type { LandmarkDatabase, LandmarkDef } from "@/types";

export function useLandmarks() {
  const [db, setDb] = useState<LandmarkDatabase | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLandmarks()
      .then(setDb)
      .catch((e) => setError(String(e)));
  }, []);

  const index = useMemo(() => {
    const map: Record<string, LandmarkDef> = {};
    db?.landmarks.forEach((lm) => (map[lm.id] = lm));
    return map;
  }, [db]);

  return { db, index, error, loading: !db && !error };
}
