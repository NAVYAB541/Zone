const sharp = require('sharp');
const path = require('path');

const assetsDir = path.join(__dirname, '../frontend/assets');

// ── Zone icon SVG ─────────────────────────────────────────────────────────────
// Uses the app's exact indigo palette: #818cf8 / #6366f1 / #4f46e5
const iconSvg = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg" cx="50%" cy="35%" r="70%">
      <stop offset="0%" stop-color="#1e1b4b"/>
      <stop offset="100%" stop-color="#0f0f0f"/>
    </radialGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="2.5" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <!-- Background -->
  <rect width="120" height="120" fill="url(#bg)"/>
  <!-- Ambient glow -->
  <circle cx="60" cy="60" r="40" fill="#4f46e5" opacity="0.06"/>
  <!-- Outer ring -->
  <circle cx="60" cy="60" r="50" fill="none" stroke="#4f46e5" stroke-opacity="0.25" stroke-width="4.5"/>
  <!-- Mid ring -->
  <circle cx="60" cy="60" r="36" fill="none" stroke="#6366f1" stroke-opacity="0.55" stroke-width="5"/>
  <!-- Inner ring (glowing) -->
  <circle cx="60" cy="60" r="22" fill="none" stroke="#818cf8" stroke-width="5.5" filter="url(#glow)"/>
  <!-- Centre dot -->
  <circle cx="60" cy="60" r="7" fill="#818cf8" filter="url(#glow)"/>
  <circle cx="60" cy="60" r="4" fill="white" opacity="0.95"/>
</svg>`;

// Adaptive icon: same but icon centred in safe zone (72% of canvas)
const adaptiveSvg = (size) => {
  const scale = 0.72;
  const offset = (size * (1 - scale)) / 2;
  const inner = size * scale;
  return `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="glow2" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="${inner * 0.02}" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <!-- Transparent bg — Android provides its own via backgroundColor -->
  <rect width="${size}" height="${size}" fill="transparent"/>
  <!-- Rings scaled into safe zone -->
  <g transform="translate(${offset}, ${offset}) scale(${scale})">
    <circle cx="${size/2}" cy="${size/2}" r="${size*0.4}" fill="#4f46e5" opacity="0.06"/>
    <circle cx="${size/2}" cy="${size/2}" r="${size*0.417}" fill="none" stroke="#4f46e5" stroke-opacity="0.25" stroke-width="${size*0.037}"/>
    <circle cx="${size/2}" cy="${size/2}" r="${size*0.3}" fill="none" stroke="#6366f1" stroke-opacity="0.55" stroke-width="${size*0.042}"/>
    <circle cx="${size/2}" cy="${size/2}" r="${size*0.183}" fill="none" stroke="#818cf8" stroke-width="${size*0.046}" filter="url(#glow2)"/>
    <circle cx="${size/2}" cy="${size/2}" r="${size*0.058}" fill="#818cf8" filter="url(#glow2)"/>
    <circle cx="${size/2}" cy="${size/2}" r="${size*0.033}" fill="white" opacity="0.95"/>
  </g>
</svg>`;
};

// Splash icon: icon centred on dark background, with wordmark below
const splashSvg = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="sbg" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#1e1b4b"/>
      <stop offset="100%" stop-color="#0f0f0f"/>
    </radialGradient>
    <filter id="sglow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="${size * 0.015}" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#sbg)"/>
  <!-- Icon rings centred slightly above middle -->
  <g transform="translate(${size/2}, ${size/2 - size*0.05})">
    <circle cx="0" cy="0" r="${size*0.22}" fill="#4f46e5" opacity="0.06"/>
    <circle cx="0" cy="0" r="${size*0.23}" fill="none" stroke="#4f46e5" stroke-opacity="0.25" stroke-width="${size*0.025}"/>
    <circle cx="0" cy="0" r="${size*0.165}" fill="none" stroke="#6366f1" stroke-opacity="0.55" stroke-width="${size*0.028}"/>
    <circle cx="0" cy="0" r="${size*0.1}" fill="none" stroke="#818cf8" stroke-width="${size*0.03}" filter="url(#sglow)"/>
    <circle cx="0" cy="0" r="${size*0.032}" fill="#818cf8" filter="url(#sglow)"/>
    <circle cx="0" cy="0" r="${size*0.018}" fill="white" opacity="0.95"/>
  </g>
</svg>`;

async function generate() {
  const jobs = [
    // Main app icon (iOS, used everywhere)
    { svg: iconSvg(1024), out: 'icon.png',          width: 1024, height: 1024 },
    // Android adaptive foreground
    { svg: adaptiveSvg(1024), out: 'adaptive-icon.png', width: 1024, height: 1024 },
    // Splash screen icon
    { svg: splashSvg(512),  out: 'splash-icon.png', width: 512,  height: 512  },
    // Web favicon
    { svg: iconSvg(48),    out: 'favicon.png',      width: 48,   height: 48   },
  ];

  for (const { svg, out, width, height } of jobs) {
    await sharp(Buffer.from(svg))
      .resize(width, height)
      .png()
      .toFile(path.join(assetsDir, out));
    console.log(`✓ ${out} (${width}×${height})`);
  }

  console.log('\nAll icons generated!');
}

generate().catch(console.error);
