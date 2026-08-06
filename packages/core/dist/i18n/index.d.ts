/**
 * Çoklu Dil Desteği (i18n)
 *
 * Desteklenen diller:
 * - Türkçe (tr)
 * - İngilizce (en)
 * - Almanca (de)
 * - Fransızca (fr)
 * - İspanyolca (es)
 *
 * @package @kuntay/swisseph
 */
export type SupportedLanguage = 'tr' | 'en' | 'de' | 'fr' | 'es';
export interface Translation {
    planets: Record<number, string>;
    signs: string[];
    houses: string[];
    aspects: Record<number, string>;
    errors: Record<string, string>;
    directions: {
        secondary: string;
        tertiary: string;
        solarArc: string;
        primary: string;
    };
    general: {
        age: string;
        year: string;
        degree: string;
        orb: string;
        applying: string;
        separating: string;
        natal: string;
        transit: string;
        return: string;
    };
}
declare const translations: Record<SupportedLanguage, Translation>;
export declare class I18n {
    private static currentLanguage;
    static setLanguage(lang: SupportedLanguage): void;
    static getLanguage(): SupportedLanguage;
    static t(key: string, params?: Record<string, any>): string;
    private static getNestedValue;
    static getPlanetName(body: number): string;
    static getSignName(longitude: number): string;
    static getHouseName(houseNumber: number): string;
    static getAspectName(aspect: number): string;
    static getErrorMessage(code: string): string;
}
export { translations };
//# sourceMappingURL=index.d.ts.map