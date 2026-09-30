import { describe, it, expect } from 'vitest';
import { buildMotionArchitectSystemPrompt, buildRetryPrompt } from '../system-prompt';
import { analyzeCodeSafety } from '../../../renderer/sandbox/static-analyzer';

describe('System Prompt (v2.0 Canvas2D Generative)', () => {
  it('generates system prompt containing drawFrame function signature and parameters', () => {
    const prompt = buildMotionArchitectSystemPrompt();

    expect(prompt).toContain('function drawFrame(ctx, t, width, height, opts)');
    expect(prompt).toContain('opts.random()');
    expect(prompt).toContain('SEAMLESS LOOPING');
    expect(prompt).toContain('DETERMINISTIC RANDOMNESS');
    expect(prompt).toContain('STRICTLY PROHIBITED APIS');
    expect(prompt).toContain('VISUAL RICHNESS FLOOR');
    expect(prompt).toContain('MATHEMATICAL STRUCTURE & SHAPE LEGIBILITY');
    expect(prompt).toContain('Subtle Perturbation Only');
    expect(prompt).toContain('Continuous Color Gradients');
    expect(prompt).toContain('Consistent Opacity & Continuous Flow');
    expect(prompt).toContain('1-Second Static Recognition Test');
    expect(prompt).toContain('STRICT PROMPT FIDELITY');
  });

  it('adjusts locked canvas constraint and dimensions based on aspect ratio setting', () => {
    const prompt169 = buildMotionArchitectSystemPrompt({ aspectRatio: '16:9' });
    expect(prompt169).toContain('width: 1920, height: 1080');

    const prompt916 = buildMotionArchitectSystemPrompt({ aspectRatio: '9:16' });
    expect(prompt916).toContain('width: 1080, height: 1920');

    const prompt11 = buildMotionArchitectSystemPrompt({ aspectRatio: '1:1' });
    expect(prompt11).toContain('width: 1080, height: 1080');
  });

  it('handles green screen background setting correctly', () => {
    const promptGreen = buildMotionArchitectSystemPrompt({ greenScreen: true });
    expect(promptGreen).toContain('#00B140');
    expect(promptGreen).toContain('Green screen is ENABLED');

    const promptDefault = buildMotionArchitectSystemPrompt({ greenScreen: false });
    expect(promptDefault).toContain('clearRect');
  });

  it('contains all 3 diversified Canvas2D few-shot examples', () => {
    const prompt = buildMotionArchitectSystemPrompt();

    expect(prompt).toContain('Example 1: Theme "neon particles" / Flow Field');
    expect(prompt).toContain('Example 2: Theme "rotating hexagon lattice" / Pulsing Geometric');
    expect(prompt).toContain('Example 3: Theme "grafik tren naik" / Financial Data Growth Wave');
  });

  it('validates that all few-shot examples in system prompt pass static analysis', () => {
    const prompt = buildMotionArchitectSystemPrompt({ aspectRatio: '1:1' });

    // Extract all JS code blocks following "Example N: ..."
    const exampleRegex = /Example \d+:[^\n]+\n```javascript\n([\s\S]*?)\n```/g;
    const codeBlocks: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = exampleRegex.exec(prompt)) !== null) {
      if (match[1]) {
        codeBlocks.push(match[1]);
      }
    }

    expect(codeBlocks.length).toBe(3);

    for (let i = 0; i < codeBlocks.length; i++) {
      const code = codeBlocks[i] ?? '';
      const analysis = analyzeCodeSafety(code);
      if (!analysis.valid) {
        throw new Error(`Few-shot Example ${i + 1} failed static analysis: ${analysis.errors.join(', ')}`);
      }
      expect(analysis.valid).toBe(true);
      expect(analysis.errors.length).toBe(0);
    }
  });

  it('buildRetryPrompt includes original prompt, errors, and Canvas2D constraints', () => {
    const retryPrompt = buildRetryPrompt(
      'A cyber grid lattice with pulsing neon dots',
      ['Loop seam error: RGBA Mean Absolute Error is 12.4 > 4.0 threshold between t=0.0 and t=1.0.'],
      { aspectRatio: '16:9' },
    );

    expect(retryPrompt).toContain('A cyber grid lattice with pulsing neon dots');
    expect(retryPrompt).toContain('Loop seam error: RGBA Mean Absolute Error is 12.4');
    expect(retryPrompt).toContain('SEAMLESS LOOPING (MANDATORY)');
    expect(retryPrompt).toContain('NO FORBIDDEN APIS');
    expect(retryPrompt).toContain('SHAPE LEGIBILITY');
    expect(retryPrompt).toContain('width: 1920 and height: 1080 (16:9)');
  });
});
