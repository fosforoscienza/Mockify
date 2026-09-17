/**
 * Riduce le foto di base a un peso da web.
 *
 * Le basi arrivano come PNG da fotoritocco: 4000 px e dieci megabyte l'uno.
 * Il browser le scarica intere appena si sceglie il mockup, quindi la prima
 * apertura resta bloccata per secondi. Qui vengono ridimensionate al lato
 * lungo utile e riscritte in WebP, che sulle fotografie pesa una frazione del
 * PNG e tiene comunque il canale alpha dei soggetti scontornati.
 *
 * Gli originali vengono cancellati: restano nella storia di git, e tenerli
 * nella cartella pubblica significherebbe pubblicarli lo stesso a ogni deploy.
 *
 * Uso:  node scripts/ottimizza-basi.mjs [--dry]
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = path.join(process.cwd(), 'public', 'basi')
/** Il lato lungo massimo: copre l'export a 2048 px e regge quello a 4096. */
const MAX_SIDE = 3000
const QUALITY = 86
const dry = process.argv.includes('--dry')

async function* walk(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(full)
    else yield full
  }
}

const fmt = (n) => `${(n / 1048576).toFixed(2)} MB`

let before = 0
let after = 0
const done = []

for await (const file of walk(ROOT)) {
  if (!/\.(png|jpe?g)$/i.test(file)) continue
  const src = await fs.readFile(file)
  const meta = await sharp(src).metadata()
  const long = Math.max(meta.width, meta.height)
  const out = await sharp(src)
    .resize({
      width: long > MAX_SIDE && meta.width >= meta.height ? MAX_SIDE : undefined,
      height: long > MAX_SIDE && meta.height > meta.width ? MAX_SIDE : undefined,
      withoutEnlargement: true,
      fit: 'inside',
    })
    .webp({ quality: QUALITY, alphaQuality: 100, effort: 5 })
    .toBuffer()
  const target = file.replace(/\.(png|jpe?g)$/i, '.webp')
  before += src.length
  after += out.length
  const rel = path.relative(ROOT, file)
  const outMeta = await sharp(out).metadata()
  done.push(
    `${rel}\n    ${meta.width}×${meta.height} ${fmt(src.length)}  →  ` +
      `${outMeta.width}×${outMeta.height} ${fmt(out.length)}`,
  )
  if (dry) continue
  await fs.writeFile(target, out)
  if (target !== file) await fs.unlink(file)
}

console.log(done.join('\n'))
console.log(`\n${done.length} file: ${fmt(before)} → ${fmt(after)} (${((1 - after / before) * 100).toFixed(1)}% in meno)`)
if (dry) console.log('(--dry: nessun file scritto)')
