import React, { useEffect, useRef } from 'react';
import type { NatalChart as NatalChartData } from '@kuntay/swisseph';

interface ChartProps {
  data: NatalChartData;
  width?: number;
  height?: number;
  showAspects?: boolean;
  theme?: 'light' | 'dark';
  className?: string;
}

export const NatalChart: React.FC<ChartProps> = ({
  data,
  width = 500,
  height = 500,
  showAspects = true,
  theme = 'light',
  className = ''
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !data) return;

    const svg = svgRef.current;
    const radius = Math.min(width, height) / 2 - 40;
    const center: [number, number] = [width / 2, height / 2];

    // Clear previous content
    svg.innerHTML = '';

    const colors = theme === 'light' ? {
      bg: '#ffffff',
      border: '#2c3e50',
      zodiac: '#ecf0f1',
      text: '#2c3e50',
      aspect: {
        conjunction: '#e74c3c',
        opposition: '#3498db',
        trine: '#2ecc71',
        square: '#f39c12',
        sextile: '#9b59b6'
      }
    } : {
      bg: '#1a1a2e',
      border: '#eaeaea',
      zodiac: '#16213e',
      text: '#eaeaea',
      aspect: {
        conjunction: '#ff6b6b',
        opposition: '#4ecdc4',
        trine: '#95e1d3',
        square: '#f38181',
        sextile: '#aa96da'
      }
    };

    // Background
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    bg.setAttribute('cx', String(center[0]));
    bg.setAttribute('cy', String(center[1]));
    bg.setAttribute('r', String(radius + 35));
    bg.setAttribute('fill', colors.bg);
    bg.setAttribute('stroke', colors.border);
    bg.setAttribute('stroke-width', '2');
    svg.appendChild(bg);

    // Zodiac signs
    const signs = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'];
    for (let i = 0; i < 12; i++) {
      const startAngle = (i * 30 - 90) * Math.PI / 180;
      const endAngle = ((i + 1) * 30 - 90) * Math.PI / 180;
      
      const x1 = center[0] + Math.cos(startAngle) * (radius - 5);
      const y1 = center[1] + Math.sin(startAngle) * (radius - 5);
      const x2 = center[0] + Math.cos(endAngle) * (radius - 5);
      const y2 = center[1] + Math.sin(endAngle) * (radius - 5);
      
      const arc = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      arc.setAttribute('d', `M ${center[0]} ${center[1]} L ${x1} ${y1} A ${radius - 5} ${radius - 5} 0 0 1 ${x2} ${y2} Z`);
      arc.setAttribute('fill', i % 2 === 0 ? colors.zodiac : '#bdc3c7');
      arc.setAttribute('opacity', '0.3');
      svg.appendChild(arc);

      // Sign symbol
      const midAngle = ((i + 0.5) * 30 - 90) * Math.PI / 180;
      const sx = center[0] + Math.cos(midAngle) * (radius - 15);
      const sy = center[1] + Math.sin(midAngle) * (radius - 15);
      
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', String(sx));
      text.setAttribute('y', String(sy));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'middle');
      text.setAttribute('font-size', '14');
      text.setAttribute('fill', colors.text);
      text.textContent = signs[i];
      svg.appendChild(text);
    }

    // Planets
    const planetSymbols: Record<string, string> = {
      Sun: '☉', Moon: '☽', Mercury: '☿', Venus: '♀', Mars: '♂',
      Jupiter: '♃', Saturn: '♄', Uranus: '♅', Neptune: '♆', Pluto: '♇'
    };

    if (data.planets) {
      Object.entries(data.planets).forEach(([name, planet]) => {
        const angle = (planet.longitude * Math.PI / 180) - Math.PI / 2;
        const pr = radius - 50;
        const px = center[0] + Math.cos(angle) * pr;
        const py = center[1] + Math.sin(angle) * pr;

        // Planet circle
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', String(px));
        circle.setAttribute('cy', String(py));
        circle.setAttribute('r', '12');
        circle.setAttribute('fill', colors.bg);
        circle.setAttribute('stroke', theme === 'light' ? '#3498db' : '#e94560');
        circle.setAttribute('stroke-width', '1.5');
        svg.appendChild(circle);

        // Planet symbol
        const symbol = planetSymbols[name] || name[0];
        const pText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        pText.setAttribute('x', String(px));
        pText.setAttribute('y', String(py));
        pText.setAttribute('text-anchor', 'middle');
        pText.setAttribute('dominant-baseline', 'middle');
        pText.setAttribute('font-size', '14');
        pText.setAttribute('fill', colors.text);
        pText.textContent = symbol;
        svg.appendChild(pText);
      });
    }

    // Aspects
    if (showAspects && data.planets) {
      const aspects = calculateAspects(data.planets);
      aspects.forEach(aspect => {
        const angle1 = (aspect.p1Longitude * Math.PI / 180) - Math.PI / 2;
        const angle2 = (aspect.p2Longitude * Math.PI / 180) - Math.PI / 180;
        
        const r = radius - 50;
        const x1 = center[0] + Math.cos(angle1) * r;
        const y1 = center[1] + Math.sin(angle1) * r;
        const x2 = center[0] + Math.cos(angle2) * r;
        const y2 = center[1] + Math.sin(angle2) * r;

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', String(x1));
        line.setAttribute('y1', String(y1));
        line.setAttribute('x2', String(x2));
        line.setAttribute('y2', String(y2));
        line.setAttribute('stroke', colors.aspect[aspect.kind as keyof typeof colors.aspect] || '#95a5a6');
        line.setAttribute('stroke-width', '1.5');
        line.setAttribute('opacity', '0.6');
        svg.appendChild(line);
      });
    }
  }, [data, width, height, showAspects, theme]);

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      style={{ maxWidth: '100%', height: 'auto' }}
    />
  );
};

function calculateAspects(planets: Record<string, any>) {
  const aspects: Array<{ p1Longitude: number; p2Longitude: number; kind: string }> = [];
  const planetList = Object.entries(planets);
  const majorAspects = ['conjunction', 'trine', 'square', 'opposition', 'sextile'];
  const angles = { conjunction: 0, trine: 120, square: 90, opposition: 180, sextile: 60 };
  const orb = 8;

  for (let i = 0; i < planetList.length; i++) {
    for (let j = i + 1; j < planetList.length; j++) {
      const [, p1] = planetList[i];
      const [, p2] = planetList[j];
      
      let diff = Math.abs(p1.longitude - p2.longitude);
      if (diff > 180) diff = 360 - diff;

      for (const aspectName of majorAspects) {
        const exactAngle = angles[aspectName as keyof typeof angles];
        if (Math.abs(diff - exactAngle) <= orb) {
          aspects.push({
            p1Longitude: p1.longitude,
            p2Longitude: p2.longitude,
            kind: aspectName
          });
          break;
        }
      }
    }
  }

  return aspects;
}

export default NatalChart;
