import { Application } from 'pixi.js';
import { PixiScene } from './PixiScene';

export class PixiSceneManager {
  private app: Application;
  private scenes: Map<string, new (app: Application, key: string, manager: PixiSceneManager) => PixiScene> = new Map();
  private currentScene: PixiScene | null = null;

  constructor(app: Application) {
    this.app = app;
    this.app.ticker.add(this.update, this);

    // Listen for resize events on the window
    window.addEventListener('resize', this.resize.bind(this));
  }

  public register(key: string, sceneClass: new (app: Application, key: string, manager: PixiSceneManager) => PixiScene): void {
    this.scenes.set(key, sceneClass);
  }

  public async start(key: string): Promise<void> {
    const SceneClass = this.scenes.get(key);
    if (!SceneClass) {
      console.error(`Scene '${key}' not found.`);
      return;
    }

    // Cleanup previous scene
    if (this.currentScene) {
        console.log(`Destroying scene: ${this.currentScene.sceneKey}`);
        this.app.stage.removeChild(this.currentScene.container);
        this.currentScene.destroy();
        this.currentScene = null;
    }

    console.log(`Starting scene: ${key}`);
    this.currentScene = new SceneClass(this.app, key, this);
    await this.currentScene.init();
    await this.currentScene.create();
    this.app.stage.addChild(this.currentScene.container);

    // Initial resize to fit current screen
    this.resize();
  }

  private update(ticker: any): void {
    if (this.currentScene) {
      this.currentScene.update(ticker.deltaMS);
    }
  }

  private resize(): void {
    if (this.currentScene) {
        // PixiJS app.screen handles the renderer size, but we might want window inner dimensions
        const width = window.innerWidth;
        const height = window.innerHeight;

        // Ensure the renderer is resized to match window
        // (If autoDensity and resizeTo are set on app init, app.screen might already be correct,
        // but explicit handling is safer for game logic)
        // Note: app.renderer.resize is handled by resizeTo: window usually.

        this.currentScene.resize(width, height);
    }
  }
}
