/**
 * Lisans Yönetim Sistemi
 * AGPL-3.0 ve Ticari Lisans seçenekleri için uyumluluk araçları
 */

export enum LicenseType {
  AGPL = 'AGPL-3.0',
  COMMERCIAL = 'Commercial',
  OEM = 'OEM',
  ENTERPRISE = 'Enterprise'
}

export interface LicenseInfo {
  type: LicenseType;
  validUntil?: Date;
  features: string[];
  maxUsers?: number;
  allowedDomains?: string[];
  supportLevel: 'community' | 'email' | 'priority' | 'dedicated';
}

export interface ComplianceCheckResult {
  compliant: boolean;
  violations: Array<{
    code: string;
    severity: 'error' | 'warning' | 'info';
    message: string;
    suggestion: string;
  }>;
  recommendations: string[];
}

/**
 * Lisans doğrulama
 */
export function validateLicense(licenseKey?: string): LicenseInfo {
  // AGPL için lisans anahtarı gerekmez
  if (!licenseKey) {
    return {
      type: LicenseType.AGPL,
      features: [
        'natal_chart',
        'transits',
        'synastry',
        'returns',
        'eclipses',
        'asteroids_basic',
        'fixed_stars',
        'lots',
        'aspects',
        'dignities',
        'declinations',
        'time_lords'
      ],
      supportLevel: 'community'
    };
  }

  // Ticari lisans doğrulama (örnek implementasyon)
  const decoded = decodeLicenseKey(licenseKey);
  
  if (!decoded || decoded.validUntil < new Date()) {
    throw new Error('Geçersiz veya süresi dolmuş lisans anahtarı');
  }

  return {
    type: LicenseType.COMMERCIAL,
    validUntil: decoded.validUntil,
    features: [
      ...validateLicense().features,
      'asteroids_extended',
      'batch_processing',
      'api_access',
      'white_label',
      'priority_support'
    ],
    maxUsers: decoded.maxUsers,
    allowedDomains: decoded.domains,
    supportLevel: 'priority'
  };
}

/**
 * Uyumluluk kontrolü
 */
export function checkCompliance(usage: {
  isCommercial: boolean;
  isClosedSource: boolean;
  hasDerivativeWorks: boolean;
  distributionMethod: 'saas' | 'download' | 'embedded';
  userCount: number;
}): ComplianceCheckResult {
  const violations: ComplianceCheckResult['violations'] = [];
  const recommendations: string[] = [];

  // AGPL gereksinimleri
  if (usage.isCommercial && !usage.isClosedSource) {
    recommendations.push('Ticari kullanım için Astrodienst ile iletişime geçin');
  }

  if (usage.isClosedSource && usage.hasDerivativeWorks) {
    violations.push({
      code: 'AGPL_001',
      severity: 'error',
      message: 'Kapalı kaynak projede AGPL kodu kullanılamaz',
      suggestion: 'Ticari lisans alın veya açık kaynak yapın'
    });
  }

  if (usage.distributionMethod === 'embedded') {
    violations.push({
      code: 'AGPL_002',
      severity: 'warning',
      message: 'Gömülü kullanım için ek lisans gerekebilir',
      suggestion: 'Astrodienst OEM lisansı hakkında bilgi alın'
    });
  }

  if (usage.userCount > 1000 && !usage.isClosedSource) {
    recommendations.push('Yüksek kullanıcı sayısı için enterprise lisans düşünün');
  }

  // Swiss Ephemeris özel gereksinimleri
  violations.push({
    code: 'SWEPH_001',
    severity: 'info',
    message: 'Swiss Ephemeris verileri Astro.com tarafından sağlanmaktadır',
    suggestion: 'Veri kullanım koşullarını inceleyin: https://www.astro.com/swisseph/'
  });

  return {
    compliant: violations.filter(v => v.severity === 'error').length === 0,
    violations,
    recommendations
  };
}

/**
 * Lisans anahtarı oluşturma (demo)
 */
export function generateLicenseKey(config: {
  type: LicenseType;
  validMonths: number;
  maxUsers: number;
  domains: string[];
}): string {
  const validUntil = new Date();
  validUntil.setMonth(validUntil.getMonth() + config.validMonths);

  const payload = {
    exp: validUntil.getTime(),
    max: config.maxUsers,
    dom: config.domains,
    rand: Math.random().toString(36).substring(2, 15)
  };

  // Base64 encoding (gerçek implementasyonda JWT veya benzeri kullanılmalı)
  return 'SWISS_' + Buffer.from(JSON.stringify(payload)).toString('base64');
}

