import Phaser from 'phaser'
import { GameScene } from './scenes/GameScene'

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
  scene: [GameScene],
}

// Remove loading text
const loading = document.getElementById('loading')
if (loading) {
  loading.remove()
}

// Initialize game
const game = new Phaser.Game(config)

// Mobile optimizations
if ('ontouchstart' in window) {
  // Prevent pull-to-refresh
  document.body.style.overscrollBehavior = 'none'

  // Request fullscreen on first touch
  let fullscreenRequested = false
  document.addEventListener('touchstart', () => {
    if (!fullscreenRequested && document.documentElement.requestFullscreen) {
      fullscreenRequested = true
      document.documentElement.requestFullscreen().catch(() => {
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

console.log('🎮 Socca2 initialized!')
