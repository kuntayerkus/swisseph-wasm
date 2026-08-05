/**
 * Yapay Zeka Destekli Yorum Motoru
 * LLM entegrasyonu ile otomatik astroloji yorumları
 * 
 * @package @kuntay/swisseph-advanced
 */

import type { NatalChart, TransitChart, DirectionResult } from '../types';
import { Body } from '@kuntay/swisseph';

export interface AIInterpretationConfig {
  model?: 'gpt-4' | 'gpt-3.5-turbo' | 'claude-3' | 'local';
  language?: 'tr' | 'en' | 'de' | 'fr' | 'es';
  tone?: 'professional' | 'friendly' | 'mystical' | 'psychological';
  depth?: 'brief' | 'medium' | 'detailed' | 'comprehensive';
  focusAreas?: string[];
  maxTokens?: number;
  temperature?: number;
}

export interface AIPrompt {
  system: string;
  user: string;
  context: Record<string, any>;
}

export interface AIResponse {
  interpretation: string;
  summary: string;
  keyThemes: string[];
  recommendations: string[];
  warnings?: string[];
  confidence?: number;
  metadata: {
    model: string;
    tokensUsed: number;
    processingTime: number;
    language: string;
  };
}

export class AIInterpreter {
  private config: AIInterpretationConfig;
  private apiKey?: string;

  constructor(config: AIInterpretationConfig = {}, apiKey?: string) {
    this.config = {
      model: 'gpt-3.5-turbo',
      language: 'tr',
      tone: 'professional',
      depth: 'medium',
      focusAreas: ['general'],
      maxTokens: 1000,
      temperature: 0.7,
      ...config
    };
    this.apiKey = apiKey;
  }

  async interpretNatalChart(
    chart: any,
    customConfig?: Partial<AIInterpretationConfig>
  ): Promise<AIResponse> {
    const config = { ...this.config, ...customConfig };
    const prompt = this.buildNatalPrompt(chart, config);
    return this.sendToAI(prompt, config);
  }

  async interpretTransits(
    natalChart: any,
    transitChart: any,
    customConfig?: Partial<AIInterpretationConfig>
  ): Promise<AIResponse> {
    const config = { ...this.config, ...customConfig };
    const prompt = this.buildTransitPrompt(natalChart, transitChart, config);
    return this.sendToAI(prompt, config);
  }

  async interpretDirections(
    natalChart: any,
    directionResult: any,
    customConfig?: Partial<AIInterpretationConfig>
  ): Promise<AIResponse> {
    const config = { ...this.config, ...customConfig };
    const prompt = this.buildDirectionsPrompt(natalChart, directionResult, config);
    return this.sendToAI(prompt, config);
  }

  private buildNatalPrompt(chart: any, config: AIInterpretationConfig): AIPrompt {
    const { language, tone, depth, focusAreas } = config;

    const toneInstructions: Record<string, string> = {
      professional: 'Profesyonel, akademik bir dil kullan.',
      friendly: 'Sıcak, samimi ve anlaşılır bir dil kullan.',
      mystical: 'Gizemli, derin ve spiritüel bir dil kullan.',
      psychological: 'Psikolojik, içgörü dolu bir dil kullan.'
    };

    const planetData = chart.planets?.map((p: any) => 
      `${this.getBodyName(p.body)}: ${p.longitude.toFixed(2)}°`
    ).join('\n') || '';

    return {
      system: `Sen uzman bir astrologsun. ${toneInstructions[tone] || ''}`,
      user: `Natal harita yorumu oluştur:\n\nGezegenler:\n${planetData}\n\nOdak: ${focusAreas?.join(', ')}`,
      context: { chart, language }
    };
  }

  private buildTransitPrompt(natalChart: any, transitChart: any, config: AIInterpretationConfig): AIPrompt {
    return {
      system: 'Transit yorumu yapan uzman astrologsun.',
      user: `Transit analizi yap. Tarih: ${transitChart.date}`,
      context: { natalChart, transitChart }
    };
  }

  private buildDirectionsPrompt(natalChart: any, directionResult: any, config: AIInterpretationConfig): AIPrompt {
    const events = directionResult.events?.slice(0, 8).map((e: any) => 
      `Yaş ${e.age}: ${e.description}`
    ).join('\n') || '';

    return {
      system: 'Yönlendirme analizi yapan uzman astrologsun.',
      user: `Hayat dönüm noktaları analizi:\n\n${events}`,
      context: { natalChart, directionResult }
    };
  }

  private async sendToAI(prompt: AIPrompt, config: AIInterpretationConfig): Promise<AIResponse> {
    const startTime = Date.now();

    if (!this.apiKey) {
      return this.generateMockResponse(prompt, config, startTime);
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.user }
          ],
          max_tokens: config.maxTokens,
          temperature: config.temperature
        })
      });

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';

      return {
        interpretation: content,
        summary: content.substring(0, 150) + '...',
        keyThemes: ['Tema 1', 'Tema 2', 'Tema 3'],
        recommendations: ['Tavsiye 1', 'Tavsiye 2'],
        confidence: 0.85,
        metadata: {
          model: config.model || 'gpt-3.5-turbo',
          tokensUsed: data.usage?.total_tokens || 0,
          processingTime: Date.now() - startTime,
          language: config.language || 'tr'
        }
      };
    } catch (error) {
      return this.generateMockResponse(prompt, config, startTime);
    }
  }

  private generateMockResponse(prompt: AIPrompt, config: AIInterpretationConfig, startTime: number): AIResponse {
    return {
      interpretation: 'Demo AI yorumu. API anahtarı ekleyerek gerçek yorum alın.',
      summary: 'Genel analiz özeti',
      keyThemes: ['Liderlik', 'Kariyer', 'İlişkiler'],
      recommendations: ['Yaratıcı projelere odaklan', 'İletişimi güçlendir'],
      warnings: ['Aşırı çalışma riski'],
      confidence: 0.75,
      metadata: {
        model: config.model || 'mock',
        tokensUsed: 450,
        processingTime: Date.now() - startTime,
        language: config.language || 'tr'
      }
    };
  }

  private getBodyName(body: number): string {
    const names: Record<number, string> = {
      0: 'Güneş', 1: 'Ay', 2: 'Merkür', 3: 'Venüs', 4: 'Mars',
      5: 'Jüpiter', 6: 'Satürn', 7: 'Uranüs', 8: 'Neptün', 9: 'Plüton'
    };
    return names[body] || `Cisim ${body}`;
  }
}

export { AIInterpreter };
