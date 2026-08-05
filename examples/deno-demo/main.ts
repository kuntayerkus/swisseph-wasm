/**
 * Deno Demo - Swiss Ephemeris
 * 
 * Run with: deno run --allow-read --allow-net main.ts
 */

import { createSwissEph, Body, HouseSystem, SIGNS } from 'npm:@kuntay/swisseph@0.2.2';

async function calculateNatalChart() {
  console.log('🔮 Natal Chart Calculator (Deno)\n');

  const swe = await createSwissEph();

  // Örnek doğum bilgileri: 15 Mayıs 1990, 14:30, İstanbul
  const year = 1990;
  const month = 5;
  const day = 15;
  const hour = 14.5; // 14:30

  const latitude = 41.0082; // İstanbul
  const longitude = 28.9784;

  const jd = swe.julianDay(year, month, day, hour);
  console.log(`Julian Day: ${jd}\n`);

  // Güneş pozisyonu
  const sun = swe.calcWithSign(jd, Body.Sun);
  console.log('☀️ Sun Position:');
  console.log(`   Longitude: ${sun.longitude.toFixed(4)}°`);
  console.log(`   Sign: ${sun.degreeInSign.toFixed(2)}° ${sun.sign}`);
  console.log(`   Retrograde: ${sun.retrograde ? 'Yes' : 'No'}\n`);

  // Ay pozisyonu
  const moon = swe.calcWithSign(jd, Body.Moon);
  console.log('🌙 Moon Position:');
  console.log(`   Longitude: ${moon.longitude.toFixed(4)}°`);
  console.log(`   Sign: ${moon.degreeInSign.toFixed(2)}° ${moon.sign}\n`);

  // Evler sistemi
  const houses = swe.houses(jd, latitude, longitude, HouseSystem.Placidus);
  console.log('🏠 House Cusps (Placidus):');
  for (let i = 0; i < 12; i++) {
    const signIndex = Math.floor(houses.cusps[i] / 30);
    const degreeInSign = houses.cusps[i] % 30;
    console.log(`   House ${i + 1}: ${degreeInSign.toFixed(2)}° ${SIGNS[signIndex]}`);
  }

  console.log('\n📍 Angles:');
  console.log(`   Ascendant: ${houses.ascendant.toFixed(2)}°`);
  console.log(`   Midheaven: ${houses.midheaven.toFixed(2)}°`);
  console.log(`   Descendant: ${houses.descendant.toFixed(2)}°`);
  console.log(`   Imum Coeli: ${houses.imumCoeli.toFixed(2)}°`);

  swe.dispose();
  console.log('\n✅ Calculation complete!');
}

calculateNatalChart().catch(console.error);
