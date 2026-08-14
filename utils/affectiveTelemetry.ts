/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AffectiveTelemetry } from '../types';

export const AFFECTIVE_PRESETS: Record<string, Omit<AffectiveTelemetry, 'enabled' | 'activePreset'>> = {
  'End User': {
    toneAuthority: 30,
    emotionalPolarity: 75,
    abstractionLevel: 25,
    proceduralAssertiveness: 40
  },
  'Technician': {
    toneAuthority: 70,
    emotionalPolarity: 50,
    abstractionLevel: 50,
    proceduralAssertiveness: 75
  },
  'IT Staff': {
    toneAuthority: 85,
    emotionalPolarity: 55,
    abstractionLevel: 80,
    proceduralAssertiveness: 60
  }
};

export const DEFAULT_AFFECTIVE_TELEMETRY: AffectiveTelemetry = {
  toneAuthority: 50,
  emotionalPolarity: 50,
  abstractionLevel: 50,
  proceduralAssertiveness: 50,
  enabled: true,
  activePreset: 'Custom'
};

export function getAffectivePromptDirective(telemetry: AffectiveTelemetry): string {
  return `[AFFECTIVE TELEMETRY DIRECTIVES]
- Tone Authority: ${telemetry.toneAuthority}/100 (0=Deferential, 50=Neutral, 100=Authoritative)
- Emotional Polarity: ${telemetry.emotionalPolarity}/100 (0=Negative, 50=Neutral, 100=Positive)
- Abstraction Level: ${telemetry.abstractionLevel}/100 (0=Concrete, 50=Balanced, 100=Abstract)
- Procedural Assertiveness: ${telemetry.proceduralAssertiveness}/100 (0=Suggestive, 50=Directive, 100=Enforced)

Instruction: Adapt vocabulary choice, tone, sentence pacing, and instructional framing to strictly mirror these affective coordinates while preserving all technical facts and markdown structure.`;
}

export function appendAffectiveContext(basePrompt: string, telemetry: AffectiveTelemetry): string {
  if (!telemetry.enabled) return basePrompt;
  const directive = getAffectivePromptDirective(telemetry);
  return `${basePrompt}\n\n${directive}`;
}

export function loadAffectiveTelemetry(documentId?: string): AffectiveTelemetry {
  try {
    const key = documentId ? `affective-telemetry-${documentId}` : 'affective-telemetry-global';
    const raw = localStorage.getItem(key) || localStorage.getItem('affective-telemetry-global');
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_AFFECTIVE_TELEMETRY, ...parsed };
    }
  } catch {
    // Ignore storage parse errors
  }
  return DEFAULT_AFFECTIVE_TELEMETRY;
}

export function saveAffectiveTelemetry(telemetry: AffectiveTelemetry, documentId?: string): void {
  try {
    const serialized = JSON.stringify(telemetry);
    localStorage.setItem('affective-telemetry-global', serialized);
    if (documentId) {
      localStorage.setItem(`affective-telemetry-${documentId}`, serialized);
    }
  } catch {
    // Ignore quota errors
  }
}