/**
 * Lisans karşılaştırma tablosu
 */
export function getLicenseComparison(): Array<{
  feature: string;
  agpl: boolean;
  commercial: boolean;
  oem: boolean;
  enterprise: boolean;
}> {
  return [
    { feature: 'Natal Chart Hesaplama', agpl: true, commercial: true, oem: true, enterprise: true },
    { feature: 'Transit Analizi', agpl: true, commercial: true, oem: true, enterprise: true },
    { feature: 'Synastry', agpl: true, commercial: true, oem: true, enterprise: true },
    { feature: 'Güneş Dönüşü', agpl: true, commercial: true, oem: true, enterprise: true },
    { feature: 'Tutulmalar', agpl: true, commercial: true, oem: true, enterprise: true },
    { feature: '16 Asteroid', agpl: true, commercial: true, oem: true, enterprise: true },
    { feature: '100+ Asteroid', agpl: false, commercial: true, oem: true, enterprise: true },
    { feature: 'Batch Processing', agpl: false, commercial: true, oem: true, enterprise: true },
    { feature: 'API Erişimi', agpl: false, commercial: true, oem: true, enterprise: true },
    { feature: 'White Label', agpl: false, commercial: false, oem: true, enterprise: true },
    { feature: 'Özel Entegrasyon', agpl: false, commercial: false, oem: false, enterprise: true },
    { feature: 'SLA Desteği', agpl: false, commercial: false, oem: false, enterprise: true },
    { feature: 'Kaynak Kod Erişimi', agpl: true, commercial: false, oem: false, enterprise: true },
    { feature: 'Sınırsız Kullanıcı', agpl: true, commercial: false, oem: 'limited' as any, enterprise: true }
  ];
}

/**
 * Fiyatlandırma rehberi (tahmini)
 */
export function getPricingEstimate(type: LicenseType): {
  basePrice: number;
  currency: string;
  billingCycle: 'monthly' | 'yearly' | 'one-time';
  notes: string[];
} {
  switch (type) {
    case LicenseType.AGPL:
      return {
        basePrice: 0,
        currency: 'USD',
        billingCycle: 'one-time',
        notes: ['Açık kaynak proje gerektirir', 'Topluluk desteği', 'Kredi verilmesi zorunlu']
      };
    
    case LicenseType.COMMERCIAL:
      return {
        basePrice: 499,
        currency: 'USD',
        billingCycle: 'yearly',
        notes: ['Kapalı kaynak kullanım hakkı', '1000 kullanıcıya kadar', 'Email desteği', 'Yıllık güncelleme']
      };
    
    case LicenseType.OEM:
      return {
        basePrice: 2999,
        currency: 'USD',
        billingCycle: 'yearly',
        notes: ['Ürün içine gömme hakkı', '5000 kullanıcıya kadar', 'Öncelikli destek', 'Özel branding']
      };
    
    case LicenseType.ENTERPRISE:
      return {
        basePrice: 9999,
        currency: 'USD',
        billingCycle: 'yearly',
        notes: ['Sınırsız kullanıcı', 'Özel entegrasyon', 'Dedicated support', 'SLA garantisi', 'Kaynak kod erişimi']
      };
  }
}

/**
 * İletişim bilgileri
 */
export const CONTACT_INFO = {
  astrodienst: {
    name: 'Astrolog.com AG',
    website: 'https://www.astro.com',
    email: 'support@astro.ch',
    licenseInquiry: 'https://www.astro.com/swisseph/licence_e.htm'
  },
  kuntay: {
    website: 'https://github.com/kuntay/swisseph-wasm',
    email: 'license@kuntay.dev'
  }
};

// Helper functions
function decodeLicenseKey(key: string): { 
  validUntil: Date; 
  maxUsers: number; 
  domains: string[];
} | null {
  try {
    if (!key.startsWith('SWISS_')) return null;
    
    const base64 = key.substring(6);
    const json = Buffer.from(base64, 'base64').toString('utf-8');
    const payload = JSON.parse(json);
    
    return {
      validUntil: new Date(payload.exp),
      maxUsers: payload.max,
      domains: payload.dom
    };
  } catch {
    return null;
  }
}

export {
  LicenseType,
  type LicenseInfo,
  type ComplianceCheckResult
};
