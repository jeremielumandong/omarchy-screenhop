# Device catalog sources

Reviewed 2026-09-08. Existing presets and IDs are preserved. New presets are appended so saved selections and index-based defaults remain stable.

`width`/`height` are the CSS layout dimensions ScreenHop applies. `physicalWidth`/`physicalHeight` describe panel pixels in the listed orientation. These are different quantities. Manufacturer specifications verify panel dimensions, not CSS viewport dimensions or browser DPR. All new entries therefore use `viewportBasis: derived`, `viewportApproximate: true` and a visible approximate label. Their CSS dimensions are rounded physical dimensions divided by an explicitly selected DPR. They are useful responsive test sizes, not hardware-validated browser profiles.

Safari/Chrome browser bars, system scaling, zoom, safe areas and Android selected display resolution change real browser dimensions. The decorative skin does not emulate the OS or Safari engine. Fold/flip cover entries test rectangular layouts, not support for arbitrary cover-screen apps or hinge APIs.

Samsung Fold8 sources disagree: the developer skin landing page lists 1828×2448; Samsung product/support specifications list 1848×2448. The catalog uses the product specification and a wide unfolded orientation (2448×1848). Fold8 Ultra uses the supplied skin orientation (2256×2504). The source field links to the resolution authority; supplied skin layout geometry is independent.

Current-family coverage includes all five iPhone17-generation names (17,17Pro,17ProMax,Air,17e), missing iPhone16 sizes, S26/S26+/Ultra/FE, A57/A37, Fold8/Fold8Ultra/Flip8 main and cover screens, TabS11Ultra, Pixel11/Pro/XL/Fold and Pixel10a, plus representative current OnePlus, Xiaomi, Nothing, Motorola, OPPO and vivo models. Color/storage variants share a viewport and are not duplicate devices. No iPhone18 or unverified future model is invented. Nothing Phone(4a)/(4a)Pro exist, but official pages fetched did not expose numeric panel specifications, so only the official-spec-backed Phone(3) is included for now.

