import { describe, it, expect } from 'vitest';
import { NatalChartBuilder, TransitChartBuilder } from '../src/index.js';

describe('Builder Pattern API', () => {
  describe('NatalChartBuilder', () => {
    it('creates builder with fluent interface', () => {
      const builder = NatalChartBuilder.builder();
      
      expect(builder).toBeDefined();
      expect(typeof builder.date).toBe('function');
      expect(typeof builder.time).toBe('function');
      expect(typeof builder.location).toBe('function');
      expect(typeof builder.houseSystem).toBe('function');
      expect(typeof builder.ayanamsa).toBe('function');
      expect(typeof builder.build).toBe('function');
    });

    it('chains date and time methods', () => {
      const builder = NatalChartBuilder.builder()
        .date(1990, 5, 15)
        .time(14, 30);
      
      expect(builder).toBeDefined();
    });

    it('chains location method', () => {
      const builder = NatalChartBuilder.builder()
        .location(39.93, 32.86);
      
      expect(builder).toBeDefined();
    });

    it('chains house system with string', () => {
      const builder = NatalChartBuilder.builder()
        .houseSystem('P');
      
      expect(builder).toBeDefined();
    });

    it('chains ayanamsa with number', () => {
      const builder = NatalChartBuilder.builder()
        .ayanamsa(24);
      
      expect(builder).toBeDefined();
    });

    it('throws when building without required fields', () => {
      const builder = NatalChartBuilder.builder();
      
      // Should throw because date and location are missing
      expect(() => {
        (builder as any).build({});
      }).toThrow('date and location are required');
    });

    it('validates month range', () => {
      expect(() => {
        NatalChartBuilder.builder()
          .date(1990, 0, 15)
          .location(39.93, 32.86)
          .build({} as any);
      }).toThrow('Invalid month');
    });

    it('validates day range', () => {
      expect(() => {
        NatalChartBuilder.builder()
          .date(1990, 5, 0)
          .location(39.93, 32.86)
          .build({} as any);
      }).toThrow('Invalid day');
    });

    it('validates latitude range', () => {
      expect(() => {
        NatalChartBuilder.builder()
          .date(1990, 5, 15)
          .location(91, 32.86)
          .build({} as any);
      }).toThrow('Latitude out of range');
    });

    it('validates longitude range', () => {
      expect(() => {
        NatalChartBuilder.builder()
          .date(1990, 5, 15)
          .location(39.93, 181)
          .build({} as any);
      }).toThrow('Longitude out of range');
    });

    it('includes asteroids option', () => {
      const builder = NatalChartBuilder.builder()
        .includeAsteroids(1, 2, 3, 4);
      
      expect(builder).toBeDefined();
    });
  });

  describe('TransitChartBuilder', () => {
    it('creates builder with fluent interface', () => {
      const builder = TransitChartBuilder.builder();
      
      expect(builder).toBeDefined();
      expect(typeof builder.natalDate).toBe('function');
      expect(typeof builder.transitDate).toBe('function');
      expect(typeof builder.location).toBe('function');
      expect(typeof builder.build).toBe('function');
    });

    it('chains natal and transit dates', () => {
      const builder = TransitChartBuilder.builder()
        .natalDate(1990, 5, 15)
        .transitDate(2024, 1, 1);
      
      expect(builder).toBeDefined();
    });

    it('throws when building without required fields', () => {
      const builder = TransitChartBuilder.builder();
      
      expect(() => {
        (builder as any).build({});
      }).toThrow('natalDate, transitDate, and location are required');
    });

    it('accepts optional hour parameter', () => {
      const builder = TransitChartBuilder.builder()
        .natalDate(1990, 5, 15, 14)
        .transitDate(2024, 1, 1, 10);
      
      expect(builder).toBeDefined();
    });
  });
});
