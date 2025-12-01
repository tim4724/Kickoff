const { Application } = require('pixi.js');
(async () => {
    try {
        const app = new Application();
        await app.init();
        console.log('interactiveChildren:', 'interactiveChildren' in app.stage);
        console.log('eventMode:', app.stage.eventMode);
    } catch (e) {
        console.error(e);
    }
})();
