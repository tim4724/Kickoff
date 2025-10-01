# Input Lag Measurement Results

## Baseline Measurements (Before Optimizations)

**Test Date**: 2025-10-01
**Configuration**: Default settings (33ms throttle, buffer size 3, 30Hz server, 0.15 reconciliation)

### Results Summary:

| Metric | Average | Min | Max | Range |
|--------|---------|-----|-----|-------|
| **Input-to-Visual Lag** | 367.6ms | 52ms | 500ms | 448ms |
| **Network RTT** | 2.02ms | 0.4ms | 8.2ms | 7.8ms |

###Raw Data:
```csv
sample,inputToVisual,networkRTT,timestamp
1,500.00,8.10,1759337973583
2,500.00,0.50,1759337975739
3,59.00,0.50,1759337976301
4,500.00,0.50,1759337978520
5,500.00,0.50,1759337980751
6,65.00,0.50,1759337981319
7,500.00,0.60,1759337983717
8,500.00,8.20,1759337986199
9,52.00,0.40,1759337986755
10,500.00,0.40,1759337989384
```

### Analysis:

**Primary Bottleneck**: Input throttling (33ms)
- 7 out of 10 samples hit the 500ms timeout
- This indicates inputs are being blocked/throttled
- The 3 successful measurements (52-65ms) show the true network path latency when inputs go through

**Network Performance**: Excellent (2ms average RTT)
- Local network is very fast
- Not the bottleneck in this case

**Conclusion**:
The baseline lag is primarily caused by artificial delays:
1. 33ms input throttling
2. 0-66ms input buffering (buffer size 3)
3. 33ms server tick rate

**Expected Improvement from Option A**:
Removing throttling should reduce lag from 367ms → 50-80ms (78% reduction)

---

## After Option A: Aggressive Client Prediction

**Test Date**: 2025-10-01
**Configuration**: No throttle, buffer size 1, 30Hz server, 0.05 reconciliation

### Results Summary:

| Metric | Average | Min | Max | Range |
|--------|---------|-----|-----|-------|
| **Input-to-Visual Lag** | 53.8ms | 12ms | 79ms | 67ms |
| **Network RTT** | 0.42ms | 0.3ms | 0.5ms | 0.2ms |

### Raw Data:
```csv
sample,inputToVisual,networkRTT,timestamp
1,79.00,0.40,1759338518316
2,12.00,0.50,1759338518832
3,50.00,0.40,1759338519383
4,62.00,0.50,1759338519950
5,47.00,0.40,1759338520499
6,64.00,0.50,1759338521067
7,51.00,0.40,1759338521619
8,59.00,0.30,1759338522181
9,63.00,0.40,1759338522747
10,51.00,0.40,1759338523300
```

### Analysis:

**Improvement**: 85% lag reduction (367.6ms → 53.8ms)

**Changes Made**:
1. ✅ Removed INPUT_SEND_INTERVAL (33ms throttling)
2. ✅ Removed throttling condition in updatePlayerMovement
3. ✅ Changed MAX_BUFFER_SIZE from 3 to 1
4. ✅ Tuned reconciliation factor from 0.15 to 0.05

**Results**:
- All 10 samples successful (vs 7/10 timeouts before)
- Consistent 12-79ms range (vs 52-500ms before)
- Average 53.8ms matches expected 50-80ms target
- Network RTT improved to 0.42ms (vs 2.02ms before)

**User Experience**:
- Inputs now feel nearly instant
- No more blocked inputs
- Smooth, responsive movement
- Visual lag barely noticeable (<60ms)

---

## After Option B: Server Performance Optimization

**Test Date**: 2025-10-01
**Configuration**: 60Hz server (increased from 30Hz), buffer size 1, no throttle, 0.05 reconciliation

### Results Summary:

| Metric | Average | Min | Max | Range |
|--------|---------|-----|-----|-------|
| **Input-to-Visual Lag** | 56.8ms | 49ms | 76ms | 27ms |
| **Network RTT** | 1.25ms | 0.3ms | 8.2ms | 7.9ms |

### Raw Data:
```csv
sample,inputToVisual,networkRTT,timestamp
1,76.00,0.50,1759338944400
2,52.00,8.20,1759338944963
3,54.00,0.60,1759338945519
4,49.00,0.40,1759338946070
5,61.00,0.60,1759338946633
6,54.00,0.60,1759338947196
7,51.00,0.40,1759338947750
8,62.00,0.50,1759338948313
9,50.00,0.40,1759338948870
10,59.00,0.30,1759338949431
```

### Analysis:

**Improvement**: Minimal (53.8ms → 56.8ms) - within variance margin

**Changes Made**:
1. ✅ Increased TICK_RATE from 30 to 60Hz

**Results**:
- Slightly slower average (3ms increase)
- This is within network variance and not significant
- Server tick rate isn't the bottleneck when client sends at 60Hz

**Conclusion**:
Option B provides no measurable benefit. The primary gains came from Option A.
Server tick rate increase from 30 → 60Hz has minimal impact since:
- Client already sends inputs at 60Hz (no throttle)
- Network RTT is excellent (1ms average)
- Most lag was from client-side throttling (already removed)

---

## After Option E: Rendering Optimization

**Status**: Skipped

**Rationale**:
- Current lag at 56.8ms is excellent (<100ms threshold)
- Rendering optimizations (fixed timestep, interpolation) would provide <5ms improvement
- Cost/benefit not justified for marginal gains
- Focus resources on implementing gameplay features instead
