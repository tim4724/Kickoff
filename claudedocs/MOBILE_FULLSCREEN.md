# Mobile Fullscreen Implementation

## Current Status

The game now includes mobile fullscreen support with platform-specific implementations.

## Implementation Details

### Android Support ✅

**Fullscreen API** works on Android browsers:
- Uses Phaser's `scale.startFullscreen()` method
- Triggered on menu button click (`pointerup` event)
- Enters true fullscreen mode (hides address bar, navigation)
- Automatic detection via `scale.fullscreen.available`

### iOS Limitations ⚠️

**iOS Safari does NOT support the Fullscreen API** - This is a fundamental platform limitation by Apple.

**For iOS users, there are two options:**

1. **PWA Installation (Recommended for Fullscreen)**
   - Open game in Safari
   - Tap Share button (square with arrow)
   - Select "Add to Home Screen"
   - Launch game from home screen icon
   - Game will run in standalone fullscreen mode

2. **Browser Mode (Limited)**
   - Game runs in Safari with address bar visible
   - Fullscreen API calls are silently ignored
   - Still fully playable, just not fullscreen

### HTML Meta Tags

Added iOS PWA support in `client/index.html`:

```html
<!-- iOS PWA Meta Tags for Fullscreen -->
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="Kickoff" />
<meta name="viewport" content="..., viewport-fit=cover" />
```

### Code Implementation

**MenuScene.ts:**
```typescript
private requestFullscreen(): void {
  // Check if fullscreen is supported
  if (!this.scale.fullscreen.available) {
    console.log('📱 Fullscreen API not available (iOS requires PWA installation)')
    return
  }

  // Use Phaser's scale manager
  this.scale.startFullscreen()
}
```

**Button Event Handlers:**
- Changed from `pointerdown` to `pointerup`
- Required for touch device compatibility
- Fullscreen requests fail on `pointerdown` for security reasons

## Testing

### Android Testing
1. Open game on Android device
2. Click any menu option
3. Game should enter fullscreen mode
4. Address bar and navigation should hide

### iOS Testing
1. **Browser Mode:**
   - Open game in Safari
   - Click menu option
   - Console shows: "Fullscreen API not available"
   - Game runs in browser (not fullscreen)

2. **PWA Mode:**
   - Add to Home Screen
   - Launch from home screen
   - Game runs in fullscreen standalone mode
   - No address bar or browser chrome

## Known Limitations

1. **iOS Browser:** Cannot trigger fullscreen from JavaScript
2. **User Gesture Required:** Fullscreen must be triggered by user interaction (menu click)
3. **PWA Required for iOS:** Only way to get fullscreen on iOS devices

## Future Considerations

- Add visual indicator for iOS users to install as PWA
- Detect if running in standalone mode: `window.navigator.standalone`
- Show install prompt for eligible devices

## References

- Phaser 3 Scale Manager: https://photonstorm.github.io/phaser3-docs/Phaser.Scale.ScaleManager.html
- iOS Web App Meta Tags: https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariHTMLRef/Articles/MetaTags.html
- GitHub Issue: https://github.com/photonstorm/phaser/issues/5143
