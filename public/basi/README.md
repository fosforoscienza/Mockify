# Basi fotografiche per i mockup

Qui dentro vanno le foto reali dei capi, che Mockify usa come base al posto dei
modelli disegnati. Ogni base è una singola immagine del capo fotografato dritto,
su cui l'app proietta la grafica caricata dall'utente.

## Dove caricare i file

Una cartella per tipo di mockup, un file per vista:

```
public/basi/tshirt/fronte.png
public/basi/tshirt/retro.png
public/basi/felpa/fronte.png
public/basi/felpa/retro.png
public/basi/cappello/fronte.png
public/basi/cappello/tre-quarti.png
```

Se hai più modelli dello stesso capo, aggiungi il nome del modello come
sottocartella: `public/basi/cappello/trucker/fronte.png`.

## Formato

- **PNG con sfondo trasparente** (canale alpha), non JPEG: i mockup di Mockify
  non hanno sfondo, quindi il capo va già scontornato.
- **Lato lungo almeno 2000 px**, meglio 3000 px: l'export arriva a 300 dpi.
- **Capo dritto e centrato**, fotografato frontalmente, senza prospettiva
  marcata. Niente manichino visibile, niente ombra sul fondo (l'ombra la
  aggiunge l'app, così resta coerente con lo sfondo scelto).
- **Colore del capo: bianco o grigio chiaro neutro.** Da una base chiara si
  ricava qualsiasi colore mantenendo pieghe e ombre; da una base scura no.
- Pieghe e ombre devono essere ben leggibili: sono quelle che l'app riusa per
  far seguire alla stampa l'andamento del tessuto.

## PSD o PNG?

**PNG.** Il browser non legge i PSD, quindi un PSD andrebbe comunque esportato.
Se parti da un PSD con smart object, esporta:

1. il capo da solo, scontornato, in PNG (è il file indispensabile);
2. se ce l'hai come livello separato, anche il livello di ombre/pieghe in
   scala di grigi, come `fronte-ombre.png`: migliora la resa della stampa sul
   tessuto, ma è facoltativo — altrimenti lo ricavo dalla foto stessa.

Non serve che indichi l'area di stampa: la definisco io sul file, e la trovi poi
regolabile dai comandi di posizione e dimensione.
