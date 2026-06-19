// Generates the app icons + OG image from the brand mark. Re-run after the
// source logo changes:  pnpm tsx scripts/gen-brand.ts
//
// Outputs use Next's file-based metadata convention (src/app/icon.png,
// apple-icon.png, opengraph-image.png) — no metadata code needed.
import sharp from 'sharp'

const SRC = 'public/brand/ledger_icon.png'
const APP = 'src/app'
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 }
const INK = { r: 0x0b, g: 0x0b, b: 0x0e, alpha: 1 } // #0B0B0E

async function main() {
  // Favicon / browser icon.
  await sharp(SRC)
    .resize(512, 512, { fit: 'contain', background: TRANSPARENT })
    .png()
    .toFile(`${APP}/icon.png`)

  // Apple touch icon (the mark already carries its lime rounded-square bg).
  await sharp(SRC)
    .resize(180, 180, { fit: 'contain', background: TRANSPARENT })
    .png()
    .toFile(`${APP}/apple-icon.png`)

  // Open Graph: mark centered on the brand ink background, 1200x630.
  const mark = await sharp(SRC)
    .resize(360, 360, { fit: 'contain', background: TRANSPARENT })
    .png()
    .toBuffer()
  await sharp({ create: { width: 1200, height: 630, channels: 4, background: INK } })
    .composite([{ input: mark, gravity: 'center' }])
    .png()
    .toFile(`${APP}/opengraph-image.png`)

  console.log('Brand icons generated: icon.png, apple-icon.png, opengraph-image.png')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
