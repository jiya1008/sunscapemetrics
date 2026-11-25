export default function ErrorMessage({ message, onRetry }) {
  return (
    <div className="alert alert-danger d-flex align-items-start gap-2" role="alert">
      <i className="bi bi-exclamation-triangle-fill mt-1" aria-hidden />
      <div className="flex-grow-1">
        <strong>Something went wrong</strong>
        <div>{message}</div>
        {onRetry && (
          <button type="button" className="btn btn-sm btn-outline-danger mt-2" onClick={onRetry}>
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
