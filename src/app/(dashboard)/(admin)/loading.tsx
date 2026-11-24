export default function AdminLoading() {
  return (
    <div role="status">
      <span className="sr-only">Carregando conteúdo</span>
      <div className="loading-title" aria-hidden="true" />
      <div className="panel loading-panel" aria-hidden="true" />
    </div>
  );
}
