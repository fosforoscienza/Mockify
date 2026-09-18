/**
 * Mockup costruiti su foto vere, caricate in public/basi.
 *
 * Ogni variante è una foto (o una coppia fronte/retro della stessa foto), e la
 * sua etichetta viene dal nome del file: è così che chi sceglie capisce cosa
 * sta selezionando — "T-shirt appesa", "Maglietta piegata", "Cappello di tre
 * quarti".
 *
 * Le aree di stampa sono quadrilateri in coordinate normalizzate sull'immagine,
 * nell'ordine alto-sinistra, alto-destra, basso-destra, basso-sinistra: quattro
 * punti e non un rettangolo, perché sulle foto in prospettiva la stampa deve
 * seguire l'inclinazione del soggetto.
 *
 * Dove la foto ha l'area dipinta di verde quei punti non si scrivono: li trova
 * il renderer dal verde stesso, con la precisione che a occhio non si ottiene.
 * Basta dichiarare `green: true` e la proporzione reale della stampa.
 */

export type Quad = [number, number][]

export interface PhotoArea {
  id: string
  label: string
  /**
   * Spigoli dell'area, quando vanno indicati a mano. Sulle basi con green
   * screen non serve: li ricava il renderer dal verde stesso.
   */
  quad?: Quad
  /**
   * L'area è dipinta di verde nella foto. Il renderer la ritrova da sola,
   * spigoli compresi, e sostituisce il verde con carta bianca che conserva
   * la luce della scena. Con più aree verdi nella stessa foto contano da
   * sinistra a destra, nell'ordine in cui sono dichiarate qui.
   */
  green?: boolean
  /**
   * Proporzione reale della stampa, larghezza / altezza. Serve solo alle aree
   * verdi: una macchia verde non dice da che parte sta il suo alto, e senza
   * questo numero la grafica può uscire ruotata di 90°.
   */
  ratio?: number
  hint?: string
  /**
   * Quanto la luce della foto agisce sulla stampa: 1 = pieghe e ombre del
   * tessuto passano tutte sopra la grafica, 0 = grafica piatta. Sugli schermi
   * resta bassa, perché un display è acceso e non riceve ombre.
   */
  shade?: number
  /**
   * 'cover' riempie l'area e deborda sul lato lungo, 'contain' ci sta dentro.
   * Uno schermo o un manifesto vanno riempiti fino al bordo; la stampa sul
   * petto di una maglietta no, altrimenti la si taglia.
   */
  fill?: 'contain' | 'cover'
}

export interface PhotoView {
  file: string
  areas: PhotoArea[]
}

export interface PhotoVariant {
  id: string
  label: string
  description?: string
  views: PhotoView[]
}

export interface PhotoConfig {
  /** Cartella del prodotto sotto public/basi. */
  folder: string
  /**
   * Il soggetto è chiaro e può essere ricolorato: la luminanza della foto
   * moltiplica il colore scelto, quindi pieghe e ombre restano.
   */
  recolor: boolean
  variants: PhotoVariant[]
}

const rect = (x0: number, y0: number, x1: number, y1: number): Quad => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
]

const petto = (quad: Quad, label = 'Fronte', id = 'fronte'): PhotoArea => ({
  id,
  label,
  quad,
  hint: 'Area petto',
})

export const TSHIRT_PHOTO: PhotoConfig = {
  folder: 'tshirt',
  recolor: true,
  variants: [
    {
      id: 'appesa',
      label: 'T-shirt appesa',
      description: 'Su gruccia, fronte e retro.',
      views: [
        { file: '01/fronte.webp', areas: [petto(rect(0.385, 0.325, 0.64, 0.62))] },
        {
          file: '01/retro.webp',
          areas: [{ id: 'retro', label: 'Retro', quad: rect(0.405, 0.325, 0.655, 0.62), hint: 'Area schiena' }],
        },
      ],
    },
    {
      id: 'appesa-2',
      label: 'T-shirt appesa, secondo modello',
      description: 'Gruccia sottile, taglio più largo.',
      views: [{ file: '02/fronte.webp', areas: [petto(rect(0.41, 0.3, 0.64, 0.6))] }],
    },
    {
      id: 'piegata',
      label: 'Maglietta piegata',
      description: 'Piegata e vista dall’alto.',
      views: [
        {
          file: '03/fronte.webp',
          areas: [
            {
              id: 'fronte',
              label: 'Fronte',
              // Il capo piegato offre una facciata larga: si stampa da sotto il
              // colletto fin oltre la piega bassa. Quello che deborda dal capo
              // non si vede, perché la foto è scontornata e il compositing
              // salta i pixel trasparenti della base.
              quad: rect(0.2, 0.34, 0.82, 0.87),
              hint: 'Facciata piegata, sotto il colletto',
            },
          ],
        },
      ],
    },
    {
      id: 'fronte-retro',
      label: 'Maglietta fronte e retro',
      description: 'Le due facciate nella stessa foto.',
      views: [
        {
          file: '04/fronte.webp',
          areas: [
            petto(rect(0.205, 0.27, 0.375, 0.54)),
            { id: 'retro', label: 'Retro', quad: rect(0.605, 0.27, 0.775, 0.54), hint: 'Area schiena' },
          ],
        },
      ],
    },
  ],
}

