import { describe, expect, it } from 'vitest'
import { fixtureData, fixtureTree } from '../engine/fixtures'
import { rentalText } from './rentalText'

describe('rentalText', () => {
  const data = fixtureData()

  it('formats a full build', () => {
    const build = fixtureTree().slots[1]! // Bravo Heart with sparks + races
    const text = rentalText(build, data)
    expect(text).toBe(
      [
        'LF rental: Bravo Heart (any outfit)',
        'Sparks: Speed 3★ / Dirt 3★ / Unique 2★',
        'Whites: Groundwork 2★',
        'Won: Japan Cup, Arima Kinen',
        '(planned with Sparkline)',
      ].join('\n'),
    )
  })

  it('omits empty sections', () => {
    const build = fixtureTree().slots[5]! // pink only
    const text = rentalText(build, data)
    expect(text).toContain('LF rental: Echo Flash')
    expect(text).toContain('Sparks: Pace Chaser 1★')
    expect(text).not.toContain('Whites:')
    expect(text).not.toContain('Won:')
  })
})
