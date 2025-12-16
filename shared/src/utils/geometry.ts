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
  static distance(p1: Point, p2: Point): number
  static distance(x1: number, y1: number, x2: number, y2: number): number
  static distance(a: Point | number, b: Point | number, c?: number, d?: number): number {
    if (typeof a === 'number') {
      const dx = (c as number) - a
      const dy = (d as number) - (b as number)
      return Math.sqrt(dx * dx + dy * dy)
    } else {
      const p1 = a as Point
      const p2 = b as Point
      const dx = p2.x - p1.x
      const dy = p2.y - p1.y
      return Math.sqrt(dx * dx + dy * dy)
    }
  }

  /**
   * Calculate magnitude (length) of a vector
   */
  static magnitude(x: number, y: number): number {
    return Math.sqrt(x * x + y * y)
  }

  /**
   * Normalize a vector to unit length
   */
  static normalize(vec: Point): Point
  static normalize(x: number, y: number): Point
  static normalize(a: Point | number, b?: number): Point {
    let x: number, y: number
    if (typeof a === 'number') {
      x = a
      y = b as number
    } else {
      x = (a as Point).x
      y = (a as Point).y
    }
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
  static distanceSquared(p1: Point, p2: Point): number
  static distanceSquared(x1: number, y1: number, x2: number, y2: number): number
  static distanceSquared(a: Point | number, b: Point | number, c?: number, d?: number): number {
    if (typeof a === 'number') {
      const dx = (c as number) - a
      const dy = (d as number) - (b as number)
      return dx * dx + dy * dy
    } else {
      const p1 = a as Point
      const p2 = b as Point
      const dx = p2.x - p1.x
      const dy = p2.y - p1.y
      return dx * dx + dy * dy
    }
  }
}
