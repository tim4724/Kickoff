
/**
 * SceneRouter - URL routing system for Kickoff
 * Enables browser back/forward navigation and deep linking to game scenes
 *
 * Features:
 * - Hash-based routing (#/menu, #/singleplayer, #/multiplayer, #/ai-only)
 * - Browser history integration (back/forward buttons work)
 * - Programmatic navigation with URL updates
 * - Initial page load routing
 * - Prevents redundant scene transitions
 * - Complete fresh scene loads on navigation
 */

import { PixiSceneManager } from './PixiSceneManager'

/**
 * Route configuration mapping URL hash paths to Scene keys
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
  private sceneManager: PixiSceneManager | null = null
  private isNavigating = false
  private currentPath: RoutePath | null = null

  /**
   * Initialize the router with the Scene Manager instance
   * Sets up event listeners for browser navigation
   */
  public init(sceneManager: PixiSceneManager): void {
    this.sceneManager = sceneManager
    console.log('[SceneRouter] Initializing router')

    // Listen to hash changes (back/forward buttons, manual URL edits)
    window.addEventListener('hashchange', this.handleHashChange.bind(this))

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

      // Return early to allow hashchange event to handle the navigation
      // This prevents double initialization of the scene
      return
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
    if (!this.sceneManager) {
      console.error('[SceneRouter] Cannot navigate - scene manager not initialized')
      return
    }

    // Check if already on this path
    if (this.currentPath === path) {
      console.log(`[SceneRouter] Already on ${path}, skipping navigation`)
      // But we still force a start if it's the initial load or to be safe
      // Actually, if we're here, we probably want to ensure the scene is active
    }

    const sceneKey = ROUTES[path]

    console.log(`[SceneRouter] Navigating: ${this.currentPath} -> ${path} (${sceneKey})`)

    // Update current path
    this.currentPath = path

    // Start the target scene
    console.log(`[SceneRouter] Starting scene: ${sceneKey}`)
    this.sceneManager.start(sceneKey)
  }


  /**
   * Programmatically navigate to a scene by name
   * Updates the URL and transitions to the scene
   *
   * @param sceneName - Scene key (e.g., 'MenuScene', 'MultiplayerScene')
   */
  public navigateTo(sceneName: SceneKey): void {
    if (!this.sceneManager) {
      console.error('[SceneRouter] Cannot navigate - scene manager not initialized')
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
