import Link from "next/link";

export default function NotFound() {
  return (
    <main className="dashboard-content">
      <div className="panel route-message">
        <h1>Página não encontrada</h1>
        <p>Confira o endereço ou volte à página inicial.</p>
        <Link href="/" className="primary-button">Voltar ao início</Link>
      </div>
    </main>
  );
}
