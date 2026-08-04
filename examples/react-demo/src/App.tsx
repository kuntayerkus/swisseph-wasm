import { useState, useEffect } from 'react';
import { SwissEph } from '@kuntay/swisseph';
import { NatalChart } from '@kuntay/swisseph-react-ui';

function App() {
  const [chart, setChart] = useState(null);
  const [theme, setTheme] = useState('light');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function calculateChart() {
      try {
        setLoading(true);
        const swe = await SwissEph.create();
        
        // 15 Mayıs 1990, 14:30, Ankara, Türkiye
        const jd = swe.dateToJulian(1990, 5, 15, 14, 30);
        const natalChart = swe.natalChart(jd, 39.93, 32.86, 'P');
        
        setChart(natalChart);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    calculateChart();
  }, []);

  return (
    <div className="app" data-theme={theme}>
      <header>
        <h1>🌟 SwissEph React Demo</h1>
        <p>Natal Chart Visualization</p>
        <button 
          className="theme-toggle"
          onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
        >
          {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
        </button>
      </header>
      
      <main>
        {loading && (
          <div className="loading">
            <div className="spinner"></div>
            <p>Calculating chart...</p>
          </div>
        )}
        
        {error && (
          <div className="error">
            <h3>Error</h3>
            <p>{error}</p>
          </div>
        )}
        
        {chart && (
          <div className="chart-container">
            <NatalChart
              data={chart}
              width={600}
              height={600}
              showAspects={true}
              theme={theme}
            />
            
            <div className="chart-info">
              <h3>Birth Data</h3>
              <ul>
                <li><strong>Date:</strong> May 15, 1990</li>
                <li><strong>Time:</strong> 14:30</li>
                <li><strong>Location:</strong> Ankara, Turkey</li>
                <li><strong>Coordinates:</strong> 39.93°N, 32.86°E</li>
                <li><strong>House System:</strong> Placidus</li>
              </ul>
            </div>
          </div>
        )}
      </main>
      
      <footer>
        <p>
          Powered by{' '}
          <a href="https://github.com/kuntay/swisseph-wasm" target="_blank">
            @kuntay/swisseph
          </a>
        </p>
      </footer>
    </div>
  );
}

export default App;
