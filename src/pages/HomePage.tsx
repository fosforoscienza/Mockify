import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { MockupDefinition } from '../three/models/types'
import {
  CheckIcon,
  CursorIcon,
  DownloadIcon,
  LayersIcon,
  MockupIcon,
  SparkIcon,
  UploadIcon,
  WarningIcon,
} from '../components/Icons'

const STEPS = [
  {
    title: 'Scegli il mockup',
    text: 'Nella colonna di sinistra trovi magliette, felpe, cappelli, fogli, poster, brochure e libri. Ogni modello ha più varianti e colori.',
  },
  {
    title: 'Carica la grafica',
    text: 'Trascina un file PNG o JPG nell’area di lavoro, oppure selezionalo dal computer. Ogni area di stampa ha il suo file.',
  },
  {
    title: 'Adatta e ruota',
    text: 'Sposta la grafica trascinandola sul mockup e regola dimensione e rotazione. Sui mockup 3D ruoti anche la scena con il mouse.',
  },
  {
    title: 'Scarica',
    text: 'Esporta l’inquadratura scelta in PNG o PDF, con lo sfondo o senza, fino a 4096 px sul lato lungo.',
  },
]

const FEATURES = [
  {
    icon: <LayersIcon size={20} />,
    title: 'Sfondo a scelta',
    text: 'Esporti con fondo trasparente oppure del colore che preferisci, scelto anche con il contagocce.',
  },
  {
    icon: <CursorIcon size={20} />,
    title: 'Basi fotografiche',
    text: 'Capi, cappelli, telefoni e manifesti sono fotografie vere: la stampa prende le pieghe del tessuto e le ombre della scena. Gli altri mockup si ruotano in 3D.',
  },
  {
    icon: <UploadIcon size={20} />,
    title: 'Fronte e retro',
    text: 'Fogli, brochure e capi accettano due grafiche diverse sulle due facciate.',
  },
  {
    icon: <DownloadIcon size={20} />,
    title: 'PNG e PDF',
    text: 'Esportazione immediata nel browser: nessun caricamento su server, i file restano sul tuo computer.',
  },
]

const FAQ = [
  {
    q: 'Serve registrarsi?',
    a: 'No. Sagoma funziona interamente nel browser: le immagini non vengono caricate da nessuna parte.',
  },
  {
    q: 'Posso scegliere il colore del capo?',
    a: 'Sì: ogni capo ha campioni rapidi, un selettore colore completo e il contagocce per prelevare una tinta dallo schermo. Pieghe e ombre si adattano da sole.',
  },
  {
    q: 'Che file posso usare?',
    a: 'PNG, JPG e WebP fino a 30 MB. Per stampe su capi conviene un PNG con sfondo trasparente.',
  },
  {
    q: 'Posso cambiare formato al libro?',
    a: 'Sì: A5, A4, tascabile, US Trade, quadrato e orizzontale, con spessore del dorso regolabile da 8 a 60 mm.',
  },
  {
    q: 'Il lavoro viene salvato?',
    a: 'No, ed è voluto: chiudendo la pagina il progetto si perde. Prima di uscire compare un avviso che ricorda di scaricare il file.',
  },
]

/** Scheda di catalogo: i dati arrivano dai modelli, senza il peso del 3D. */
interface CatalogCard {
  id: string
  name: string
  description: string
  icon: string
  variants: number
  colors: number
  options: string[]
}

const toCard = (m: MockupDefinition): CatalogCard => ({
  id: m.id,
  name: m.name,
  description: m.description,
  icon: m.icon,
  variants: m.variants.length,
  colors: m.colors?.length ?? 0,
  options: m.options?.map((o) => o.label) ?? [],
})

export default function HomePage() {
  const [cards, setCards] = useState<CatalogCard[]>([])

  // il catalogo (e con lui il motore 3D) viene caricato dopo il primo render:
  // la home resta leggera e l'editor è già in cache quando si apre
  useEffect(() => {
    let alive = true
    import('../three/models').then((mod) => {
      if (alive) setCards(mod.MOCKUPS.map(toCard))
    })
    return () => {
      alive = false
    }
  }, [])

  return (
    <main className="home">
      <section className="hero">
        <div>
          <span className="eyebrow">
            <SparkIcon size={14} /> Mockup nel browser
          </span>
          <h1>
            Le tue grafiche su <em>mockup reali</em>, in pochi secondi.
          </h1>
          <p className="lead">
            Carica un PNG o un JPG, Sagoma lo adatta automaticamente al modello scelto — t-shirt,
            felpe, cappelli, poster, brochure, libri — lo fa seguire alle pieghe del tessuto e della
            carta, e ti restituisce un render pronto da usare — con lo sfondo trasparente o del
            colore che scegli. Capi, cappelli e telefoni sono fotografie vere, non disegni.
          </p>
          <div className="hero-actions">
            <Link to="/crea" className="btn btn-primary">
              Crea il tuo mockup
            </Link>
            <a href="#come-funziona" className="btn btn-ghost">
              Come funziona
            </a>
          </div>
          <p className="hero-note">
            Nessuna registrazione · Le immagini restano sul tuo computer · Esporta in PNG o PDF
          </p>
        </div>
        <div className="hero-visual">
          {FEATURES.map((f) => (
            <div className="hero-card" key={f.title}>
              {f.icon}
              <strong>{f.title}</strong>
              <span>{f.text}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="section" id="come-funziona">
        <div className="section-head">
          <h2>Come funziona</h2>
          <p>
            Quattro passaggi, tutti dentro la stessa finestra di lavoro. A sinistra scegli il
            modello, al centro lavori sul mockup, a destra carichi e regoli la grafica.
          </p>
        </div>
        <div className="steps">
          {STEPS.map((s, i) => (
            <article className="step" key={s.title}>
              <div className="step-num">{i + 1}</div>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section" id="modelli">
        <div className="section-head">
          <h2>I mockup disponibili</h2>
          <p>
            Ogni modello si ricostruisce al momento, sulla foto o in 3D: cambi variante, colore e
            formato e la grafica si riadatta da sola, senza rifare il lavoro.
          </p>
        </div>
        <div className="gallery">
          {cards.map((m) => (
            <Link className="gallery-card" key={m.id} to={`/crea?m=${m.id}`}>
              <div className="gallery-thumb">
                <MockupIcon name={m.icon} size={78} />
              </div>
              <div className="gallery-body">
                <h3>{m.name}</h3>
                <p>{m.description}</p>
                <div className="tag-row">
                  <span className="tag">{m.variants} varianti</span>
                  {m.colors > 0 && <span className="tag">{m.colors} colori</span>}
                  {m.options.map((o) => (
                    <span className="tag" key={o}>
                      {o}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>
        {cards.length === 0 && <p className="hint">Caricamento del catalogo…</p>}
      </section>

      <section className="section">
        <div className="callout">
          <WarningIcon size={20} />
          <div>
            <strong>Il progetto non viene salvato.</strong> Sagoma lavora solo nella memoria del
            browser: se chiudi o ricarichi la pagina, il lavoro si perde. Quando hai almeno una
            grafica caricata, il browser mostra un avviso prima di chiudere — scarica sempre il PNG
            o il PDF prima di uscire.
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Domande frequenti</h2>
        </div>
        <div className="faq">
          {FAQ.map((f) => (
            <article className="faq-item" key={f.q}>
              <h3>
                <CheckIcon size={15} /> {f.q}
              </h3>
              <p>{f.a}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="footer">
        Sagoma — mockup generati nel browser. Nessun file lascia il tuo computer.
      </footer>
    </main>
  )
}
