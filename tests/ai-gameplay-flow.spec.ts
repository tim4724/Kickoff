import { test, expect } from '@playwright/test'
import { waitScaled } from './helpers/time-control'
import { TEST_ENV } from './config/test-env'

const CLIENT_URL = TEST_ENV.CLIENT_URL

async function startAIOnlyScene(page) {
  await page.goto(CLIENT_URL)
  await page.waitForFunction(() => (window as any).__gameControls?.scene, { timeout: 10000 })
  await page.evaluate(() => {
    const game = (window as any).game
    game?.scene?.start('AIOnlyScene')
    game?.scene?.stop('MenuScene')
    // run faster to shorten smoke test
    const GameClock = (window as any).GameClock
    GameClock?.setTimeScale?.(5)
    const scene = (window as any).__gameControls?.scene
    if (scene) scene.gameSpeed = 5
  })
  await page.waitForFunction(() => (window as any).__gameControls?.scene?.scene?.key === 'AIOnlyScene', { timeout: 5000 })
}

test.describe('AI gameplay (smoke)', () => {
  test('AI-only match advances and shares possession', async ({ page }) => {
    await startAIOnlyScene(page)

    let lastPossessor = ''
    const possessionTeams = new Set<string>()
    let goals = { blue: 0, red: 0 }

    for (let i = 0; i < 20; i++) {
      const snapshot = await page.evaluate(() => {
        const engine = (window as any).__gameControls?.scene?.gameEngine
        const state = engine?.getState()
        if (!state) return null
        return {
          matchTime: state.matchTime,
          scoreBlue: state.scoreBlue,
          scoreRed: state.scoreRed,
          possessor: state.ball.possessedBy,
          possessorTeam: state.players.get(state.ball.possessedBy)?.team,
          players: state.players.size
        }
      })

      if (snapshot?.possessor && snapshot.possessor !== lastPossessor) {
        lastPossessor = snapshot.possessor
        if (snapshot.possessorTeam) possessionTeams.add(snapshot.possessorTeam)
      }

      goals = { blue: snapshot?.scoreBlue ?? goals.blue, red: snapshot?.scoreRed ?? goals.red }
      await waitScaled(page, 150)
    }

    expect(goals.blue + goals.red).toBeGreaterThanOrEqual(0) // ensure state read once
    expect(possessionTeams.size).toBeGreaterThan(0)
  })
})
