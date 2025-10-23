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
  '/multiplayer': 'GameScene',
  '/ai-only': 'AIOnlyScene',
} as const

type RoutePath = keyof typeof ROUTES
type SceneKey = (typeof ROUTES)[RoutePath]

export class SceneRouter {
  private game: Phaser.Game | null = null
  private isNavigating = false
  private currentPath: RoutePath = '/menu'

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
    const hash = window.location.hash.slice(1) || '/menu'
    const path = this.normalizePath(hash)

    console.log(`[SceneRouter] Initial route: ${hash} -> ${path}`)

    // Update URL if normalized path differs
    if (hash !== path) {
      window.location.hash = path
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
    const currentScene = this.getActiveScene()

    // Check if scene is already active
    if (currentScene && currentScene.scene.key === sceneKey) {
      console.log(`[SceneRouter] Scene ${sceneKey} already active, skipping`)
      this.currentPath = path
      return
    }

    console.log(`[SceneRouter] Navigating: ${this.currentPath} -> ${path} (${sceneKey})`)

    // Update current path
    this.currentPath = path

    // Start the new scene
    if (currentScene) {
      currentScene.scene.start(sceneKey)
    } else {
      // No scene running yet, start the target scene
      this.game.scene.start(sceneKey)
    }
  }

  /**
   * Get the currently active Phaser scene instance
   */
  private getActiveScene(): Phaser.Scene | null {
    if (!this.game) {
      return null
    }

    // Get all active scenes
    const activeScenes = this.game.scene.getScenes(true)

    // Return the first active scene (should only be one game scene active)
    return activeScenes.length > 0 ? activeScenes[0] : null
  }

  /**
   * Programmatically navigate to a scene by name
   * Updates the URL and transitions to the scene
   *
   * @param sceneName - Phaser scene key (e.g., 'MenuScene', 'GameScene')
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
    return this.currentPath
  }

  /**
   * Get the current scene key
   */
  public getCurrentScene(): SceneKey {
    return ROUTES[this.currentPath]
  }
}

// Export singleton instance
export const sceneRouter = new SceneRouter()
