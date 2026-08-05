import * as d3 from 'd3';
import type { NatalChart as NatalChartData, Body } from '@kuntay/swisseph';

export interface NatalChartConfig {
  width?: number;
  height?: number;
  showAspects?: boolean;
  aspectOrb?: number;
  showDegrees?: boolean;
  showHouses?: boolean;
  colorScheme?: 'light' | 'dark' | 'custom';
  customColors?: Record<string, string>;
}

export class NatalChartViz {
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private config: Required<NatalChartConfig>;
  private data: NatalChartData;
  private radius: number;
  private center: [number, number];

  constructor(container: string | SVGSVGElement, data: NatalChartData, config: NatalChartConfig = {}) {
    this.data = data;
    
    this.config = {
      width: config.width ?? 600,
      height: config.height ?? 600,
      showAspects: config.showAspects ?? true,
      aspectOrb: config.aspectOrb ?? 8,
      showDegrees: config.showDegrees ?? true,
      showHouses: config.showHouses ?? true,
      colorScheme: config.colorScheme ?? 'light',
      customColors: config.customColors ?? {}
    };

    this.radius = Math.min(this.config.width, this.config.height) / 2 - 40;
    this.center = [this.config.width / 2, this.config.height / 2];

    // SVG oluştur
    const selection = typeof container === 'string' 
      ? d3.select(container)
      : d3.select(container);
    
    this.svg = selection.append('svg')
      .attr('width', this.config.width)
      .attr('height', this.config.height)
      .attr('viewBox', `0 0 ${this.config.width} ${this.config.height}`)
      .attr('class', 'swisseph-natal-chart');

    this.render();
  }

  private render(): void {
    this.svg.selectAll('*').remove();
    
    // Arkaplan
    this.drawBackground();
    
    // Evler
    if (this.config.showHouses) {
      this.drawHouses();
    }
    
    // Zodyak kuşağı
    this.drawZodiac();
    
    // Gezegenler
    this.drawPlanets();
    
    // Açılar
    if (this.config.showAspects) {
      this.drawAspects();
    }
    
    // Dereceler
    if (this.config.showDegrees) {
      this.drawDegreeMarkers();
    }
  }

  private drawBackground(): void {
    const colors = this.getColors();
    
    this.svg.append('circle')
      .attr('cx', this.center[0])
      .attr('cy', this.center[1])
      .attr('r', this.radius + 35)
      .attr('fill', colors.background)
      .attr('stroke', colors.border)
      .attr('stroke-width', 2);
  }

  private drawHouses(): void {
    const houseCusps = this.data.houses;
    if (!houseCusps) return;

    const colors = this.getColors();
    
    // Ev çizgileri
    for (let i = 0; i < 12; i++) {
      const angle = (houseCusps[i] * Math.PI / 180) - Math.PI / 2;
      const x1 = this.center[0] + Math.cos(angle) * (this.radius - 10);
      const y1 = this.center[1] + Math.sin(angle) * (this.radius - 10);
      const x2 = this.center[0] + Math.cos(angle) * (this.radius + 30);
      const y2 = this.center[1] + Math.sin(angle) * (this.radius + 30);

      this.svg.append('line')
        .attr('x1', x1)
        .attr('y1', y1)
        .attr('x2', x2)
        .attr('y2', y2)
        .attr('stroke', colors.houseLine)
        .attr('stroke-width', 1);

      // Ev numarası
      const labelAngle = ((houseCusps[i] + houseCusps[(i + 1) % 12] || houseCusps[i] + 30) / 2 * Math.PI / 180) - Math.PI / 2;
      const labelRadius = this.radius + 20;
      const lx = this.center[0] + Math.cos(labelAngle) * labelRadius;
      const ly = this.center[1] + Math.sin(labelAngle) * labelRadius;

      this.svg.append('text')
        .attr('x', lx)
        .attr('y', ly)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', '12px')
        .attr('fill', colors.text)
        .text(i + 1);
    }
  }

