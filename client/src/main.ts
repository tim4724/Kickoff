import { Application, Graphics } from 'pixi.js'
import { MenuScene } from './scenes/MenuScene'
import { LobbyScene } from './scenes/LobbyScene'
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
    sceneManager.register('LobbyScene', LobbyScene as any)
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

// Detect if running as installed PWA (standalone mode)
function isStandalone(): boolean {
    return (window.navigator as any).standalone === true ||
        window.matchMedia('(display-mode: standalone)').matches
}

// Detect iOS device
function isIOS(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

// Detect iPad specifically
function isIPad(): boolean {
    return /iPad/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

// Function to setup fullscreen splash - migrated from main.ts
function setupFullscreenSplash(_app: Application) {
    // Don't show splash if already running as PWA
    if (isStandalone()) {
        console.log('📱 Running as PWA - skipping fullscreen splash')
        return
    }

    const createFullscreenSplash = () => {
        // Don't create if already exists
        if (document.getElementById('fullscreen-splash')) return

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

        // iOS: Show PWA install instructions modal (fullscreen API not supported)
        if (isIOS()) {
            // Create modal overlay (clicking dismisses)
            const overlay = document.createElement('div')
            overlay.style.cssText = `
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
            `
            overlay.addEventListener('click', (ev) => {
                ev.stopPropagation()
                cleanupSplash()
            }, { capture: true })

            // Modal content box
            const modal = document.createElement('div')
            modal.style.cssText = `
              background: #2a2a2a;
              border-radius: 16px;
              padding: 24px;
              max-width: 320px;
              position: relative;
              box-shadow: 0 4px 24px rgba(0,0,0,0.5);
            `
            modal.addEventListener('click', (ev) => ev.stopPropagation(), { capture: true })

            // Close button
            const closeBtn = document.createElement('button')
            closeBtn.innerHTML = '&times;'
            closeBtn.style.cssText = `
              position: absolute;
              top: 12px;
              right: 12px;
              background: none;
              border: none;
              color: #888;
              font-size: 28px;
              cursor: pointer;
              padding: 0;
              line-height: 1;
            `
            closeBtn.addEventListener('click', (ev) => {
                ev.stopPropagation()
                cleanupSplash()
            }, { capture: true })

            // Title
            const modalTitle = document.createElement('h2')
            modalTitle.textContent = 'Kickoff'
            modalTitle.style.cssText = `
              margin: 0 0 4px 0;
              font-size: 28px;
              font-weight: bold;
            `

            // Subtitle
            const modalSubtitle = document.createElement('p')
            modalSubtitle.textContent = 'Fullscreen Experience'
            modalSubtitle.style.cssText = `
              margin: 0 0 20px 0;
              font-size: 14px;
              color: #888;
            `

            // Steps list
            const steps = document.createElement('ol')
            steps.style.cssText = `
              list-style: none;
              padding: 0;
              margin: 0;
            `

            // SVG Icons
            const shareIconSvg = `<svg fill="currentColor" stroke="currentColor" stroke-width="1.2" width="24" height="24" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
              <path d="M30.3 13.7L25 8.4l-5.3 5.3-1.4-1.4L25 5.6l6.7 6.7z"/>
              <path d="M24 7h2v21h-2z"/>
              <path d="M35 40H15c-1.7 0-3-1.3-3-3V19c0-1.7 1.3-3 3-3h7v2h-7c-.6 0-1 .4-1 1v18c0 .6.4 1 1 1h20c.6 0 1-.4 1-1V19c0-.6-.4-1-1-1h-7v-2h7c1.7 0 3 1.3 3 3v18c0 1.7-1.3 3-3 3z"/>
            </svg>`

            const moreIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
              <circle cx="6" cy="12" r="1.5" fill="currentColor"/>
              <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
              <circle cx="18" cy="12" r="1.5" fill="currentColor"/>
            </svg>`

            const addIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
              <rect x="4" y="4" width="16" height="16" rx="4" fill="none" stroke="currentColor" stroke-width="1.5"/>
              <line x1="12" y1="8" x2="12" y2="16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              <line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>`

            // Different steps for iPad vs iPhone
            const stepData = isIPad() ? [
                { icon: shareIconSvg, text: 'Tap Share' },
                { icon: moreIconSvg, text: 'More' },
                { icon: addIconSvg, text: 'Add to Home Screen' },
                { icon: null, text: 'Tap Add' },
                { icon: null, text: 'Open from Home Screen' },
            ] : [
                { icon: moreIconSvg, text: 'Tap Menu' },
                { icon: shareIconSvg, text: 'Share' },
                { icon: null, text: 'Scroll down' },
                { icon: addIconSvg, text: 'Add to Home Screen' },
                { icon: null, text: 'Tap Add' },
                { icon: null, text: 'Open from Home Screen' },
            ]

            stepData.forEach((step, i) => {
                const li = document.createElement('li')
                li.style.cssText = `
                  display: flex;
                  align-items: center;
                  margin-bottom: 16px;
                  font-size: 16px;
                `

                const num = document.createElement('span')
                num.textContent = String(i + 1)
                num.style.cssText = `
                  background: #0066ff;
                  color: white;
                  width: 28px;
                  height: 28px;
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-weight: bold;
                  font-size: 14px;
                  flex-shrink: 0;
                  margin-right: 12px;
                `

                const content = document.createElement('div')
                content.style.cssText = `display: flex; align-items: center; gap: 8px;`
                if (step.icon) {
                    const iconSpan = document.createElement('span')
                    iconSpan.innerHTML = step.icon
                    iconSpan.style.cssText = `display: flex; color: #0066ff;`
                    content.appendChild(iconSpan)
                }
                const textSpan = document.createElement('span')
                textSpan.textContent = step.text
                content.appendChild(textSpan)

                li.appendChild(num)
                li.appendChild(content)
                steps.appendChild(li)
            })

            modal.appendChild(closeBtn)
            modal.appendChild(modalTitle)
            modal.appendChild(modalSubtitle)
            modal.appendChild(steps)
            splash.appendChild(overlay)
            splash.appendChild(modal)
        } else {
            // Non-iOS: Show fullscreen button with title
            const title = document.createElement('div')
            title.textContent = 'KICKOFF'
            title.style.cssText = `
              font-size: 48px;
              font-weight: bold;
              margin-bottom: 40px;
            `
            splash.appendChild(title)

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
                }

                const onFail = (err: unknown) => {
                    console.error('❌ Fullscreen failed:', err)
                    cleanupSplash()
                }

                if (container.requestFullscreen) {
                    container.requestFullscreen().then(onSuccess).catch(onFail)
                } else if ((container as any).webkitRequestFullscreen) {
                    ;(container as any).webkitRequestFullscreen()
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

            splash.appendChild(button)
        }

        const stopSplashEvents = (ev: Event) => {
            ev.stopPropagation()
            ev.preventDefault()
        }
        splash.addEventListener('pointerdown', stopSplashEvents, { capture: true })
        splash.addEventListener('pointerup', stopSplashEvents, { capture: true })
        splash.addEventListener('click', stopSplashEvents, { capture: true })

        document.body.appendChild(splash)
    }

    // Show splash after game loads
    setTimeout(createFullscreenSplash, 100)

    // Detect when user exits fullscreen and show splash again (non-iOS only)
    if (!isIOS()) {
        document.addEventListener('fullscreenchange', () => {
            if (!document.fullscreenElement) {
                console.log('👋 User exited fullscreen - showing splash')
                createFullscreenSplash()
            }
        })
    }
}

// Prevent context menu on right click (mobile)
window.addEventListener('contextmenu', (e) => e.preventDefault())

init();
