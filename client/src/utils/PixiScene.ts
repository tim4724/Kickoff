import { Application, Container } from 'pixi.js';

/**
 * Abstract Base Class for PixiJS Scenes.
 * Mimics Phaser's Scene lifecycle.
 */
export abstract class PixiScene {
  public app: Application;
  public container: Container;
  public sceneKey: string;
  protected sceneManager: any; // We'll define the type properly later

  constructor(app: Application, key: string, sceneManager: any) {
    this.app = app;
    this.sceneKey = key;
    this.sceneManager = sceneManager;
    this.container = new Container();
  }

  /**
   * Called when the scene is initialized.
   * Can be used for async asset loading.
   */
  public async init(): Promise<void> {
    // Override in subclass
  }

  /**
   * Called when the scene is started.
   * Add objects to this.container here.
   */
  public async create(): Promise<void> {
    // Override in subclass
  }

  /**
   * Called every frame.
   * @param delta - Time since last frame (in Pixi units, usually close to 1)
   */
  public update(_delta: number): void {
    // Override in subclass
  }

  /**
   * Called when the scene is resized.
   * @param width
   * @param height
   */
  public resize(_width: number, _height: number): void {
    // Override in subclass
  }

  /**
   * Called when the scene is stopped/swapped out.
   * Clean up listeners, objects, etc.
   */
  public destroy(): void {
    this.container.destroy({ children: true });
  }
}
