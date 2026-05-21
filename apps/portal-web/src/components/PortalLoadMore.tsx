type PortalLoadMoreProps = {
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
  loadedCount: number;
};

/** Botão “Carregar mais” para listagens portal com cursor (`next_cursor`). */
export function PortalLoadMore({ hasMore, loading, onLoadMore, loadedCount }: PortalLoadMoreProps): JSX.Element | null {
  if (!hasMore && loadedCount === 0) {
    return null;
  }
  return (
    <div className="portal-load-more">
      <p className="muted small" style={{ margin: 0 }}>
        {loadedCount} registo{loadedCount === 1 ? "" : "s"} carregado{loadedCount === 1 ? "" : "s"}
        {hasMore ? " — há mais resultados" : ""}
      </p>
      {hasMore ? (
        <button type="button" className="btn-secondary" onClick={onLoadMore} disabled={loading}>
          {loading ? "A carregar…" : "Carregar mais"}
        </button>
      ) : null}
    </div>
  );
}
