import { writeFileSync } from 'node:fs'
import { createCanvas } from '@napi-rs/canvas'
import { describe, expect, it } from 'vitest'
import { fixtureData, fixtureTree } from '../engine/fixtures'
import { drawTree, layoutTree } from './treeImage'

/**
 * Renders the fixture tree with a real (native) canvas — catches Canvas2D
 * API misuse the pure layout tests can't. Set RENDER_OUT=<dir> to also write
 * the PNGs for visual inspection.
 */
describe('drawTree (native canvas render)', () => {
  const cases = [
    { scope: 'active', dark: false },
    { scope: 'active', dark: true },
    { scope: 'full', dark: false },
  ] as const

  for (const opts of cases) {
    it(`renders ${opts.scope} scope (${opts.dark ? 'dark' : 'light'})`, () => {
      const canvas = createCanvas(10, 10)
      drawTree(canvas as unknown as HTMLCanvasElement, fixtureTree(), fixtureData(), {
        ...opts,
        showAffinity: true,
      })
      const layout = layoutTree(opts.scope)
      expect(canvas.width).toBe(layout.width * 2)
      expect(canvas.height).toBe(layout.height * 2)

      const png = canvas.toBuffer('image/png')
      expect(png.length).toBeGreaterThan(10_000) // non-trivial image content

      if (process.env.RENDER_OUT) {
        writeFileSync(
          `${process.env.RENDER_OUT}/tree-${opts.scope}-${opts.dark ? 'dark' : 'light'}.png`,
          png,
        )
      }
    })
  }
})
