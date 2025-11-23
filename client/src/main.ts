
import Phaser from 'phaser'
import { MenuScene } from './scenes/MenuScene'
import { MultiplayerScene } from './scenes/MultiplayerScene'
import { SinglePlayerScene } from './scenes/SinglePlayerScene'
import { AIOnlyScene } from './scenes/AIOnlyScene'


const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  backgroundColor: '#1a1a1a',
  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: false,
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight,
    fullscreenTarget: 'game-container',
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  input: {
    // Enable multi-touch for simultaneous joystick + action button
    activePointers: 3, // Support 3 simultaneous touches (joystick + action + spare)
  },
  // Don't auto-start any scene - we'll manually register and start the one we need
  scene: [],
}

// Remove loading text
const loading = document.getElementById('loading')
if (loading) {
  loading.remove()
}

// Initialize game
const game = new Phaser.Game(config)

// Manually register all scenes (prevents auto-start)
game.scene.add('MenuScene', MenuScene)
game.scene.add('MultiplayerScene', MultiplayerScene)
game.scene.add('SinglePlayerScene', SinglePlayerScene)
game.scene.add('AIOnlyScene', AIOnlyScene)



// Initialize router to handle navigation
import { sceneRouter } from './utils/SceneRouter'
sceneRouter.init(game)

// Mobile optimizations
if ('ontouchstart' in window) {
  // Prevent pull-to-refresh
  document.body.style.overscrollBehavior = 'none'

  // Create fullscreen splash overlay
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

    // Prevent splash background events from reaching the canvas/menu underneath
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
        splash.remove()
        return
      }
      const restorePointerEvents = () => {
        container.style.pointerEvents = ''
      }

      // While splash is visible, disable pointer events on the game container so nothing underneath receives input
      container.style.pointerEvents = 'none'

      const onSuccess = () => {
        console.log('✅ Fullscreen activated')
        splash.remove()
        restorePointerEvents()
        // Resume the game if it was paused
        if (game && game.scene.isPaused('SinglePlayerScene')) {
          game.scene.resume('SinglePlayerScene')
        } else if (game && game.scene.isPaused('MultiplayerScene')) {
          game.scene.resume('MultiplayerScene')
        } else if (game && game.scene.isPaused('AIOnlyScene')) {
          game.scene.resume('AIOnlyScene')
        }
      }

      const onFail = (err: unknown) => {
        console.error('❌ Fullscreen failed:', err)
        splash.remove()
        restorePointerEvents()
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
  window.addEventListener('load', () => {
    setTimeout(createFullscreenSplash, 100)
  })

  // Detect when user exits fullscreen and show splash again
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
      console.log('👋 User exited fullscreen - pausing game and showing splash')

      // Pause the game
      if (game && game.scene.isActive('SinglePlayerScene')) {
        game.scene.pause('SinglePlayerScene')
      } else if (game && game.scene.isActive('MultiplayerScene')) {
        game.scene.pause('MultiplayerScene')
      } else if (game && game.scene.isActive('AIOnlyScene')) {
        game.scene.pause('AIOnlyScene')
      }

      // Show splash again
      createFullscreenSplash()
    }
  })
}

// Prevent context menu on right click (mobile)
window.addEventListener('contextmenu', (e) => e.preventDefault())

  // RESIZE mode with dual camera setup in MultiplayerScene handles viewport management

  // Export for debugging
  ; (window as any).game = game

console.log('🎮 Kickoff initialized!')
