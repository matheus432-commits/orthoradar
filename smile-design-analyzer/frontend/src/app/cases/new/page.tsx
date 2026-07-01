/**
 * Tela 2 — Cadastro do paciente + upload da fotografia.
 */
"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { createCase } from "@/services/storage";
import type { Patient } from "@/types";

export default function NewCase() {
  const router = useRouter();
  const [patient, setPatient] = useState<Patient>({
    name: "",
    sex: "",
    date: new Date().toISOString().slice(0, 10),
    notes: "",
  });
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Selecione um arquivo de imagem.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImageDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  }

  function submit() {
    if (!imageDataUrl) {
      setError("Faca o upload da fotografia para continuar.");
      return;
    }
    const record = createCase(patient, imageDataUrl);
    router.push(`/cases/${record.id}`);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Novo Caso</h1>

      <div className="card grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Nome do paciente</label>
          <input
            className="input"
            value={patient.name}
            onChange={(e) => setPatient({ ...patient, name: e.target.value })}
            placeholder="Ex.: Maria Silva"
          />
        </div>
        <div>
          <label className="label">Sexo</label>
          <select
            className="input"
            value={patient.sex}
            onChange={(e) => setPatient({ ...patient, sex: e.target.value })}
          >
            <option value="">Selecione</option>
            <option value="Feminino">Feminino</option>
            <option value="Masculino">Masculino</option>
            <option value="Outro">Outro</option>
          </select>
        </div>
        <div>
          <label className="label">Data</label>
          <input
            type="date"
            className="input"
            value={patient.date}
            onChange={(e) => setPatient({ ...patient, date: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Observacoes</label>
          <textarea
            className="input h-24 resize-none"
            value={patient.notes}
            onChange={(e) => setPatient({ ...patient, notes: e.target.value })}
            placeholder="Queixa, historico, objetivos esteticos..."
          />
        </div>
      </div>

      <div className="card space-y-3">
        <label className="label">Fotografia (frontal do sorriso)</label>
        <input type="file" accept="image/*" onChange={onFile} />
        {imageDataUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageDataUrl}
            alt="Previa"
            className="max-h-72 rounded-lg ring-1 ring-slate-200"
          />
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-2">
        <button className="btn-secondary" onClick={() => router.push("/")}>
          Cancelar
        </button>
        <button className="btn-primary" onClick={submit}>
          Continuar para o editor
        </button>
      </div>
    </div>
  );
}
