import { Assets, Texture } from 'pixi.js'

/**
 * Game Assets loader for PixiJS.
 *
 * Loads the Kenney "Sports Pack" sprites (CC0 / public domain — see
 * public/assets/sports/LICENSE_kenney.txt) used for players, the ball and goals.
 *
 * Loading is idempotent: call loadGameAssets() before a game scene creates its
 * visual objects. Rendering code reads textures via getTexture(key) and falls
 * back to procedural Graphics when a texture is missing (e.g. asset failed to
 * load), so the game stays playable even if the network blip drops a sprite.
 */

export type GameTextureKey =
  | 'ball'
  | 'goalNet'
  | 'playerBlue1'
  | 'playerBlue2'
  | 'playerBlue3'
  | 'playerRed1'
  | 'playerRed2'
  | 'playerRed3'

const BASE = 'assets/sports'

const ASSET_MANIFEST: Record<GameTextureKey, string> = {
  ball: `${BASE}/ball_soccer.png`,
  goalNet: `${BASE}/goal_net.png`,
  playerBlue1: `${BASE}/player_blue_1.png`,
  playerBlue2: `${BASE}/player_blue_2.png`,
  playerBlue3: `${BASE}/player_blue_3.png`,
  playerRed1: `${BASE}/player_red_1.png`,
  playerRed2: `${BASE}/player_red_2.png`,
  playerRed3: `${BASE}/player_red_3.png`,
}

const textures: Partial<Record<GameTextureKey, Texture>> = {}
let loadPromise: Promise<void> | null = null

/**
 * Load all game textures. Safe to call multiple times — the underlying work
 * runs once and subsequent calls await the same promise.
 */
export function loadGameAssets(): Promise<void> {
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    const entries = Object.entries(ASSET_MANIFEST) as [GameTextureKey, string][]
    await Promise.all(
      entries.map(async ([key, url]) => {
        try {
          const texture = await Assets.load(url)
          // Kenney art is smooth, anti-aliased pixel art that we upscale ~2-4×.
          // Linear filtering keeps that soft look without harsh stair-stepping.
          if (texture?.source) {
            texture.source.scaleMode = 'linear'
          }
          textures[key] = texture
        } catch (err) {
          // Non-fatal: renderers fall back to Graphics primitives.
          console.warn(`[GameAssets] Failed to load ${key} (${url}):`, err)
        }
      })
    )
  })()

  return loadPromise
}

/** Returns a loaded texture, or undefined if it isn't available. */
export function getTexture(key: GameTextureKey): Texture | undefined {
  return textures[key]
}

/** Picks one of the N team-colored player textures, cycling by index. */
export function getPlayerTexture(team: 'blue' | 'red', index: number): Texture | undefined {
  const variant = (((index % 3) + 3) % 3) + 1 // 1..3
  const key = (team === 'blue' ? `playerBlue${variant}` : `playerRed${variant}`) as GameTextureKey
  return getTexture(key)
}
