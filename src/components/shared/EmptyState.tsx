// ── EmptyState — Estado vacío reutilizable

interface EmptyStateProps {
  icon?:    string
  title:    string
  message?: string
  action?:  React.ReactNode
}

export function EmptyState({ icon = '📭', title, message, action }: EmptyStateProps) {
  return (
    <div className="text-center py-12 px-4">
      <div className="text-4xl mb-3">{icon}</div>
      <p className="font-semibold text-white mb-1">{title}</p>
      {message && <p className="text-sm text-muted mb-4">{message}</p>}
      {action}
    </div>
  )
}
