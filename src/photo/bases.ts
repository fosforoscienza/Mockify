/**
 * Mockup costruiti su foto vere, caricate in public/basi.
 *
 * Ogni variante è una foto (o una coppia fronte/retro della stessa foto), e la
 * sua etichetta viene dal nome del file: è così che chi sceglie capisce cosa
 * sta selezionando — "T-shirt appesa", "Maglietta piegata", "Cappello di tre
 * quarti". Le aree di stampa sono quadrilateri in coordinate normalizzate
 * sull'immagine, nell'ordine alto-sinistra, alto-destra, basso-destra,
 * basso-sinistra: quattro punti e non un rettangolo, perché sulle foto in
 * prospettiva la stampa deve seguire l'inclinazione del soggetto.
 */

export type Quad = [number, number][]

export interface PhotoArea {
  id: string
  label: string
  quad: Quad
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
          areas: [petto(rect(0.36, 0.36, 0.65, 0.63))],
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

const schermo = (quad: Quad): PhotoArea => ({
  id: 'schermo',
  label: 'Schermo',
  quad,
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
          areas: [schermo([[0.472, 0.197], [0.682, 0.191], [0.689, 0.844], [0.476, 0.853]])],
        },
      ],
    },
    {
      id: 'inclinato-fronte-retro',
      label: 'iPhone inclinato, fronte e retro',
      views: [
        {
          file: '01/inclinato-fronte-retro.webp',
          areas: [schermo([[0.426, 0.294], [0.587, 0.249], [0.755, 0.759], [0.593, 0.813]])],
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
          areas: [schermo([[0.258, 0.306], [0.437, 0.189], [0.726, 0.717], [0.547, 0.848]])],
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
            {
              id: 'fronte',
              label: 'Manifesto',
              quad: [[0.163, 0.358], [0.834, 0.356], [0.834, 0.727], [0.163, 0.727]],
              hint: '6 × 3 m',
              fill: 'cover',
            },
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
            {
              id: 'fronte',
              label: 'Manifesto',
              quad: [[0.212, 0.304], [0.809, 0.409], [0.818, 0.731], [0.198, 0.737]],
              hint: '6 × 3 m',
              fill: 'cover',
            },
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
            {
              id: 'fronte',
              label: 'Poster di sinistra',
              quad: [[0.213, 0.26], [0.375, 0.259], [0.377, 0.62], [0.212, 0.619]],
              hint: '70 × 100 cm',
              fill: 'cover',
            },
            {
              id: 'retro',
              label: 'Poster di destra',
              quad: [[0.648, 0.26], [0.813, 0.259], [0.813, 0.619], [0.647, 0.616]],
              hint: '70 × 100 cm',
              fill: 'cover',
            },
          ],
        },
      ],
    },
  ],
}
