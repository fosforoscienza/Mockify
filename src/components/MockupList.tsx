import { CATEGORIES, MOCKUPS } from '../three/models'
import { MockupIcon } from './Icons'

interface Props {
  active: string
  onSelect(id: string): void
}

export default function MockupList({ active, onSelect }: Props) {
  return (
    <aside className="sidebar">
      {CATEGORIES.map((cat) => {
        const items = MOCKUPS.filter((m) => m.category === cat.id)
        if (!items.length) return null
        return (
          <div key={cat.id}>
            <h2>{cat.label}</h2>
            {items.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`model-btn ${m.id === active ? 'active' : ''}`}
                onClick={() => onSelect(m.id)}
                aria-pressed={m.id === active}
              >
                <span className="ico" aria-hidden>
                  <MockupIcon name={m.icon} size={22} />
                </span>
                <span>
                  <strong>{m.name}</strong>
                  <span>{m.tagline}</span>
                </span>
              </button>
            ))}
          </div>
        )
      })}
    </aside>
  )
}
