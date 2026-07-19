"use client";

import { useState } from "react";
import { NuevaFacturaForm } from "@/components/nueva-factura-form";
import { NuevaFacturaEForm } from "@/components/nueva-factura-e-form";

type Tipo = "C" | "E";

export function FacturaTabs() {
  const [tipo, setTipo] = useState<Tipo>("C");

  return (
    <div>
      <div
        className="mb-5 flex rounded-lg border border-neutral-200 bg-neutral-100 p-0.5 text-sm dark:border-neutral-800 dark:bg-neutral-900"
        role="tablist"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tipo === "C"}
          onClick={() => setTipo("C")}
          className={`flex-1 rounded-md px-3 py-1.5 font-medium transition ${
            tipo === "C"
              ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-neutral-100"
              : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
          }`}
        >
          Local · C
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tipo === "E"}
          onClick={() => setTipo("E")}
          className={`flex-1 rounded-md px-3 py-1.5 font-medium transition ${
            tipo === "E"
              ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-neutral-100"
              : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
          }`}
        >
          Exportación · E
        </button>
      </div>

      {tipo === "C" ? <NuevaFacturaForm /> : <NuevaFacturaEForm />}
    </div>
  );
}
