
/**
 * SceneRouter - URL routing system for Socca2 game
 * Enables browser back/forward navigation and deep linking to game scenes
 *
 * Features:
 * - Hash-based routing (#/menu, #/singleplayer, #/multiplayer, #/ai-only)
 * - Browser history integration (back/forward buttons work)
 * - Programmatic navigation with URL updates
 * - Initial page load routing
 * - Prevents redundant scene transitions
 */

import Phaser from 'phaser'

/**
 * Route configuration mapping URL hash paths to Phaser scene keys
 */
const ROUTES = {
  '/menu': 'MenuScene',
  '/singleplayer': 'SinglePlayerScene',
  '/multiplayer': 'MultiplayerScene',
  '/ai-only': 'AIOnlyScene',
} as const

type RoutePath = keyof typeof ROUTES
type SceneKey = (typeof ROUTES)[RoutePath]

export class SceneRouter {
  private game: Phaser.Game | null = null
  private isNavigating = false
  private currentPath: RoutePath | null = null

  /**
   * Initialize the router with the Phaser game instance
   * Sets up event listeners for browser navigation
   */
  public init(game: Phaser.Game): void {
    this.game = game
    console.log('[SceneRouter] Initializing router')

    // Listen to hash changes (back/forward buttons, manual URL edits)
    window.addEventListener('hashchange', this.handleHashChange.bind(this))

    // Listen to popstate for additional browser navigation support
    window.addEventListener('popstate', this.handlePopState.bind(this))

    // Handle initial page load routing
    this.handleInitialRoute()
  }

  /**
   * Handle initial page load - navigate to correct scene based on URL hash
   */
  private handleInitialRoute(): void {
    const originalHash = window.location.hash.slice(1)
    const hash = originalHash || '/menu'
    const path = this.normalizePath(hash)

    console.log(`[SceneRouter] Initial route check: raw="${originalHash}", hash="${hash}", normalized="${path}"`)

    // Update URL if there was no hash OR if normalized path differs
    // This must happen synchronously so tests can verify the URL immediately
    if (!originalHash || hash !== path) {
      console.log(`[SceneRouter] Redirecting invalid/empty route: "${hash}" -> "${path}"`)
      console.log(`[SceneRouter] Calling window.location.replace('#${path}')`)
      window.location.replace('#' + path)
      console.log(`[SceneRouter] Post-replace hash: "${window.location.hash}"`)
    }

    // Navigate to the initial scene
    this.navigateToPath(path)
  }

  /**
   * Handle browser hash changes (back/forward buttons)
   */
  private handleHashChange(): void {
    if (this.isNavigating) {
      return // Ignore hash changes we triggered ourselves
    }

    const hash = window.location.hash.slice(1) || '/menu'
    const path = this.normalizePath(hash)

    console.log(`[SceneRouter] Hash changed: ${hash} -> ${path}`)

    // If hash was invalid/normalized, correct the URL
    if (hash !== path) {
      console.log(`[SceneRouter] Correcting invalid hash: "${hash}" -> "${path}"`)
      window.location.replace('#' + path)
      return // The replace will trigger another hashchange
    }

    this.navigateToPath(path)
  }

  /**
   * Handle browser popstate events (additional navigation support)
   */
  private handlePopState(): void {
    if (this.isNavigating) {
      return
    }

    const hash = window.location.hash.slice(1) || '/menu'
    const path = this.normalizePath(hash)

    console.log(`[SceneRouter] Popstate: ${hash} -> ${path}`)

    // If hash was invalid/normalized, correct the URL
    if (hash !== path) {
      console.log(`[SceneRouter] Correcting invalid popstate: "${hash}" -> "${path}"`)
      window.location.replace('#' + path)
      return // The replace will trigger hashchange
    }

    this.navigateToPath(path)
  }

  /**
   * Normalize path to valid route (default to /menu if invalid)
   */
  private normalizePath(path: string): RoutePath {
    // Remove leading/trailing slashes and normalize
    const normalized = `/${path.replace(/^\/+|\/+$/g, '')}`

    // Check if it's a valid route
    if (normalized in ROUTES) {
      return normalized as RoutePath
    }

    console.warn(`[SceneRouter] Invalid path: ${path}, defaulting to /menu`)
    return '/menu'
  }