| Device | Physical pixels | CSS preset | DPR choice | Source |
|---|---:|---:|---:|---|
| iPhone 17 | 1206×2622 | 402×874 | 3 | [Official specifications](https://www.apple.com/iphone-17/specs/) |
| iPhone 17 Pro | 1206×2622 | 402×874 | 3 | [Official specifications](https://www.apple.com/iphone-17-pro/specs/) |
| iPhone 17 Pro Max | 1320×2868 | 440×956 | 3 | [Official specifications](https://www.apple.com/iphone-17-pro/specs/) |
| iPhone Air | 1260×2736 | 420×912 | 3 | [Official specifications](https://www.apple.com/iphone-air/specs/) |
| iPhone 17e | 1170×2532 | 390×844 | 3 | [Official specifications](https://www.apple.com/iphone-17e/specs/) |
| iPhone 16 | 1179×2556 | 393×852 | 3 | [Official specifications](https://support.apple.com/en-us/121029) |
| iPhone 16 Plus | 1290×2796 | 430×932 | 3 | [Official specifications](https://support.apple.com/en-us/121030) |
| iPhone 16 Pro | 1206×2622 | 402×874 | 3 | [Official specifications](https://support.apple.com/en-us/121031) |
| iPhone 16 Pro Max | 1320×2868 | 440×956 | 3 | [Official specifications](https://support.apple.com/en-us/121032) |
| Samsung Galaxy S26 | 1080×2340 | 360×780 | 3 | [Official specifications](https://developer.samsung.com/galaxy-emulator-skin/galaxy-s.html) |
| Samsung Galaxy S26+ | 1440×3120 | 411×891 | 3.5 | [Official specifications](https://developer.samsung.com/galaxy-emulator-skin/galaxy-s.html) |
| Samsung Galaxy S26 Ultra | 1440×3120 | 411×891 | 3.5 | [Official specifications](https://developer.samsung.com/galaxy-emulator-skin/galaxy-s.html) |
| Samsung Galaxy S26 FE | 1080×2340 | 360×780 | 3 | [Official specifications](https://developer.samsung.com/galaxy-emulator-skin/galaxy-s.html) |
| Samsung Galaxy A57 5G | 1080×2340 | 360×780 | 3 | [Official specifications](https://www.samsung.com/ie/smartphones/galaxy-a/galaxy-a57-5g-awesome-gray-256gb-sm-a576bzadeub/) |
| Samsung Galaxy A37 5G | 1080×2340 | 360×780 | 3 | [Official specifications](https://www.samsung.com/uk/smartphones/galaxy-a/galaxy-a37-5g-awesome-graygreen-256gb-sm-a376bdggeub/) |
| Samsung Galaxy Z Fold8 · unfolded | 2448×1848 | 979×739 | 2.5 | [Official specifications](https://www.samsung.com/ie/support/mobile-devices/what-is-the-difference-between-the-galaxy-z-fold8-ultra-and-z-fold8/) |
| Samsung Galaxy Z Fold8 · cover | 1248×1972 | 416×657 | 3 | [Official specifications](https://www.samsung.com/ie/support/mobile-devices/what-is-the-difference-between-the-galaxy-z-fold8-ultra-and-z-fold8/) |
| Samsung Galaxy Z Fold8 Ultra · unfolded | 2256×2504 | 902×1002 | 2.5 | [Official specifications](https://www.samsung.com/ie/support/mobile-devices/what-is-the-difference-between-the-galaxy-z-fold8-ultra-and-z-fold8/) |
| Samsung Galaxy Z Fold8 Ultra · cover | 1080×2520 | 360×840 | 3 | [Official specifications](https://www.samsung.com/ie/support/mobile-devices/what-is-the-difference-between-the-galaxy-z-fold8-ultra-and-z-fold8/) |
| Samsung Galaxy Z Flip8 · open | 1080×2520 | 360×840 | 3 | [Official specifications](https://developer.samsung.com/galaxy-emulator-skin/galaxy-z.html) |
| Samsung Galaxy Z Flip8 · cover | 948×1048 | 379×419 | 2.5 | [Official specifications](https://www.samsung.com/kz_ru/support/mobile-devices/the-difference-between-samsung-galaxy-z-flip8-smartphones-and-previous-models-in-the-series/) |
| Samsung Galaxy Tab S11 Ultra | 1848×2960 | 924×1480 | 2 | [Official specifications](https://www.samsung.com/za/tablets/galaxy-tab-s/galaxy-tab-s11-ultra-gray-256gb-sm-x936bzaaafa/) |
| Google Pixel 11 | 1080×2424 | 393×881 | 2.75 | [Official specifications](https://store.google.com/us/product/pixel_11_specs?hl=en-US) |
| Google Pixel 11 Pro | 1280×2856 | 410×914 | 3.125 | [Official specifications](https://store.google.com/us/product/pixel_11_pro_specs?hl=en-US) |
| Google Pixel 11 Pro XL | 1344×2992 | 414×921 | 3.25 | [Official specifications](https://store.google.com/us/product/pixel_11_pro_specs?hl=en-US) |
| Google Pixel 10a | 1080×2424 | 393×881 | 2.75 | [Official specifications](https://store.google.com/us/product/pixel_10a_specs?hl=en-US) |
| Google Pixel 11 Pro Fold · unfolded | 2076×2152 | 830×861 | 2.5 | [Official specifications](https://store.google.com/us/product/pixel_11_pro_fold_specs?hl=en-US) |
| Google Pixel 11 Pro Fold · cover | 1080×2342 | 393×852 | 2.75 | [Official specifications](https://store.google.com/us/product/pixel_11_pro_fold_specs?hl=en-US) |
| OnePlus 15 | 1272×2772 | 424×924 | 3 | [Official specifications](https://www.oneplus.com/global/15/specs) |
| OnePlus 15R | 1272×2800 | 424×933 | 3 | [Official specifications](https://www.oneplus.com/us/15r/specs) |
| Xiaomi 17 | 1220×2656 | 407×885 | 3 | [Official specifications](https://www.mi.com/au/product/xiaomi-17/specs/) |
| Xiaomi 17 Ultra | 1200×2608 | 400×869 | 3 | [Official specifications](https://www.mi.com/sg/product/xiaomi-17-ultra/specs/) |
| Nothing Phone (3) | 1260×2800 | 420×933 | 3 | [Official specifications](https://support.nothing.tech/hc/en-us/categories/34659490954897) |
| OPPO Find X9 Ultra | 1440×3168 | 411×905 | 3.5 | [Official specifications](https://www.oppo.com/in/smartphones/series-find-x/find-x9-ultra/specs/) |
| vivo X300 Ultra | 1440×3168 | 411×905 | 3.5 | [Official specifications](https://www.vivo.com/in/products/param/x300-ultra) |
| Motorola razr 70 ultra · open | 1224×2992 | 408×997 | 3 | [Official specifications](https://en-gb.support.motorola.com/app/answers/detail/a_id/192853/~/specifications---motorola-razr-70-ultra) |
| Motorola razr 70 ultra · cover | 1272×1080 | 424×360 | 3 | [Official specifications](https://en-gb.support.motorola.com/app/answers/detail/a_id/192853/~/specifications---motorola-razr-70-ultra) |

For a specific real phone, compare these values in its browser at normal zoom:

```js
({ width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio })
```

Those values describe the current browser viewport; they may change with orientation, browser bars or display settings. Use them in ScreenHop's Custom size fields when matching that exact configuration. Full-panel CSS dimensions derived from physical pixels are larger than the usable page area when browser/system bars consume space. Shrinking the preview to fit the desktop changes only its display scale, never the emulated CSS viewport.
