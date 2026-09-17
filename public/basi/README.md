# Basi fotografiche per i mockup

Qui dentro vanno le foto reali dei prodotti, che Mockify usa come base al posto
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

## PSD o PNG?

**PNG.** Il browser non legge i PSD, quindi andrebbero comunque esportati. Se
parti da un PSD con smart object esporta il prodotto da solo, scontornato. Se
hai il livello ombre/pieghe separato puoi aggiungere anche `fronte-ombre.png` in
scala di grigi: migliora la resa della stampa, ma è facoltativo — altrimenti lo
ricavo dalla foto stessa.

L'area di stampa non devi indicarmela: la definisco io su ogni file, e resta poi
regolabile dai comandi di posizione e dimensione.
