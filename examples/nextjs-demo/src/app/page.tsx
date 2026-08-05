'use client';

import { useState } from 'react';
import { createSwissEph, Body, HouseSystem } from '@kuntay/swisseph';

export default function Home() {
  const [birthDate, setBirthDate] = useState('1990-05-15');
  const [birthTime, setBirthTime] = useState('14:30');
  const [latitude, setLatitude] = useState(41.0082);
  const [longitude, setLongitude] = useState(28.9784);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    sunPosition: string;
    ascendant: string;
    midheaven: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function calculateChart() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const swe = await createSwissEph();

      const [year, month, day] = birthDate.split('-').map(Number);
      const [hours, minutes] = birthTime.split(':').map(Number);
      const hourDecimal = hours + minutes / 60;

      const jd = swe.julianDay(year, month, day, hourDecimal);

      const sun = swe.calcWithSign(jd, Body.Sun);
      const houses = swe.houses(jd, latitude, longitude, HouseSystem.Placidus);

      setResult({
        sunPosition: `${sun.degreeInSign.toFixed(2)}° ${sun.sign} (${sun.longitude.toFixed(2)}°)`,
        ascendant: `${houses.ascendant.toFixed(2)}°`,
        midheaven: `${houses.midheaven.toFixed(2)}°`,
      });

      swe.dispose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container">
      <h1>Next.js Demo - Natal Chart Calculator</h1>

      <form onSubmit={(e) => { e.preventDefault(); calculateChart(); }} className="form">
        <div className="form-group">
          <label>Date of Birth:</label>
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            required
          />
          <input
            type="time"
            value={birthTime}
            onChange={(e) => setBirthTime(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label>Location:</label>
          <input
            type="number"
            placeholder="Latitude"
            value={latitude}
            onChange={(e) => setLatitude(parseFloat(e.target.value))}
            step="0.0001"
            required
          />
          <input
            type="number"
            placeholder="Longitude"
            value={longitude}
            onChange={(e) => setLongitude(parseFloat(e.target.value))}
            step="0.0001"
            required
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Calculating...' : 'Calculate Chart'}
        </button>
      </form>

      {result && (
        <div className="result">
          <h2>Sun Position</h2>
          <p>{result.sunPosition}</p>
          <h2>Ascendant</h2>
          <p>{result.ascendant}</p>
          <h2>Midheaven</h2>
          <p>{result.midheaven}</p>
        </div>
      )}

      {error && <div className="error">{error}</div>}
    </main>
  );
}
