export default function EmptyState({ title, message, action }) {
  return (
    <div className="text-center py-5 px-3">
      <i className="bi bi-inbox fs-1 text-muted" aria-hidden />
      <h5 className="mt-3">{title}</h5>
      <p className="text-muted">{message}</p>
      {action}
    </div>
  );
}
