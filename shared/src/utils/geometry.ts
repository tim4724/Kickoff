/**
 * Geometry utility functions for game calculations
 */

export interface Point {
  x: number
  y: number
}

/**
 * Geometry utilities for common game math operations
 */
export class GeometryUtils {
  /**
   * Calculate Euclidean distance between two points
   */
  static distance(p1: Point, p2: Point): number {
    const dx = p2.x - p1.x
    const dy = p2.y - p1.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  /**
   * Normalize a vector to unit length
   */
  static normalize(vec: Point): Point {
    const length = Math.sqrt(vec.x * vec.x + vec.y * vec.y)
    return length > 0
      ? { x: vec.x / length, y: vec.y / length }
      : { x: 0, y: 0 }
  }

  /**
   * Clamp a value between min and max
   */
  static clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value))
  }

  /**
   * Linear interpolation between two values
   */
  static lerp(start: number, end: number, factor: number): number {
    return start + (end - start) * factor
  }

  /**
   * Calculate direction angle from one point to another (in radians)
   */
  static angleBetween(from: Point, to: Point): number {
    return Math.atan2(to.y - from.y, to.x - from.x)
  }

  /**
   * Calculate the squared distance (faster when you don't need the actual distance)
   */
  static distanceSquared(p1: Point, p2: Point): number {
    const dx = p2.x - p1.x
    const dy = p2.y - p1.y
    return dx * dx + dy * dy
  }
}
