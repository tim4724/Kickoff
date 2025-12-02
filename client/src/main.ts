import { Application, Graphics } from 'pixi.js'
import { MenuScene } from './scenes/MenuScene'
import { MultiplayerScene } from './scenes/MultiplayerScene'
import { SinglePlayerScene } from './scenes/SinglePlayerScene'
import { AIOnlyScene } from './scenes/AIOnlyScene'
import { PixiSceneManager } from './utils/PixiSceneManager'
import { sceneRouter } from './utils/SceneRouter'

// Initialize PixiJS App
const app = new Application()

async function init() {
    await app.init({
        resizeTo: window,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        backgroundColor: 0x1a1a1a,
        antialias: true,
    });

    const container = document.getElementById('game-container')
    if (container) {
        container.appendChild(app.canvas)
    }

    // Remove loading text
    const loading = document.getElementById('loading')
    if (loading) {
        loading.remove()
    }

    // Initialize Scene Manager
    const sceneManager = new PixiSceneManager(app)

    // Register Scenes
    // Note: We need to update these scenes to inherit from PixiScene first.
    // Casting them as any for now to avoid compilation errors while migrating.
    sceneManager.register('MenuScene', MenuScene as any)
    sceneManager.register('MultiplayerScene', MultiplayerScene as any)
    sceneManager.register('SinglePlayerScene', SinglePlayerScene as any)
    sceneManager.register('AIOnlyScene', AIOnlyScene as any)

    // Initialize router
    sceneRouter.init(sceneManager)

    // Export for debugging
    ; (window as any).game = app;
    ; (window as any).sceneManager = sceneManager;
    console.log(app); // Ensure app is used

    console.log('🎮 Kickoff (PixiJS) initialized!')

    // Mobile optimizations
    if ('ontouchstart' in window) {
        document.body.style.overscrollBehavior = 'none'
        // Fullscreen splash logic needs adaptation if it relies on DOM overlays that were interfering with Canvas.
        // For now, keeping the logic mostly DOM based is fine as it overlays the canvas.
        setupFullscreenSplash(app);
    }
}

// Function to setup fullscreen splash - migrated from main.ts
function setupFullscreenSplash(_app: Application) {
    const createFullscreenSplash = () => {
        const splash = document.createElement('div')
        splash.id = 'fullscreen-splash'
        splash.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.95);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          color: white;
          font-family: Arial, sans-serif;
          text-align: center;
          padding: 20px;
        `

        // Add a transparent blocker to PixiJS stage to prevent interaction with the game
        // while the splash is up. This captures all pointer events on the canvas.
        const blocker = new Graphics()
        blocker.rect(-10000, -10000, 20000, 20000).fill({ color: 0x000000, alpha: 0.01 })
        blocker.eventMode = 'static'
        blocker.zIndex = 999999
        _app.stage.addChild(blocker)

        const cleanupSplash = () => {
            splash.remove()
            blocker.destroy()
        }

        const title = document.createElement('div')
        title.textContent = 'KICKOFF'
        title.style.cssText = `
          font-size: 48px;
          font-weight: bold;
          margin-bottom: 40px;
        `

        const button = document.createElement('button')
        button.textContent = 'TAP TO ENTER FULLSCREEN'
        button.style.cssText = `
          background: #0066ff;
          color: white;
          border: none;
          padding: 20px 40px;
          font-size: 20px;
          font-weight: bold;
          border-radius: 8px;
          cursor: pointer;
          touch-action: none;
        `

        const stopSplashEvents = (ev: Event) => {
          ev.stopPropagation()
          ev.preventDefault()
        }
        splash.addEventListener('pointerdown', stopSplashEvents, { capture: true })
        splash.addEventListener('pointerup', stopSplashEvents, { capture: true })
        splash.addEventListener('click', stopSplashEvents, { capture: true })

        const requestFs = (ev?: Event) => {
          ev?.stopPropagation()
          ev?.preventDefault()
          console.log('📱 Fullscreen button clicked')
          const container = document.getElementById('game-container')
          if (!container) {
            cleanupSplash()
            return
          }

          const onSuccess = () => {
            console.log('✅ Fullscreen activated')
            cleanupSplash()
            // Resume logic here if we had pausing
          }

          const onFail = (err: unknown) => {
            console.error('❌ Fullscreen failed:', err)
            cleanupSplash()
          }

          if (container.requestFullscreen) {
            container.requestFullscreen().then(onSuccess).catch(onFail)
          } else if ((container as any).webkitRequestFullscreen) {
            ; (container as any).webkitRequestFullscreen()
            onSuccess()
          } else {
            console.warn('⚠️ Fullscreen not supported')
            onFail('not supported')
          }
        }

        button.addEventListener('click', requestFs, { capture: true })
        button.addEventListener('pointerup', requestFs, { capture: true })
        button.addEventListener('touchend', requestFs, { capture: true })
        button.addEventListener('mouseup', requestFs, { capture: true })

        splash.appendChild(title)
        splash.appendChild(button)
        document.body.appendChild(splash)
    }

    // Show splash after game loads
    setTimeout(createFullscreenSplash, 100)

    // Detect when user exits fullscreen and show splash again
    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
            console.log('👋 User exited fullscreen - showing splash')
            createFullscreenSplash()
        }
    })
}

// Prevent context menu on right click (mobile)
window.addEventListener('contextmenu', (e) => e.preventDefault())

init();
