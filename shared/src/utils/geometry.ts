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
  static distancePoint(p1: Point, p2: Point): number {
    const dx = p2.x - p1.x
    const dy = p2.y - p1.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  static distanceScalar(x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1
    const dy = y2 - y1
    return Math.sqrt(dx * dx + dy * dy)
  }

  /**
   * Calculate magnitude (length) of a vector
   */
  static magnitudeScalar(x: number, y: number): number {
    return Math.sqrt(x * x + y * y)
  }

  static magnitudePoint(p: Point): number {
    return Math.sqrt(p.x * p.x + p.y * p.y)
  }

  /**
   * Normalize a vector to unit length
   */
  static normalizePoint(vec: Point): Point {
    const length = Math.sqrt(vec.x * vec.x + vec.y * vec.y)
    return length > 0 ? { x: vec.x / length, y: vec.y / length } : { x: 0, y: 0 }
  }

  static normalizeScalar(x: number, y: number): Point {
    const length = Math.sqrt(x * x + y * y)
    return length > 0 ? { x: x / length, y: y / length } : { x: 0, y: 0 }
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
  static distanceSquaredPoint(p1: Point, p2: Point): number {
    const dx = p2.x - p1.x
    const dy = p2.y - p1.y
    return dx * dx + dy * dy
  }

  static distanceSquaredScalar(x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1
    const dy = y2 - y1
    return dx * dx + dy * dy
  }
}
