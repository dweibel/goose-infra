import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Feature: cloudflare-goose-terminal - Environment Configuration', () => {
  it('4.2 - .env.example contains all required variables', () => {
    const envExamplePath = join(__dirname, '../../.env.example');
    const envContent = readFileSync(envExamplePath, 'utf-8');

    const requiredVars = [
      'TUNNEL_TOKEN',
      'TUNNEL_SUBDOMAIN',
      'GOOSE_MODE',
      'GOOSE_CONTEXT_STRATEGY',
      'GOOSE_MAX_TURNS',
      'GOOSE_PROVIDER',
      'GOOSE_API_KEY',
      'TTYD_PORT',
      'LOG_LEVEL',
    ];

    for (const varName of requiredVars) {
      expect(envContent).toContain(varName);
    }
  });

  it('4.2 - .env.example provides default values where appropriate', () => {
    const envExamplePath = join(__dirname, '../../.env.example');
    const envContent = readFileSync(envExamplePath, 'utf-8');

    // Check for default values
    expect(envContent).toContain('GOOSE_MODE=interactive');
    expect(envContent).toContain('GOOSE_CONTEXT_STRATEGY=default');
    expect(envContent).toContain('GOOSE_MAX_TURNS=10');
    expect(envContent).toContain('TTYD_PORT=7681');
    expect(envContent).toContain('LOG_LEVEL=INFO');
  });

  it('4.2 - .env.example includes comments explaining variables', () => {
    const envExamplePath = join(__dirname, '../../.env.example');
    const envContent = readFileSync(envExamplePath, 'utf-8');

    // Check for comment lines
    expect(envContent).toContain('#');
    expect(envContent.split('\n').filter(line => line.trim().startsWith('#')).length).toBeGreaterThan(5);
  });
});