export const FELPA_PHOTO: PhotoConfig = {
  folder: 'felpa',
  recolor: true,
  variants: [
    {
      id: 'cappuccio',
      label: 'Felpa con cappuccio',
      description: 'Ripresa di tre quarti, con tasca a marsupio.',
      views: [
        {
          file: '01/fronte.webp',
          areas: [petto([[0.415, 0.44], [0.62, 0.4], [0.645, 0.63], [0.44, 0.67]])],
        },
      ],
    },
    {
      id: 'girocollo',
      label: 'Felpa girocollo',
      description: 'Frontale, maniche raglan.',
      views: [{ file: '02/fronte.webp', areas: [petto(rect(0.395, 0.3, 0.61, 0.545))] }],
    },
  ],
}

export const CAPPELLO_BASEBALL_PHOTO: PhotoConfig = {
  folder: 'cappello-baseball',
  recolor: true,
  variants: [
    {
      id: 'fronte',
      label: 'Cappello baseball, fronte',
      views: [
        {
          file: '01/fronte.webp',
          areas: [{ id: 'fronte', label: 'Pannello frontale', quad: rect(0.385, 0.355, 0.585, 0.505) }],
        },
      ],
    },
    {
      id: 'destra',
      label: 'Cappello baseball, tre quarti destra',
      views: [
        {
          file: '01/destra.webp',
          areas: [{ id: 'fronte', label: 'Pannello frontale', quad: rect(0.38, 0.36, 0.56, 0.52) }],
        },
      ],
    },
    {
      id: 'sinistra',
      label: 'Cappello baseball, tre quarti sinistra',
      views: [
        {
          file: '01/sinistra.webp',
          areas: [{ id: 'fronte', label: 'Pannello frontale', quad: rect(0.33, 0.4, 0.51, 0.55) }],
        },
      ],
    },
  ],
}

export const CAPPELLO_PESCATORE_PHOTO: PhotoConfig = {
  folder: 'cappello-pescatore',
  recolor: true,
  variants: [
    {
      id: 'fronte',
      label: 'Cappello da pescatore',
      description: 'Bucket hat, ripresa frontale.',
      views: [
        {
          file: '01/fronte.webp',
          areas: [{ id: 'fronte', label: 'Fascia frontale', quad: rect(0.4, 0.4, 0.6, 0.53) }],
        },
      ],
    },
  ],
}

/** Lo schermo è dipinto di verde: spigoli e angoli arrotondati li trova il renderer. */
const schermo = (): PhotoArea => ({
  id: 'schermo',
  label: 'Schermo',
  green: true,
  ratio: 1179 / 2556,
  hint: 'Display',
  shade: 0.2,
  fill: 'cover',
})

export const TELEFONO_PHOTO: PhotoConfig = {
  folder: 'telefono',
  recolor: false,
  variants: [
    {
      id: 'fronte-retro',
      label: 'iPhone fronte e retro',
      description: 'Due telefoni affiancati, dritti.',
      views: [
        {
          file: '01/fronte-retro.webp',
          areas: [schermo()],
        },
      ],
    },
    {
      id: 'inclinato-fronte-retro',
      label: 'iPhone inclinato, fronte e retro',
      views: [
        {
          file: '01/inclinato-fronte-retro.webp',
          areas: [schermo()],
        },
      ],
    },
    {
      id: 'inclinato',
      label: 'iPhone inclinato',
      description: 'Telefono singolo, in diagonale.',
      views: [
        {
          file: '01/inclinato.webp',
          areas: [schermo()],
        },
      ],
    },
  ],
}

export const MANIFESTO_PHOTO: PhotoConfig = {
  folder: 'manifesto',
  recolor: false,
  variants: [
    {
      id: '6x3-fronte',
      label: 'Affissione 6 × 3, frontale',
      description: 'Cartellone sotto il cavalcavia.',
      views: [
        {
          file: '600x300-01/fronte.webp',
          areas: [
            { id: 'fronte', label: 'Manifesto', green: true, ratio: 2, hint: '6 × 3 m', fill: 'cover' },
          ],
        },
      ],
    },
    {
      id: '6x3-tre-quarti',
      label: 'Affissione 6 × 3, di tre quarti',
      description: 'Stesso cartellone, ripreso di lato.',
      views: [
        {
          file: '600x300-01/tre-quarti.webp',
          areas: [
            { id: 'fronte', label: 'Manifesto', green: true, ratio: 2, hint: '6 × 3 m', fill: 'cover' },
          ],
        },
      ],
    },
    {
      id: 'doppio-muro',
      label: 'Doppio poster su muro',
      description: 'Due cornici su un muro coperto d’edera.',
      views: [
        {
          file: '70x100-01/fronte.webp',
          areas: [
            { id: 'fronte', label: 'Poster di sinistra', green: true, ratio: 0.7, hint: '70 × 100 cm', fill: 'cover' },
            { id: 'retro', label: 'Poster di destra', green: true, ratio: 0.7, hint: '70 × 100 cm', fill: 'cover' },
          ],
        },
      ],
    },
  ],
}