  private drawZodiac(): void {
    const colors = this.getColors();
    const signs = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'];
    
    // Zodyak kuşağı
    this.svg.append('circle')
      .attr('cx', this.center[0])
      .attr('cy', this.center[1])
      .attr('r', this.radius - 5)
      .attr('fill', 'none')
      .attr('stroke', colors.zodiacBorder)
      .attr('stroke-width', 2);

    // Burç sembolleri ve bölümler
    for (let i = 0; i < 12; i++) {
      const startAngle = (i * 30 - 90) * Math.PI / 180;
      const endAngle = ((i + 1) * 30 - 90) * Math.PI / 180;
      
      const arc = d3.arc<any>()
        .innerRadius(this.radius - 25)
        .outerRadius(this.radius - 5)
        .startAngle(startAngle)
        .endAngle(endAngle);

      this.svg.append('path')
        .attr('d', arc)
        .attr('fill', i % 2 === 0 ? colors.zodiacLight : colors.zodiacDark)
        .attr('stroke', colors.zodiacBorder)
        .attr('stroke-width', 0.5);

      // Burç sembolü
      const midAngle = ((i + 0.5) * 30 - 90) * Math.PI / 180;
      const symbolRadius = this.radius - 15;
      const sx = this.center[0] + Math.cos(midAngle) * symbolRadius;
      const sy = this.center[1] + Math.sin(midAngle) * symbolRadius;

      this.svg.append('text')
        .attr('x', sx)
        .attr('y', sy)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', '14px')
        .attr('fill', colors.zodiacText)
        .text(signs[i]);
    }
  }

  private drawPlanets(): void {
    const planets = this.data.planets;
    if (!planets) return;

    const colors = this.getColors();
    const planetSymbols: Record<string, string> = {
      Sun: '☉', Moon: '☽', Mercury: '☿', Venus: '♀', Mars: '♂',
      Jupiter: '♃', Saturn: '♄', Uranus: '♅', Neptune: '♆', Pluto: '♇'
    };

    Object.entries(planets).forEach(([name, planet]) => {
      const angle = (planet.longitude * Math.PI / 180) - Math.PI / 2;
      const pr = this.radius - 50;
      const px = this.center[0] + Math.cos(angle) * pr;
      const py = this.center[1] + Math.sin(angle) * pr;

      // Gezegen dairesi
      this.svg.append('circle')
        .attr('cx', px)
        .attr('cy', py)
        .attr('r', 12)
        .attr('fill', colors.planetBg)
        .attr('stroke', colors.planetBorder)
        .attr('stroke-width', 1.5);

      // Gezegen sembolü
      const symbol = planetSymbols[name] || name[0];
      this.svg.append('text')
        .attr('x', px)
        .attr('y', py)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', '14px')
        .attr('fill', colors.planetText)
        .text(symbol);

      // Derece bilgisi
      if (this.config.showDegrees) {
        const degreeText = `${Math.floor(planet.longitude)}°${Math.round((planet.longitude % 1) * 60)}`;
        const labelRadius = this.radius - 70;
        const lx = this.center[0] + Math.cos(angle) * labelRadius;
        const ly = this.center[1] + Math.sin(angle) * labelRadius;

        this.svg.append('text')
          .attr('x', lx)
          .attr('y', ly)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('font-size', '9px')
          .attr('fill', colors.degreeText)
          .text(degreeText);
      }
    });
  }

  private drawAspects(): void {
    const aspects = this.getAspects();
    const colors = this.getColors();
    
    const aspectColors: Record<number, string> = {
      0: colors.conjunction,
      3: colors.opposition,
      1: colors.trine,
      2: colors.square,
      4: colors.sextile
    };

    aspects.forEach(aspect => {
      const angle1 = (aspect.p1Longitude * Math.PI / 180) - Math.PI / 2;
      const angle2 = (aspect.p2Longitude * Math.PI / 180) - Math.PI / 2;
      
      const r = this.radius - 50;
      const x1 = this.center[0] + Math.cos(angle1) * r;
      const y1 = this.center[1] + Math.sin(angle1) * r;
      const x2 = this.center[0] + Math.cos(angle2) * r;
      const y2 = this.center[1] + Math.sin(angle2) * r;

      this.svg.append('line')
        .attr('x1', x1)
        .attr('y1', y1)
        .attr('x2', x2)
        .attr('y2', y2)
        .attr('stroke', aspectColors[aspect.kind] || colors.aspectDefault)
        .attr('stroke-width', 1.5)
        .attr('opacity', 0.6);
    });
  }

