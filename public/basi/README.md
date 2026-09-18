# Basi fotografiche per i mockup

Qui dentro vanno le foto reali dei prodotti, che Sagoma usa come base al posto
dei modelli disegnati: l'app ci proietta sopra la grafica caricata dall'utente.

## Struttura

Tre livelli, sempre: **prodotto / versione / vista**.

```
public/basi/<prodotto>/<versione>/<vista>.png
```

- **prodotto** — cartella fissa, già creata. Non aggiungerne di nuove senza
  dirmelo: a ognuna corrisponde una voce nell'elenco dei mockup.
- **versione** — un modello diverso dello stesso prodotto (`01`, `02`, `03`…).
  Diventa una variante selezionabile nella barra in alto. Ogni foto di un
  prodotto *diverso* va in una versione sua: la felpa con cappuccio e quella
  girocollo sono due versioni, non due file nella stessa cartella.
- **vista** — il nome del file dice da che lato è ripreso il prodotto:
  `fronte.png`, `retro.png`, `destra.png`, `sinistra.png`, `tre-quarti.png`,
  `alto.png`. Più viste nella stessa cartella = più inquadrature dello stesso
  modello, scelte dall'utente.

Cartelle pronte:

```
tshirt/              01 02 03 04
felpa/               01 (con cappuccio) 02 (girocollo) 03
cappello-baseball/   01 02
cappello-pescatore/  01 02
telefono/            01 02 03 04
manifesto/           70x100-01 70x100-02 600x300-01 600x300-02
```

Per il manifesto il nome della versione porta anche il formato, così i due
formati restano separati. Se ti servono più versioni di quelle create, aggiungi
pure `05`, `06`… con lo stesso schema.

## Due tipi di base

**Prodotto scontornato** — capi, cappelli, telefono. Il mockup non ha sfondo:
l'oggetto galleggia e l'utente sceglie lui il colore di fondo.

- **PNG con sfondo trasparente** (canale alpha), non JPEG.
- **Prodotto bianco o grigio chiaro neutro.** È il requisito più importante per
  i capi: da una base chiara ricavo qualunque colore mantenendo pieghe e ombre,
  da una base scura no.
- **Ripresa frontale o in tre quarti netti**, prodotto centrato, senza manichino
  visibile e **senza ombra sul fondo**: l'ombra la aggiunge l'app, così resta
  coerente con lo sfondo scelto.
- Pieghe e ombre del tessuto devono essere ben leggibili: sono quelle che l'app
  riusa per far seguire alla stampa l'andamento del capo.

**Scena in ambiente** — manifesti. Qui lo sfondo è il punto: l'affissione sotto
il cavalcavia, i due poster sul muro. La foto va tenuta intera, con luci e
ombre; l'app sostituisce solo il pannello bianco.

- JPEG o PNG vanno bene, lo sfondo resta.
- Il pannello da sostituire deve essere **chiaro e uniforme**, con sopra le
  ombre della scena: sono quelle che riporto sulla grafica, ed è ciò che fa
  sembrare il manifesto davvero affisso lì.
- Niente oggetti davanti al pannello.

## Per tutti

- **Lato lungo almeno 2000 px**, meglio 3000: l'export arriva a 300 dpi. I file
  `_low` a 2000 px vanno bene per provare; se hai le versioni piene, caricale.
- Carica pure il PNG che esce dal fotoritocco, senza preoccuparti del peso.

## Dopo ogni caricamento: ottimizza

I PNG da fotoritocco pesano diversi megabyte l'uno, e il browser li scarica
interi appena si sceglie il mockup: la prima apertura resta bloccata per
secondi. Dopo aver caricato foto nuove va quindi eseguito una volta:

```
npm install        # solo la prima volta
node scripts/ottimizza-basi.mjs --dry   # mostra cosa farebbe
node scripts/ottimizza-basi.mjs         # ridimensiona e converte
```

Le foto vengono portate al lato lungo di 3000 px e riscritte in WebP, che sulle
fotografie pesa una frazione del PNG e tiene comunque il canale alpha dei
soggetti scontornati. Sul materiale attuale: 66 MB → 5,5 MB, con le stesse
dimensioni in pixel dove già stavano sotto i 3000.

Gli originali vengono cancellati, perché restano nella storia di git e tenerli
nella cartella pubblica significherebbe pubblicarli lo stesso a ogni deploy.
I nomi dei file cambiano estensione, quindi dopo l'ottimizzazione vanno
aggiornati i percorsi in `src/photo/bases.ts`.

## PSD o PNG?

**PNG.** Il browser non legge i PSD, quindi andrebbero comunque esportati. Se
parti da un PSD con smart object esporta il prodotto da solo, scontornato. Se
hai il livello ombre/pieghe separato puoi aggiungere anche `fronte-ombre.png` in
scala di grigi: migliora la resa della stampa, ma è facoltativo — altrimenti lo
ricavo dalla foto stessa.

## L'area di stampa: dipingila di verde

Il modo migliore per dirmi dov'è l'area di stampa è **dipingerla di verde
pieno** nella foto, come un green screen. L'app la ritrova da sola, con gli
spigoli esatti: non servono coordinate, e una foto nuova funziona senza che io
tocchi il codice.

Il verde va **sotto le luci e le ombre della scena**, non sopra: in Photoshop il
livello verde con sopra quello delle ombre in Moltiplica. Serve a due cose
insieme. Il colore dice dove sta l'area — e la maschera segue anche gli angoli
arrotondati di uno schermo, cosa che un rettangolo non farebbe. La luminanza
dice com'è illuminata: a grafica applicata la fascia di sole continua a cadere
sul manifesto, invece di lasciarlo piatto e incollato. Dove non c'è grafica il
verde viene sostituito da carta bianca che conserva quella stessa luce.

Verde pieno tipo `#00FF00`, purché non sia un colore presente altrove nella
foto in modo massiccio. Un po' di sbavatura verde attorno all'area — un'auto
sfocata che passa davanti al cartellone — la tolgo io.

Sulle foto senza verde l'area la definisco a mano, e resta comunque regolabile
dai comandi di posizione e dimensione.
