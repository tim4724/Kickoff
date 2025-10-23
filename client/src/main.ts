import Phaser from 'phaser'
import { MenuScene } from './scenes/MenuScene'
import { GameScene } from './scenes/GameScene'
import { SinglePlayerScene } from './scenes/SinglePlayerScene'
import { AIOnlyScene } from './scenes/AIOnlyScene'
import { sceneRouter } from './utils/SceneRouter'

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
  scene: [MenuScene, GameScene, SinglePlayerScene, AIOnlyScene],
}

// Remove loading text
const loading = document.getElementById('loading')
if (loading) {
  loading.remove()
}

// Initialize game
const game = new Phaser.Game(config)

// Initialize scene router for URL navigation
sceneRouter.init(game)

// Mobile optimizations
if ('ontouchstart' in window) {
  // Prevent pull-to-refresh
  document.body.style.overscrollBehavior = 'none'

  // Request fullscreen on first touch
  let fullscreenRequested = false
  document.addEventListener('touchstart', () => {
    if (!fullscreenRequested && document.documentElement.requestFullscreen) {
      fullscreenRequested = true
      document.documentElement.requestFullscreen()
        .then(() => {
          console.log('Fullscreen activated')
          // Lock to landscape after fullscreen is active
          if (screen.orientation && 'lock' in screen.orientation) {
            const orientationLock = (screen.orientation as any).lock('landscape')
            if (orientationLock && orientationLock.then) {
              orientationLock
                .then(() => {
                  console.log('Orientation locked to landscape')
                })
                .catch((err: any) => {
                  console.log('Orientation lock not supported:', err)
                })
            }
          } else {
            console.log('Screen Orientation API not supported')
          }
        })
        .catch(() => {
          console.log('Fullscreen request declined')
        })
    }
  }, { once: true })
}

// Prevent context menu on right click (mobile)
window.addEventListener('contextmenu', (e) => e.preventDefault())

// RESIZE mode with dual camera setup in GameScene handles viewport management

// Export for debugging
;(window as any).game = game

console.log('🎮 Kickoff initialized!')
