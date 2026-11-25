export default function LoadingState({ message = 'Loading…' }) {
  return (
    <div className="text-center py-5" role="status" aria-live="polite">
      <div className="spinner-border text-success" aria-hidden />
      <p className="mt-3 text-muted mb-0">{message}</p>
    </div>
  );
}