  /**
   * Navigate to a path (internal method)
   */
  private navigateToPath(path: RoutePath): void {
    if (!this.game) {
      console.error('[SceneRouter] Cannot navigate - game not initialized')
      return
    }

    // Check if already on this path
    if (this.currentPath === path) {
      console.log(`[SceneRouter] Already on ${path}, skipping navigation`)
      return
    }

    const sceneKey = ROUTES[path]

    console.log(`[SceneRouter] Navigating: ${this.currentPath} -> ${path} (${sceneKey})`)

    // Update current path
    this.currentPath = path

    // Get ALL currently active scenes (there might be multiple due to scene overlap)
    const activeScenes = this.game.scene.getScenes(true)

    // Check if target scene is already running AND it's the only active scene
    const targetScene = this.game.scene.getScene(sceneKey)
    const targetIsRunning = targetScene && targetScene.scene.isActive()
    const onlyTargetActive = activeScenes.length === 1 && targetIsRunning

    if (onlyTargetActive) {
      console.log(`[SceneRouter] Scene ${sceneKey} is already the only active scene, skipping`)
      return
    }

    // Optimization: If no scenes are active (initial load), start immediately without delay
    if (activeScenes.length === 0) {
      console.log(`[SceneRouter] No active scenes, starting ${sceneKey} immediately`)
      // Check if scene was created before (unlikely for empty active list but possible if manually stopped)
      const targetAfterStop = this.game!.scene.getScene(sceneKey)
      const wasCreated = targetAfterStop &&
        (targetAfterStop.scene.settings.status === Phaser.Scenes.SHUTDOWN ||
          targetAfterStop.scene.settings.status === Phaser.Scenes.DESTROYED)

      if (wasCreated) {
        targetAfterStop.scene.restart()
      } else {
        this.game!.scene.start(sceneKey)
      }
      return
    }

    // Stop ALL active scenes (including target scene to ensure clean restart)
    for (const scene of activeScenes) {
      const key = scene.scene.key
      console.log(`[SceneRouter] Stopping scene: ${key}`)
      this.game.scene.stop(key)

      // Clear test APIs immediately when stopping scenes
      // (shutdown() is called asynchronously on next frame, so we do this now)
      if (typeof window !== 'undefined') {
        // Clear game scene test API
        if ((window as any).__gameControls?.scene === scene) {
          console.log('🧹 Clearing __gameControls test API (scene stopping)')
          delete (window as any).__gameControls
        }
        // Clear menu scene test API
        if (key === 'MenuScene' && (window as any).__menuLoaded) {
          console.log('🧹 Clearing __menuLoaded flag (MenuScene stopping)')
            ; (window as any).__menuLoaded = false
          delete (window as any).__menuButtons
        }
      }
    }

    // Small delay to ensure scenes are fully stopped and test APIs are cleared
    // This prevents scene overlap issues in tests
    // Using setTimeout with 0ms still allows event loop to process scene shutdown
    setTimeout(() => {
      // Always use restart() if target scene has been created before, otherwise use start()
      // Check if scene exists in the scene manager (was created before)
      const targetAfterStop = this.game!.scene.getScene(sceneKey)
      // A scene that exists but isn't active has status SHUTDOWN or DESTROYED
      const wasCreated =
        targetAfterStop &&
        (targetAfterStop.scene.settings.status === Phaser.Scenes.SHUTDOWN ||
          targetAfterStop.scene.settings.status === Phaser.Scenes.DESTROYED)

      if (wasCreated) {
        // Scene was created before - use restart() to force create() to run again
        console.log(`[SceneRouter] Restarting scene: ${sceneKey}`)
        targetAfterStop.scene.restart()
      } else {
        // Scene never started - use start()
        console.log(`[SceneRouter] Starting scene for first time: ${sceneKey}`)
        this.game!.scene.start(sceneKey)
      }
    }, 0)
  }


  /**
   * Programmatically navigate to a scene by name
   * Updates the URL and transitions to the scene
   *
   * @param sceneName - Phaser scene key (e.g., 'MenuScene', 'MultiplayerScene')
   */
  public navigateTo(sceneName: SceneKey): void {
    if (!this.game) {
      console.error('[SceneRouter] Cannot navigate - game not initialized')
      return
    }

    // Find the path for this scene
    const path = this.getPathForScene(sceneName)
    if (!path) {
      console.error(`[SceneRouter] No route found for scene: ${sceneName}`)
      return
    }

    console.log(`[SceneRouter] navigateTo(${sceneName}) -> ${path}`)

    // Set flag to prevent hashchange handler from interfering
    this.isNavigating = true

    // Update URL hash
    window.location.hash = path

    // Navigate to the path
    this.navigateToPath(path)

    // Reset flag after navigation
    this.isNavigating = false
  }

  /**
   * Get the route path for a given scene key
   */
  private getPathForScene(sceneName: SceneKey): RoutePath | null {
    for (const [path, scene] of Object.entries(ROUTES)) {
      if (scene === sceneName) {
        return path as RoutePath
      }
    }
    return null
  }

  /**
   * Get the current route path
   */
  public getCurrentPath(): RoutePath {
    return this.currentPath || '/menu'
  }

  /**
   * Get the current scene key
   */
  public getCurrentScene(): SceneKey {
    return ROUTES[this.currentPath || '/menu']
  }
}

// Export singleton instance
export const sceneRouter = new SceneRouter()
