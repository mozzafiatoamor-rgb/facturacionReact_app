// ── StatBox — Card de métrica / estadística

interface StatBoxProps {
  label:     string
  value:     string | number
  icon?:     string
  highlight?: boolean
}

export function StatBox({ label, value, icon, highlight }: StatBoxProps) {
  return (
    <div
      className={`rounded-xl p-4 border flex flex-col gap-1 ${
        highlight
          ? 'bg-accent/10 border-accent/30'
          : 'bg-surface2 border-white/10'
      }`}
    >
      {icon && <span className="text-xl">{icon}</span>}
      <p className="text-xs text-muted font-medium">{label}</p>
      <p className={`text-lg font-bold ${highlight ? 'text-accent' : 'text-white'}`}>
        {value}
      </p>
    </div>
  )
}
