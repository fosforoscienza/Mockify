# Mockify

**In produzione: https://mockify-murex.vercel.app**

Generatore di mockup 3D che funziona interamente nel browser: carichi le tue
grafiche in PNG o JPG, Mockify le adatta al modello scelto seguendo le pieghe
del tessuto e della carta, e le esporta in **PNG** o **PDF** — con lo sfondo
trasparente o del colore che scegli — nell'angolazione impostata ruotando la
scena.

Nessun server, nessuna registrazione: le immagini non lasciano il computer.

## Mockup disponibili

| Mockup | Varianti | Aree di stampa | Opzioni |
| --- | --- | --- | --- |
| **T-shirt** | fronte, retro, fronte + retro affiancati | fronte, retro | colore libero + 18 campioni (gamma B&C E150) |
| **Felpa con cappuccio** | fronte, retro, fronte + retro affiancati | fronte, retro | colore libero + 18 campioni |
| **Cappello con visiera** | baseball, snapback, dad hat, trucker | fronte, retro | colore libero + 6 campioni |
| **Fogli sparsi** | due affiancati, due sovrapposti, tre sparsi, pila | fronte, retro (due facciate diverse) | A4, A5, Letter, quadrato, A4 orizzontale |
| **Poster appeso** | cornice a bastone, mollette, puntine, foglio libero | grafica intera | A3, A2, A1, 50×70, 70×50, 60×60, 6×3 m |
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
4. **Scegli i colori**: quello del materiale nella barra in alto e quello dello
   sfondo nella sezione *Scena*, con campioni rapidi, selettore completo e
   contagocce per prelevare una tinta dallo schermo.
5. **Ruota la scena** trascinando con il mouse, zooma con la rotella.
6. **Scarica** in PNG (1024/2048/4096 px sul lato lungo) o in PDF a 300 dpi,
   con lo sfondo scelto oppure trasparente.

> Il progetto vive solo nella scheda del browser. Quando c'è almeno una grafica
> caricata, alla chiusura della pagina compare l'avviso del browser e, uscendo
> dall'editor, una finestra che ricorda di scaricare il file.

## Deploy su Vercel

Il repository contiene `vercel.json` già pronto: framework Vite, build
`npm run build`, output in `dist/`, rewrite di tutte le rotte su `index.html`
(l'app usa URL puliti tipo `/crea?m=poster`) e cache immutabile sugli asset.
Il repo è collegato al progetto Vercel `mockify`: ogni push sul branch di
produzione (`main`) pubblica una nuova versione, gli altri branch ottengono un
deploy di anteprima. Non servono variabili d'ambiente: l'app è
interamente statica e lavora nel browser.

## Aggiornamenti

Ogni build scrive il proprio identificativo (su Vercel il commit) sia nel bundle
sia in `/version.json`. Una scheda lasciata aperta confronta i due valori ogni
cinque minuti e al ritorno sulla pagina: se non coincidono compare un avviso con
il pulsante per ricaricare. Siccome ricaricare cancella il progetto in corso,
quando ci sono grafiche caricate l'avviso lo dice e non mette in evidenza il
pulsante di aggiornamento. Se un chunk non si carica — tipico subito dopo un
deploy — la pagina si ricarica una sola volta da sé.

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
    models/         un file per mockup 3D (cappello, fogli, poster, brochure, libro)
  flat/             capi disegnati in piano: sagome, campo di forma, rumore e
                    renderer 2D con integrazione della stampa
  components/       barra, elenco mockup, viewport, pannelli, icone SVG
  pages/            home ed editor
  state/            reducer del progetto (modello, opzioni, grafiche)
  lib/              caricamento immagini, download PNG/PDF
```

Due idee reggono tutto il progetto:

- **Superfici parametriche condivise.** Il supporto e la grafica nascono dalla
  stessa funzione `(u, v) → punto`, quindi la stampa segue esattamente la
  curvatura di poster, brochure, dorso del libro o calotta del cappello.
- **Capi resi in piano, non in 3D.** T-shirt e felpe non sono modelli
  poligonali: `src/flat/` costruisce una mappa di rilievo del capo disteso —
  forma d'insieme, pieghe orientate, grinze, collo, cuciture, orli — e la
  illumina per pixel alla risoluzione richiesta. A quella scala si vede la
  maglia del tessuto, cosa che un modello 3D con normal map non riesce a dare;
  in cambio si rinuncia alla rotazione libera e restano due viste, fronte e
  retro. La grafica caricata viene spostata dal gradiente delle pieghe e
  moltiplicata per la stessa luce del capo, così segue la stoffa. Il colore è
  libero perché ombre e pieghe moltiplicano la tinta invece di essere dipinte
  sopra.

Il canvas ha il canale alpha (`alpha: true`, clear alpha 0) e l'ombra a terra usa
uno `ShadowMaterial`: senza sfondo il render resta trasparente fino
all'esportazione, con uno sfondo scelto il colore entra nella scena e quindi
anche nel file. In esportazione si può comunque forzare la trasparenza.
