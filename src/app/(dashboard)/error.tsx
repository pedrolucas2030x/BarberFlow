"use client";

import { RefreshCw } from "lucide-react";

export default function DashboardError({ reset }: { reset: () => void }) {
  return (
    <div className="panel route-message" role="alert">
      <h1>Não foi possível carregar esta página</h1>
      <p>Tente carregar o conteúdo novamente.</p>
      <button type="button" className="primary-button" onClick={reset}>
        <RefreshCw size={16} aria-hidden="true" /> Tentar novamente
      </button>
    </div>
  );
}
