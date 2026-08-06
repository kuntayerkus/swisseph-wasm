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
const translations = {
    tr: {
        planets: {
            0: 'Güneş',
            1: 'Ay',
            2: 'Merkür',
            3: 'Venüs',
            4: 'Mars',
            5: 'Jüpiter',
            6: 'Satürn',
            7: 'Uranüs',
            8: 'Neptün',
            9: 'Plüton',
            10: 'Kuzey Ay Düğümü',
            11: 'Güney Ay Düğümü',
            12: 'Chiron',
            13: 'Pholus',
            14: 'Ceres',
            15: 'Pallas',
            16: 'Juno',
            17: 'Vesta',
            18: 'Eris',
            19: 'Sedna',
            20: 'Lilith'
        },
        signs: [
            'Koç', 'Boğa', 'İkizler', 'Yengeç', 'Aslan', 'Başak',
            'Terazi', 'Akrep', 'Yay', 'Oğlak', 'Kova', 'Balık'
        ],
        houses: [
            '1. Ev', '2. Ev', '3. Ev', '4. Ev', '5. Ev', '6. Ev',
            '7. Ev', '8. Ev', '9. Ev', '10. Ev', '11. Ev', '12. Ev'
        ],
        aspects: {
            0: 'Kavuşum',
            60: 'Sekstil',
            90: 'Kare',
            120: 'Üçgen',
            180: 'Karşıtlık',
            30: 'Semisekstil',
            45: 'Semikare',
            135: 'Seskuikadrat',
            150: 'İnkonsijment'
        },
        errors: {
            EPHE_001: 'Efemeris dosyası bulunamadı.',
            EPHE_002: 'Efemeris dosyası okunamadı.',
            DATE_001: 'Geçersiz tarih.',
            DATE_002: 'Tarih aralık dışında.',
            CALC_001: 'Hesaplama hatası.',
            RANGE_001: 'Enlem -90 ile 90 arasında olmalıdır.',
            RANGE_002: 'Boylam -180 ile 180 arasında olmalıdır.'
        },
        directions: {
            secondary: 'Sekonder İlerletme',
            tertiary: 'Tersiyer İlerletme',
            solarArc: 'Güneş Yayı',
            primary: 'Primer Yönlendirme'
        },
        general: {
            age: 'Yaş',
            year: 'Yıl',
            degree: 'Derece',
            orb: 'Orb',
            applying: 'Uygulayan',
            separating: 'Ayıran',
            natal: 'Natal',
            transit: 'Transit',
            return: 'Dönüş'
        }
    },
    en: {
        planets: {
            0: 'Sun',
            1: 'Moon',
            2: 'Mercury',
            3: 'Venus',
            4: 'Mars',
            5: 'Jupiter',
            6: 'Saturn',
            7: 'Uranus',
            8: 'Neptune',
            9: 'Pluto',
            10: 'North Node',
            11: 'South Node',
            12: 'Chiron',
            13: 'Pholus',
            14: 'Ceres',
            15: 'Pallas',
            16: 'Juno',
            17: 'Vesta',
            18: 'Eris',
            19: 'Sedna',
            20: 'Lilith'
        },
        signs: [
            'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
            'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
        ],
        houses: [
            '1st House', '2nd House', '3rd House', '4th House', '5th House', '6th House',
            '7th House', '8th House', '9th House', '10th House', '11th House', '12th House'
        ],
        aspects: {
            0: 'Conjunction',
            60: 'Sextile',
            90: 'Square',
            120: 'Trine',
            180: 'Opposition',
            30: 'Semisextile',
            45: 'Semisquare',
            135: 'Sesquiquadrate',
            150: 'Inconjunct'
        },
        errors: {
            EPHE_001: 'Ephemeris file not found.',
            EPHE_002: 'Ephemeris file could not be read.',
            DATE_001: 'Invalid date.',
            DATE_002: 'Date out of range.',
            CALC_001: 'Calculation error.',
            RANGE_001: 'Latitude must be between -90 and 90.',
            RANGE_002: 'Longitude must be between -180 and 180.'
        },
        directions: {
            secondary: 'Secondary Progression',
            tertiary: 'Tertiary Progression',
            solarArc: 'Solar Arc Direction',
            primary: 'Primary Direction'
        },
        general: {
            age: 'Age',
            year: 'Year',
            degree: 'Degree',
            orb: 'Orb',
            applying: 'Applying',
            separating: 'Separating',
            natal: 'Natal',
            transit: 'Transit',
            return: 'Return'
        }
    },
    de: {
        planets: {
            0: 'Sonne',
            1: 'Mond',
            2: 'Merkur',
            3: 'Venus',
            4: 'Mars',
            5: 'Jupiter',
            6: 'Saturn',
            7: 'Uranus',
            8: 'Neptun',
            9: 'Pluto',
            10: 'Nordknoten',
            11: 'Südknoten',
            12: 'Chiron',
            13: 'Pholus',
            14: 'Ceres',
            15: 'Pallas',
            16: 'Juno',
            17: 'Vesta',
            18: 'Eris',
            19: 'Sedna',
            20: 'Lilith'
        },
        signs: [
            'Widder', 'Stier', 'Zwillinge', 'Krebs', 'Löwe', 'Jungfrau',
            'Waage', 'Skorpion', 'Schütze', 'Steinbock', 'Wassermann', 'Fische'
        ],
        houses: [
            '1. Haus', '2. Haus', '3. Haus', '4. Haus', '5. Haus', '6. Haus',
            '7. Haus', '8. Haus', '9. Haus', '10. Haus', '11. Haus', '12. Haus'
        ],
        aspects: {
            0: 'Konjunktion',
            60: 'Sextil',
            90: 'Quadrat',
            120: 'Trigon',
            180: 'Opposition',
            30: 'Semisextil',
            45: 'Semiquadrat',
            135: 'Sesquiquadrat',
            150: 'Inkonjunktion'
        },
        errors: {
            EPHE_001: 'Ephemeridendatei nicht gefunden.',
            EPHE_002: 'Ephemeridendatei konnte nicht gelesen werden.',
            DATE_001: 'Ungültiges Datum.',
            DATE_002: 'Datum außerhalb des Bereichs.',
            CALC_001: 'Berechnungsfehler.',
            RANGE_001: 'Breitengrad muss zwischen -90 und 90 liegen.',
            RANGE_002: 'Längengrad muss zwischen -180 und 180 liegen.'
        },
        directions: {
            secondary: 'Sekundärprogression',
            tertiary: 'Tertiärprogression',
            solarArc: 'Sonnenbogendirektion',
            primary: 'Primärdirektion'
        },
        general: {
            age: 'Alter',
            year: 'Jahr',
            degree: 'Grad',
            orb: 'Orb',
            applying: 'Anwendend',
            separating: 'Trennend',
            natal: 'Natal',
            transit: 'Transit',
            return: 'Rückkehr'
        }
    },
    fr: {
        planets: {
            0: 'Soleil',
            1: 'Lune',
            2: 'Mercure',
            3: 'Vénus',
            4: 'Mars',
            5: 'Jupiter',
            6: 'Saturne',
            7: 'Uranus',
            8: 'Neptune',
            9: 'Pluton',
            10: 'Noeud Nord',
            11: 'Noeud Sud',
            12: 'Chiron',
            13: 'Pholus',
            14: 'Cérès',
            15: 'Pallas',
            16: 'Junon',
            17: 'Vesta',
            18: 'Éris',
            19: 'Sedna',
            20: 'Lilith'
        },
        signs: [
            'Bélier', 'Taureau', 'Gémeaux', 'Cancer', 'Lion', 'Vierge',
            'Balance', 'Scorpion', 'Sagittaire', 'Capricorne', 'Verseau', 'Poissons'
        ],
        houses: [
            'Maison 1', 'Maison 2', 'Maison 3', 'Maison 4', 'Maison 5', 'Maison 6',
            'Maison 7', 'Maison 8', 'Maison 9', 'Maison 10', 'Maison 11', 'Maison 12'
        ],
        aspects: {
            0: 'Conjonction',
            60: 'Sextile',
            90: 'Carré',
            120: 'Trigone',
            180: 'Opposition',
            30: 'Semi-sextile',
            45: 'Semi-carré',
            135: 'Sesqui-carré',
            150: 'Inconjoint'
        },
        errors: {
            EPHE_001: 'Fichier éphémérides non trouvé.',
            EPHE_002: 'Impossible de lire le fichier éphémérides.',
            DATE_001: 'Date invalide.',
            DATE_002: 'Date hors de portée.',
            CALC_001: 'Erreur de calcul.',
            RANGE_001: 'La latitude doit être entre -90 et 90.',
            RANGE_002: 'La longitude doit être entre -180 et 180.'
        },
        directions: {
            secondary: 'Progression Secondaire',
            tertiary: 'Progression Tertiaire',
            solarArc: 'Direction par Arc Solaire',
            primary: 'Direction Primaire'
        },
        general: {
            age: 'Âge',
            year: 'Année',
            degree: 'Degré',
            orb: 'Orbe',
            applying: 'Appliquant',
            separating: 'Séparant',
            natal: 'Natal',
            transit: 'Transit',
            return: 'Retour'
        }
    },
    es: {
        planets: {
            0: 'Sol',
            1: 'Luna',
            2: 'Mercurio',
            3: 'Venus',
            4: 'Marte',
            5: 'Júpiter',
            6: 'Saturno',
            7: 'Urano',
            8: 'Neptuno',
            9: 'Plutón',
            10: 'Nodo Norte',
            11: 'Nodo Sur',
            12: 'Quirón',
            13: 'Folo',
            14: 'Ceres',
            15: 'Palas',
            16: 'Juno',
            17: 'Vesta',
            18: 'Eris',
            19: 'Sedna',
            20: 'Lilith'
        },
        signs: [
            'Aries', 'Tauro', 'Géminis', 'Cáncer', 'Leo', 'Virgo',
            'Libra', 'Escorpio', 'Sagitario', 'Capricornio', 'Acuario', 'Piscis'
        ],
        houses: [
            'Casa 1', 'Casa 2', 'Casa 3', 'Casa 4', 'Casa 5', 'Casa 6',
            'Casa 7', 'Casa 8', 'Casa 9', 'Casa 10', 'Casa 11', 'Casa 12'
        ],
        aspects: {
            0: 'Conjunción',
            60: 'Sextil',
            90: 'Cuadratura',
            120: 'Trígono',
            180: 'Oposición',
            30: 'Semisextil',
            45: 'Semicuadratura',
            135: 'Sesquicuadratura',
            150: 'Inconjunto'
        },
        errors: {
            EPHE_001: 'Archivo de efemérides no encontrado.',
            EPHE_002: 'No se pudo leer el archivo de efemérides.',
            DATE_001: 'Fecha inválida.',
            DATE_002: 'Fecha fuera de rango.',
            CALC_001: 'Error de cálculo.',
            RANGE_001: 'La latitud debe estar entre -90 y 90.',
            RANGE_002: 'La longitud debe estar entre -180 y 180.'
        },
        directions: {
            secondary: 'Progresión Secundaria',
            tertiary: 'Progresión Terciaria',
            solarArc: 'Dirección por Arco Solar',
            primary: 'Dirección Primaria'
        },
        general: {
            age: 'Edad',
            year: 'Año',
            degree: 'Grado',
            orb: 'Orbe',
            applying: 'Aplicando',
            separating: 'Separando',
            natal: 'Natal',
            transit: 'Tránsito',
            return: 'Retorno'
        }
    }
};
export class I18n {
    static currentLanguage = 'tr';
    static setLanguage(lang) {
        if (translations[lang]) {
            this.currentLanguage = lang;
        }
        else {
            console.warn(`Language '${lang}' not supported. Falling back to 'tr'.`);
        }
    }
    static getLanguage() {
        return this.currentLanguage;
    }
    static t(key, params) {
        const lang = this.currentLanguage;
        const translation = translations[lang];
        const keys = key.split('.');
        let value = translation;
        for (const k of keys) {
            if (value && typeof value === 'object') {
                value = value[k];
            }
            else {
                value = undefined;
                break;
            }
        }
        if (value === undefined) {
            // Fallback to English
            const enValue = this.getNestedValue(translations.en, keys);
            value = enValue || key;
        }
        // Parameter substitution
        if (typeof value === 'string' && params) {
            Object.entries(params).forEach(([paramKey, paramValue]) => {
                value = value.replace(`{${paramKey}}`, String(paramValue));
            });
        }
        return String(value);
    }
    static getNestedValue(obj, keys) {
        let value = obj;
        for (const key of keys) {
            if (value && typeof value === 'object') {
                value = value[key];
            }
            else {
                return undefined;
            }
        }
        return value;
    }
    static getPlanetName(body) {
        return translations[this.currentLanguage].planets[body] || `Body ${body}`;
    }
    static getSignName(longitude) {
        const signIndex = Math.floor(longitude / 30);
        return translations[this.currentLanguage].signs[signIndex] || 'Unknown';
    }
    static getHouseName(houseNumber) {
        return translations[this.currentLanguage].houses[houseNumber - 1] || `House ${houseNumber}`;
    }
    static getAspectName(aspect) {
        return translations[this.currentLanguage].aspects[aspect] || `${aspect}°`;
    }
    static getErrorMessage(code) {
        return translations[this.currentLanguage].errors[code] || `Error: ${code}`;
    }
}
export { translations };
//# sourceMappingURL=index.js.map