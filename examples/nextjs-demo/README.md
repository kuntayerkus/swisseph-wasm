# Next.js Demo - Swiss Ephemeris

This example demonstrates how to use `@kuntay/swisseph` in a Next.js 14 application with the App Router.

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Features

- Server-side rendering compatible
- Client-side natal chart calculation
- Sun position display
- House system calculation (Placidus)
- Ascendant and Midheaven calculation

## Usage

1. Enter birth date and time
2. Enter geographic coordinates (latitude/longitude)
3. Click "Calculate Chart" to see planetary positions

## Important Notes

- The WebAssembly module is loaded client-side only (`'use client'`)
- Webpack is configured to support async WebAssembly in `next.config.js`
- For production, ensure the WASM file is properly served

## Example Code

```typescript
'use client';

import { createSwissEph, Body, HouseSystem } from '@kuntay/swisseph';

const swe = await createSwissEph();
const jd = swe.julianDay(1990, 5, 15, 14.5);
const sun = swe.calcWithSign(jd, Body.Sun);
const houses = swe.houses(jd, 41.01, 28.98, HouseSystem.Placidus);
swe.dispose();
```
