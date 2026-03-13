import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';

describe('Feature: cloudflare-goose-terminal - Podman Compose Configuration', () => {
  const dockerComposePath = join(__dirname, '../../docker-compose.yml');
  const dockerComposeContent = readFileSync(dockerComposePath, 'utf-8');
  const config = yaml.load(dockerComposeContent) as any;

  it('3.1 - compose file defines goose-web service', () => {
    expect(config.services).toHaveProperty('goose-web');
    expect(config.services['goose-web']).toBeDefined();
  });

  it('3.1 - compose file defines cloudflared service', () => {
    expect(config.services).toHaveProperty('cloudflared');
    expect(config.services['cloudflared']).toBeDefined();
  });

  it('3.1 - goose-web service has build configuration', () => {
    expect(config.services['goose-web']).toHaveProperty('build');
    expect(config.services['goose-web'].build).toHaveProperty('dockerfile');
    expect(config.services['goose-web'].build.dockerfile).toBe('Dockerfile.goose-web');
  });

  it('3.1 - cloudflared service uses official image', () => {
    expect(config.services['cloudflared']).toHaveProperty('image');
    expect(config.services['cloudflared'].image).toContain('cloudflare/cloudflared');
  });

  it('3.1 - internal bridge network is configured', () => {
    expect(config.networks).toHaveProperty('goose-network');
    expect(config.networks['goose-network'].driver).toBe('bridge');
    expect(config.networks['goose-network'].internal).toBe(true);
  });

  it('3.1 - no published ports on goose-web', () => {
    const gooseWeb = config.services['goose-web'];
    expect(gooseWeb.ports).toBeUndefined();
  });

  it('3.1 - no published ports on cloudflared', () => {
    const cloudflared = config.services['cloudflared'];
    expect(cloudflared.ports).toBeUndefined();
  });

  it('3.1 - three named volumes are defined', () => {
    expect(config.volumes).toHaveProperty('workspace');
    expect(config.volumes).toHaveProperty('goose-config');
    expect(config.volumes).toHaveProperty('cloudflared-config');
  });

  it('3.1 - restart policy is unless-stopped for both services', () => {
    expect(config.services['goose-web'].restart).toBe('unless-stopped');
    expect(config.services['cloudflared'].restart).toBe('unless-stopped');
  });

  it('3.1 - cloudflared depends on goose-web', () => {
    expect(config.services['cloudflared'].depends_on).toContain('goose-web');
  });

  it('3.2 - goose-web has health check configuration', () => {
    expect(config.services['goose-web']).toHaveProperty('healthcheck');
    expect(config.services['goose-web'].healthcheck).toHaveProperty('test');
    expect(config.services['goose-web'].healthcheck).toHaveProperty('interval');
    expect(config.services['goose-web'].healthcheck).toHaveProperty('timeout');
    expect(config.services['goose-web'].healthcheck).toHaveProperty('retries');
  });

  it('3.2 - cloudflared has health check configuration', () => {
    expect(config.services['cloudflared']).toHaveProperty('healthcheck');
    expect(config.services['cloudflared'].healthcheck).toHaveProperty('test');
    expect(config.services['cloudflared'].healthcheck).toHaveProperty('interval');
    expect(config.services['cloudflared'].healthcheck).toHaveProperty('timeout');
    expect(config.services['cloudflared'].healthcheck).toHaveProperty('retries');
  });

  it('3.3 - goose-web mounts workspace volume', () => {
    const volumes = config.services['goose-web'].volumes;
    expect(volumes.some((v: string) => v.includes('workspace:/workspace'))).toBe(true);
  });

  it('3.3 - goose-web mounts goose-config volume', () => {
    const volumes = config.services['goose-web'].volumes;
    expect(volumes.some((v: string) => v.includes('goose-config:/root/.config/goose'))).toBe(true);
  });

  it('3.3 - cloudflared mounts cloudflared-config volume', () => {
    const volumes = config.services['cloudflared'].volumes;
    expect(volumes.some((v: string) => v.includes('cloudflared-config:/etc/cloudflared'))).toBe(true);
  });

  it('3.4 - goose-web has GOOSE_MODE environment variable', () => {
    const env = config.services['goose-web'].environment;
    expect(env.some((e: string) => e.includes('GOOSE_MODE'))).toBe(true);
  });

  it('3.4 - goose-web has GOOSE_PROVIDER environment variable', () => {
    const env = config.services['goose-web'].environment;
    expect(env.some((e: string) => e.includes('GOOSE_PROVIDER'))).toBe(true);
  });

  it('3.4 - goose-web has GOOSE_API_KEY environment variable', () => {
    const env = config.services['goose-web'].environment;
    expect(env.some((e: string) => e.includes('GOOSE_API_KEY'))).toBe(true);
  });

  it('3.4 - cloudflared has TUNNEL_TOKEN environment variable', () => {
    const env = config.services['cloudflared'].environment;
    expect(env.some((e: string) => e.includes('TUNNEL_TOKEN'))).toBe(true);
  });

  it('11.2 - network security validation: no port mappings', () => {
    // Verify no services have ports published (Podman/Docker security best practice)
    for (const [serviceName, service] of Object.entries(config.services)) {
      expect((service as any).ports).toBeUndefined();
    }
  });

  it('11.2 - network security validation: internal bridge network', () => {
    expect(config.networks['goose-network'].driver).toBe('bridge');
    expect(config.networks['goose-network'].internal).toBe(true);
  });
});
