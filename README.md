# Mockify

Generatore di mockup 3D che funziona interamente nel browser: carichi le tue
grafiche in PNG o JPG, Mockify le adatta al modello scelto seguendo le pieghe
del tessuto e della carta, e le esporta in **PNG con sfondo trasparente** o in
**PDF** nell'angolazione che hai impostato ruotando la scena.

Nessun server, nessuna registrazione: le immagini non lasciano il computer.

## Mockup disponibili

| Mockup | Varianti | Aree di stampa | Opzioni |
| --- | --- | --- | --- |
| **T-shirt** | classica, oversize, slim, scollo a V, manica lunga | fronte, retro | 7 colori |
| **Felpa** | cappuccio, full zip, oversize, girocollo | fronte, retro | 7 colori |
| **Cappello con visiera** | baseball, snapback, dad hat, trucker | fronte, retro | 6 colori |
| **Fogli sparsi** | due fogli, tre fogli, pila | fronte, retro (due facciate diverse) | A4, A5, Letter, quadrato, A4 orizzontale |
| **Poster appeso** | cornice a bastone, mollette, puntine, foglio libero | grafica intera | A3, A2, A1, 50×70, 70×50, 60×60 |
| **Brochure 3 ante** | piega a zeta, a rotolo, aperta, in piedi | spread interno, spread esterno | A4, DL, A5, quadrata |
| **Libro copertina rigida** | in piedi, tre quarti, disteso, aperto | copertina, dorso, quarta (oppure le due pagine interne) | 6 formati, dorso 8–60 mm, profilo tondo/quadro, finitura tela/patinata |

## Come si usa

1. **Scegli il mockup** nella colonna di sinistra, poi variante, colore e formato
   nella barra in alto.
2. **Carica la grafica**: trascinala nell'area di lavoro oppure usa il riquadro
   di caricamento nel pannello di destra. Ogni area di stampa ha il suo file.
3. **Adattala**: dimensione, rotazione, posizione e opacità dal pannello, oppure
   trascina direttamente la grafica sul mockup (il resto della superficie
   continua a far ruotare la scena).
4. **Ruota la scena** trascinando con il mouse, zooma con la rotella.
5. **Scarica** in PNG (1024/2048/4096 px sul lato lungo) o in PDF a 300 dpi.

> Il progetto vive solo nella scheda del browser. Quando c'è almeno una grafica
> caricata, alla chiusura della pagina compare l'avviso del browser e, uscendo
> dall'editor, una finestra che ricorda di scaricare il file.

## Avvio

```bash
npm install
npm run dev       # server di sviluppo su http://localhost:5173
npm run build     # controllo dei tipi + build di produzione in dist/
npm run preview   # anteprima della build
```

Richiede Node 18+ e un browser con WebGL 2.

## Come è fatto

Nessun asset esterno: geometrie, materiali e texture sono generati a runtime.

```
src/
  three/
    surface.ts      superfici parametriche (u,v) → punto: la stessa funzione
                    genera il supporto e il piano su cui viene proiettata la grafica
    artwork.ts      matrice UV della grafica (scala, rotazione, posizione) e
                    materiale PBR che scarta i frammenti fuori dall'immagine
    slot.ts         mesh di un'area di stampa
    geometry.ts     suddivisione delle mesh, campo di distanza, utilità
    textures.ts     tessuto, maglia, carta, tela, taglio pagine (canvas 2D)
    materials.ts    materiali condivisi
    viewer.ts       scena, luci, ombra, controlli, trascinamento, esportazione
    models/         un file per mockup + la base comune dei capi
  components/       barra, elenco mockup, viewport, pannelli, icone SVG
  pages/            home ed editor
  state/            reducer del progetto (modello, opzioni, grafiche)
  lib/              caricamento immagini, download PNG/PDF
```

Due idee reggono tutto il progetto:

- **Superfici parametriche condivise.** Il supporto e la grafica nascono dalla
  stessa funzione `(u, v) → punto`, quindi la stampa segue esattamente la
  curvatura di poster, brochure, dorso del libro o calotta del cappello.
- **Volume dei capi per campo di distanza.** La sagoma 2D di magliette e felpe
  viene "gonfiata" in base alla distanza dal bordo: il capo prende corpo come un
  indumento indossato invece di restare un ritaglio piatto, e la stessa funzione
  di volume definisce l'area di stampa.

Lo sfondo non viene mai disegnato (`alpha: true`, clear alpha 0): la scacchiera
che si vede nell'editor è solo CSS e l'ombra a terra usa uno `ShadowMaterial`,
così anche l'esportazione resta trasparente.
