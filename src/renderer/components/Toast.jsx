const ICONS = { success: 'check-circle', error: 'x-circle', info: 'info-circle' };

export default function Toast({ toasts }) {
  if (toasts.length === 0) return null;

  return (
    <div id="toast">
      {toasts.map(({ id, message, type }) => (
        <div key={id} className={`alert alert-${type} d-flex align-items-center`}>
          <i className={`bi bi-${ICONS[type] ?? 'info-circle'} me-2`} />
          <div>{message}</div>
        </div>
      ))}
    </div>
  );
}
