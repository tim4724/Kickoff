/**
 * Haptic feedback utility for mobile touch interactions
 * Uses Vibration API for tactile feedback on supported devices
 */
export class HapticFeedback {
  private static isSupported = 'vibrate' in navigator

  /**
   * Light tap feedback (touch start, button press)
   * Duration: 10ms
   */
  static light(): void {
    if (!this.isSupported) return
    navigator.vibrate(10)
  }

  /**
   * Medium feedback (shoot, switch player)
   * Duration: 20ms
   */
  static medium(): void {
    if (!this.isSupported) return
    navigator.vibrate(20)
  }

  /**
   * Heavy feedback (goal scored, match end)
   * Duration: 50ms, pause 30ms, 50ms
   */
  static heavy(): void {
    if (!this.isSupported) return
    navigator.vibrate([50, 30, 50])
  }

  /**
   * Success pattern (goal for your team)
   * Pattern: rapid taps followed by longer vibration
   */
  static success(): void {
    if (!this.isSupported) return
    navigator.vibrate([20, 10, 20, 10, 40])
  }
}
