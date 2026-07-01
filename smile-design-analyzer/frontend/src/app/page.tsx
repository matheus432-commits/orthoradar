/**
 * Tela 1 — Dashboard.
 * Lista de pacientes / historico de casos e botao "Novo Caso".
 */
"use client";
import Link from "next/link";

import { useCases } from "@/hooks/useCases";

export default function Dashboard() {
  const { cases, remove } = useCases();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-sm text-slate-500">
            Pacientes e historico de analises.
          </p>
        </div>
        <Link href="/cases/new" className="btn-primary">
          + Novo Caso
        </Link>
      </div>

      {cases.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 py-16 text-center">
          <span className="text-4xl">📋</span>
          <p className="text-slate-500">
            Nenhum caso ainda. Crie o primeiro para comecar a analise.
          </p>
          <Link href="/cases/new" className="btn-primary">
            Criar primeiro caso
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl ring-1 ring-slate-200">
          <table className="min-w-full divide-y divide-slate-200 bg-white text-sm">
            <thead className="bg-slate-100 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Paciente</th>
                <th className="px-4 py-3 font-medium">Sexo</th>
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 font-medium">Pontos</th>
                <th className="px-4 py-3 font-medium">Atualizado</th>
                <th className="px-4 py-3 font-medium">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cases.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {c.patient.name || "(sem nome)"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.patient.sex || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{c.patient.date || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{c.points.length}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(c.updatedAt).toLocaleString("pt-BR")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Link href={`/cases/${c.id}`} className="btn-secondary py-1">
                        Abrir
                      </Link>
                      <button
                        onClick={() => {
                          if (confirm("Excluir este caso?")) remove(c.id);
                        }}
                        className="btn-ghost py-1 text-red-600 hover:bg-red-50"
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
