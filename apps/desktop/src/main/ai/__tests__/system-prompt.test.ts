import { describe, it, expect } from 'vitest';
import { buildMotionArchitectSystemPrompt, buildRetryPrompt } from '../system-prompt';
import { validateMotionBlueprint } from '@genc/motion-schema';

describe('System Prompt & Visual Richness Floor', () => {
  it('generates system prompt containing both Strict Prompt Fidelity and Visual Richness Floor', () => {
    const prompt = buildMotionArchitectSystemPrompt();

    // Verify presence of Strict Prompt Fidelity
    expect(prompt).toContain('STRICT PROMPT FIDELITY');
    expect(prompt).toContain('MANDATORY PRE-FINALIZATION SELF-CHECK');

    // Verify presence of Visual Richness Floor rules
    expect(prompt).toContain('VISUAL RICHNESS FLOOR');
    expect(prompt).toContain('60%–70% Canvas Coverage');
    expect(prompt).toContain('Multi-Stroke / Layered Glow');
    expect(prompt).toContain('Scale / Size Hierarchy');
    expect(prompt).toContain('Concentric / Multi-Tier Nesting');
    expect(prompt).toContain('r = a + b * θ');
    expect(prompt).toContain('ASPECT RATIO-AWARE DENSITY SCALING');
  });

  it('contains all 6 diversified few-shot examples', () => {
    const prompt = buildMotionArchitectSystemPrompt();

    expect(prompt).toContain('Example 1: Dominant Particle System');
    expect(prompt).toContain('Example 2: Concentric Rotating Geometric Shapes');
    expect(prompt).toContain('Example 3: Flowing Wave Curves & Backdrop');
    expect(prompt).toContain('Example 4: Data Growth & Trend Chart');
    expect(prompt).toContain('Example 5: Animated Geometric Grid / Lattice');
    expect(prompt).toContain('Example 6: Mathematically Precise Archimedean Spiral');
  });

  it('adjusts locked canvas constraint and dimensions based on aspect ratio setting', () => {
    const prompt169 = buildMotionArchitectSystemPrompt({ aspectRatio: '16:9' });
    expect(prompt169).toContain('"width": 1920, "height": 1080');

    const prompt916 = buildMotionArchitectSystemPrompt({ aspectRatio: '9:16' });
    expect(prompt916).toContain('"width": 1080, "height": 1920');

    const prompt11 = buildMotionArchitectSystemPrompt({ aspectRatio: '1:1' });
    expect(prompt11).toContain('"width": 1080, "height": 1080');
  });

  it('buildRetryPrompt includes Visual Richness Floor and Strict Prompt Fidelity reminders', () => {
    const retryPrompt = buildRetryPrompt(
      'A cyber grid lattice with pulsing neon dots',
      ['Keyframe timestamps t must be in normalized progress range 0.0–1.0'],
      { aspectRatio: '16:9' },
    );

    expect(retryPrompt).toContain('STRICT PROMPT FIDELITY');
    expect(retryPrompt).toContain('VISUAL RICHNESS FLOOR');
    expect(retryPrompt).toContain('cover >= 60-70% of the canvas');
    expect(retryPrompt).toContain('width: 1920 and height: 1080');
    expect(retryPrompt).toContain('Keyframe timestamps t must be in normalized progress range 0.0–1.0');
    expect(retryPrompt).toContain('shape: "polygon" with "sides": 6');
  });

  it('contains explicit Shape Enum Enforcement and concrete hexagon polygon example', () => {
    const prompt = buildMotionArchitectSystemPrompt();

    expect(prompt).toContain('SHAPE LAYER CLOSED ENUM');
    expect(prompt).toContain('"rect" | "circle" | "polygon" | "star"');
    expect(prompt).toContain('Concrete Example for Hexagon');
    expect(prompt).toContain('"shape": "polygon"');
    expect(prompt).toContain('"sides": 6');
  });

  it('contains explicit Anti-Copy-Paste mandate in few-shot header and Example 4', () => {
    const prompt = buildMotionArchitectSystemPrompt();

    expect(prompt).toContain('ANTI-COPY-PASTE MANDATE');
    expect(prompt).toContain('STRICT ANTI-COPY-PASTE RULE');
    expect(prompt).toContain('STRUCTURAL PATTERN REFERENCE ONLY');
  });

  it('validates that all few-shot examples in system prompt can be parsed as valid Motion Blueprints', () => {
    const prompt = buildMotionArchitectSystemPrompt({ aspectRatio: '1:1' });

    // Extract all JSON objects following "Example N: ..."
    const exampleRegex = /Example \d+:[^\n]+\n(\{[\s\S]*?\n\})(?=\n\nExample|\n*$)/g;
    const jsonMatches: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = exampleRegex.exec(prompt)) !== null) {
      if (match[1]) {
        jsonMatches.push(match[1]);
      }
    }

    expect(jsonMatches.length).toBe(6);

    for (let i = 0; i < jsonMatches.length; i++) {
      const rawJson = jsonMatches[i] ?? '';
      let parsed: unknown;
      expect(() => {
        parsed = JSON.parse(rawJson);
      }).not.toThrow();

      const validation = validateMotionBlueprint(parsed, { expectedAspectRatio: '1:1' });
      if (!validation.valid) {
        throw new Error(`Example ${i + 1} validation failed: ${validation.errors.join(', ')}`);
      }
      expect(validation.valid).toBe(true);
      expect(validation.blueprint).toBeDefined();
    }
  });
});
