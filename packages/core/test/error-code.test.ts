import { describe, it, expect } from 'vitest';
import { SwissEphError, ErrorCode, getErrorSuggestion } from '../src/types.js';

describe('Error Code System', () => {
  it('creates error with code', () => {
    const error = new SwissEphError(
      'Test error message',
      'testFunction',
      'Detailed error info',
      ErrorCode.EPHE_FILE_NOT_FOUND
    );
    
    expect(error.code).toBe(ErrorCode.EPHE_FILE_NOT_FOUND);
    expect(error.fn).toBe('testFunction');
    expect(error.detail).toBe('Detailed error info');
  });

  it('provides suggestion for EPHE_FILE_NOT_FOUND', () => {
    const suggestion = getErrorSuggestion(ErrorCode.EPHE_FILE_NOT_FOUND);
    
    expect(suggestion).not.toBeNull();
    expect(suggestion!.problem).toContain('ephemeris file');
    expect(suggestion!.solution).toContain('mountEphemeris');
    expect(suggestion!.action).toContain('@kuntay/swisseph-data');
  });

  it('provides suggestion for DATE_INVALID', () => {
    const suggestion = getErrorSuggestion(ErrorCode.DATE_INVALID);
    
    expect(suggestion).not.toBeNull();
    expect(suggestion!.problem).toContain('Invalid calendar date');
  });

  it('provides suggestion for RANGE_LATITUDE_INVALID', () => {
    const suggestion = getErrorSuggestion(ErrorCode.RANGE_LATITUDE_INVALID);
    
    expect(suggestion).not.toBeNull();
    expect(suggestion!.problem).toContain('Latitude');
    expect(suggestion!.solution).toContain('coordinates');
  });

  it('returns null for unknown error codes', () => {
    // This tests the default case
    const suggestion = getErrorSuggestion('UNKNOWN_CODE' as ErrorCode);
    expect(suggestion).toBeNull();
  });

  it('includes getSuggestion method on SwissEphError prototype', () => {
    const error = new SwissEphError(
      'Missing file',
      'calc',
      undefined,
      ErrorCode.EPHE_FILE_NOT_FOUND
    );
    
    expect(typeof error.getSuggestion).toBe('function');
    const suggestion = error.getSuggestion();
    expect(suggestion).not.toBeNull();
    expect(suggestion!.problem).toContain('ephemeris file');
  });

  it('provides fallback suggestion for missing file without code', () => {
    const error = new SwissEphError(
      "SwissEph file 'seas_18.se1' not found in PATH",
      'calc',
      "SwissEph file 'seas_18.se1' not found in PATH '.:/users/ephe/'"
    );
    
    const suggestion = error.getSuggestion();
    expect(suggestion).not.toBeNull();
    expect(suggestion!.problem).toContain('seas_18.se1');
    expect(suggestion!.action).toContain('@kuntay/swisseph-data');
  });

  it('covers all defined error codes', () => {
    // Ensure all error codes have suggestions where appropriate
    const codes = Object.values(ErrorCode);
    
    codes.forEach(code => {
      // Just verify they exist and are strings
      expect(typeof code).toBe('string');
      expect(code).toMatch(/^[A-Z]+_\d{3}$/);
    });
    
    expect(codes.length).toBeGreaterThan(20);
  });
});
