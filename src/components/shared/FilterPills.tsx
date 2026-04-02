// ── FilterPills — Grid de botones tipo pill (no select nativo)

interface FilterPillsProps<T extends string> {
  options: { value: T; label: string }[]
  value:   T
  onChange:(v: T) => void
}

export function FilterPills<T extends string>({
  options,
  value,
  onChange,
}: FilterPillsProps<T>) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
            value === o.value
              ? 'border-accent bg-accent/10 text-accent'
              : 'border-white/10 bg-surface2 text-muted'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
