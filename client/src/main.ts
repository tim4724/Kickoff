import Phaser from 'phaser'
import { MenuScene } from './scenes/MenuScene'
import { MultiplayerScene } from './scenes/MultiplayerScene'
import { SinglePlayerScene } from './scenes/SinglePlayerScene'
import { AIOnlyScene } from './scenes/AIOnlyScene'

/**
 * Determine which scene to start based on the current URL path
 */
function getInitialScene(): string {
  const path = window.location.pathname.toLowerCase()
  
  // Check for query parameter first (for direct scene specification)
  const urlParams = new URLSearchParams(window.location.search)
  const sceneParam = urlParams.get('scene')
  if (sceneParam) {
    return sceneParam
  }
  
  // Check pathname
  if (path.includes('/singleplayer')) {
    return 'SinglePlayerScene'
  }
  if (path.includes('/multiplayer')) {
    return 'MultiplayerScene'
  }
  if (path.includes('/ai-only')) {
    return 'AIOnlyScene'
  }
  
  // Default to menu
  return 'MenuScene'
}

const initialScene = getInitialScene()

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  backgroundColor: '#1a1a1a',
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
    activePointers: 2, // Support 2 simultaneous touches minimum
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

// Start only the scene we want based on URL path
console.log(`▶️ Starting initial scene: ${initialScene}`)
game.scene.start(initialScene)

// Handle browser back/forward navigation
window.addEventListener('popstate', () => {
  const scene = getInitialScene()
  const activeScenes = game.scene.getScenes(true)
  
  // Stop all active scenes
  for (const activeScene of activeScenes) {
    game.scene.stop(activeScene.scene.key)
  }
  
  // Start the scene for the new path
  console.log(`🔄 Browser navigation: Starting scene ${scene}`)
  game.scene.start(scene)
})

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
      touch-action: manipulation;
    `

    button.addEventListener('click', () => {
      console.log('📱 Fullscreen button clicked')
      const container = document.getElementById('game-container')

      if (container && container.requestFullscreen) {
        container.requestFullscreen()
          .then(() => {
            console.log('✅ Fullscreen activated')
            splash.remove()

            // Resume the game if it was paused
            if (game && game.scene.isPaused('SinglePlayerScene')) {
              game.scene.resume('SinglePlayerScene')
            } else if (game && game.scene.isPaused('MultiplayerScene')) {
              game.scene.resume('MultiplayerScene')
            } else if (game && game.scene.isPaused('AIOnlyScene')) {
              game.scene.resume('AIOnlyScene')
            }
          })
          .catch((err) => {
            console.error('❌ Fullscreen failed:', err)
            // Remove splash anyway so user can play
            splash.remove()
          })
      } else if (container && (container as any).webkitRequestFullscreen) {
        ;(container as any).webkitRequestFullscreen()
        splash.remove()

        // Resume the game if it was paused
        if (game && game.scene.isPaused('SinglePlayerScene')) {
          game.scene.resume('SinglePlayerScene')
        } else if (game && game.scene.isPaused('MultiplayerScene')) {
          game.scene.resume('MultiplayerScene')
        } else if (game && game.scene.isPaused('AIOnlyScene')) {
          game.scene.resume('AIOnlyScene')
        }
      } else {
        console.warn('⚠️ Fullscreen not supported')
        splash.remove()
      }
    })

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
;(window as any).game = game

console.log('🎮 Kickoff initialized!')