  private drawDegreeMarkers(): void {
    const colors = this.getColors();
    
    for (let i = 0; i < 360; i += 5) {
      const angle = (i * Math.PI / 180) - Math.PI / 2;
      const isMajor = i % 30 === 0;
      const innerR = isMajor ? this.radius - 2 : this.radius;
      const outerR = this.radius + 2;

      const x1 = this.center[0] + Math.cos(angle) * innerR;
      const y1 = this.center[1] + Math.sin(angle) * innerR;
      const x2 = this.center[0] + Math.cos(angle) * outerR;
      const y2 = this.center[1] + Math.sin(angle) * outerR;

      this.svg.append('line')
        .attr('x1', x1)
        .attr('y1', y1)
        .attr('x2', x2)
        .attr('y2', y2)
        .attr('stroke', colors.degreeMarker)
        .attr('stroke-width', isMajor ? 1.5 : 0.5);
    }
  }

  private getAspects(): Array<{ p1Longitude: number; p2Longitude: number; kind: number }> {
    const planets = this.data.planets;
    if (!planets) return [];

    const aspects: Array<{ p1Longitude: number; p2Longitude: number; kind: number }> = [];
    const planetList = Object.entries(planets);
    
    const majorAspects = [0, 1, 2, 3, 4]; // conjunction, trine, square, opposition, sextile
    const orb = this.config.aspectOrb;

    for (let i = 0; i < planetList.length; i++) {
      for (let j = i + 1; j < planetList.length; j++) {
        const [, p1] = planetList[i];
        const [, p2] = planetList[j];
        
        let diff = Math.abs(p1.longitude - p2.longitude);
        if (diff > 180) diff = 360 - diff;

        for (const aspectKind of majorAspects) {
          const exactAngle = aspectKind === 0 ? 0 : aspectKind === 1 ? 120 : aspectKind === 2 ? 90 : aspectKind === 3 ? 180 : 60;
          if (Math.abs(diff - exactAngle) <= orb) {
            aspects.push({
              p1Longitude: p1.longitude,
              p2Longitude: p2.longitude,
              kind: aspectKind
            });
            break;
          }
        }
      }
    }

    return aspects;
  }

  private getColors(): Record<string, string> {
    const defaults = {
      light: {
        background: '#ffffff',
        border: '#2c3e50',
        houseLine: '#95a5a6',
        zodiacBorder: '#34495e',
        zodiacLight: '#ecf0f1',
        zodiacDark: '#bdc3c7',
        zodiacText: '#2c3e50',
        planetBg: '#ffffff',
        planetBorder: '#3498db',
        planetText: '#2c3e50',
        degreeText: '#7f8c8d',
        degreeMarker: '#bdc3c7',
        conjunction: '#e74c3c',
        opposition: '#3498db',
        trine: '#2ecc71',
        square: '#f39c12',
        sextile: '#9b59b6',
        aspectDefault: '#95a5a6',
        text: '#2c3e50'
      },
      dark: {
        background: '#1a1a2e',
        border: '#eaeaea',
        houseLine: '#6c757d',
        zodiacBorder: '#eaeaea',
        zodiacLight: '#16213e',
        zodiacDark: '#0f3460',
        zodiacText: '#eaeaea',
        planetBg: '#1a1a2e',
        planetBorder: '#e94560',
        planetText: '#eaeaea',
        degreeText: '#a0a0a0',
        degreeMarker: '#6c757d',
        conjunction: '#ff6b6b',
        opposition: '#4ecdc4',
        trine: '#95e1d3',
        square: '#f38181',
        sextile: '#aa96da',
        aspectDefault: '#a0a0a0',
        text: '#eaeaea'
      }
    };

    const baseColors = defaults[this.config.colorScheme];
    return { ...baseColors, ...this.config.customColors };
  }

  public update(newData: NatalChartData): void {
    this.data = newData;
    this.render();
  }

  public destroy(): void {
    this.svg.remove();
  }
}
