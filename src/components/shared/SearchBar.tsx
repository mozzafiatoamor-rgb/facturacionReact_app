// ── SearchBar reutilizable

interface SearchBarProps {
  value:       string
  onChange:    (v: string) => void
  placeholder?: string
}

export function SearchBar({ value, onChange, placeholder = 'Buscar...' }: SearchBarProps) {
  return (
    <div className="relative mb-3">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">🔍</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input pl-8 w-full"
        autoComplete="off"
      />
    </div>
  )
}
