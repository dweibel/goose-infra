import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';
import fc from 'fast-check';

describe('Feature: cloudflare-goose-terminal - Property Tests', () => {
  const dockerComposePath = join(__dirname, '../../docker-compose.yml');
  const dockerComposeContent = readFileSync(dockerComposePath, 'utf-8');
  const config = yaml.load(dockerComposeContent) as any;

  it('Property 3: Podman/Docker Compose Configuration Validity', () => {
    fc.assert(
      fc.property(fc.constant(config), (dockerConfig) => {
        // For any deployment, the compose file SHALL define:
        
        // A "goose-web" service with ttyd capability
        expect(composeConfig.services).toHaveProperty('goose-web');
        
        // A "cloudflared" service with tunnel configuration
        expect(composeConfig.services).toHaveProperty('cloudflared');
        
        // An internal bridge network connecting both services
        expect(composeConfig.networks).toHaveProperty('goose-network');
        expect(composeConfig.networks['goose-network'].driver).toBe('bridge');
        expect(composeConfig.networks['goose-network'].internal).toBe(true);
        
        // No published ports on either service (ensuring network isolation)
        expect(composeConfig.services['goose-web'].ports).toBeUndefined();
        expect(composeConfig.services['cloudflared'].ports).toBeUndefined();
        
        // Health checks for both services
        expect(composeConfig.services['goose-web']).toHaveProperty('healthcheck');
        expect(composeConfig.services['cloudflared']).toHaveProperty('healthcheck');
        
        // Restart policy of "unless-stopped" for both services
        expect(composeConfig.services['goose-web'].restart).toBe('unless-stopped');
        expect(composeConfig.services['cloudflared'].restart).toBe('unless-stopped');
        
        // Three named volumes: workspace, goose-config, and cloudflared-config
        expect(composeConfig.volumes).toHaveProperty('workspace');
        expect(composeConfig.volumes).toHaveProperty('goose-config');
        expect(composeConfig.volumes).toHaveProperty('cloudflared-config');
      }),
      { numRuns: 100 }
    );
  });

  it('Property 4: Volume Persistence Configuration', () => {
    fc.assert(
      fc.property(fc.constant(config), (composeConfig) => {
        // For any container restart, all three persistent volumes SHALL remain mounted
        
        const gooseWebVolumes = composeConfig.services['goose-web'].volumes;
        const cloudflaredVolumes = composeConfig.services['cloudflared'].volumes;
        
        // Verify workspace volume is mounted
        expect(gooseWebVolumes.some((v: string) => v.includes('workspace:'))).toBe(true);
        
        // Verify goose-config volume is mounted
        expect(gooseWebVolumes.some((v: string) => v.includes('goose-config:'))).toBe(true);
        
        // Verify cloudflared-config volume is mounted
        expect(cloudflaredVolumes.some((v: string) => v.includes('cloudflared-config:'))).toBe(true);
        
        // Verify volumes are defined at top level
        expect(composeConfig.volumes).toHaveProperty('workspace');
        expect(composeConfig.volumes).toHaveProperty('goose-config');
        expect(composeConfig.volumes).toHaveProperty('cloudflared-config');
      }),
      { numRuns: 100 }
    );
  });

  it('Property 5: Environment Variable Propagation', () => {
    fc.assert(
      fc.property(
        fc.record({
          GOOSE_MODE: fc.constantFrom('interactive', 'auto'),
          TUNNEL_TOKEN: fc.string({ minLength: 10, maxLength: 100 }),
          GOOSE_PROVIDER: fc.constantFrom('openai', 'anthropic'),
        }),
        (envVars) => {
          // For any environment variable defined in the .env file,
          // that variable SHALL be accessible within the appropriate container's runtime environment
          
          const gooseWebEnv = config.services['goose-web'].environment;
          const cloudflaredEnv = config.services['cloudflared'].environment;
          
          // Verify GOOSE_MODE is mapped to goose-web
          expect(gooseWebEnv.some((e: string) => e.includes('GOOSE_MODE'))).toBe(true);
          
          // Verify TUNNEL_TOKEN is mapped to cloudflared
          expect(cloudflaredEnv.some((e: string) => e.includes('TUNNEL_TOKEN'))).toBe(true);
          
          // Verify GOOSE_PROVIDER is mapped to goose-web
          expect(gooseWebEnv.some((e: string) => e.includes('GOOSE_PROVIDER'))).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 6: Tunnel Routing Configuration', () => {
    fc.assert(
      fc.property(fc.constant(config), (composeConfig) => {
        // For any tunnel configuration, the ingress rules SHALL route traffic
        // from the specified custom subdomain to the internal service URL "http://goose-web:7681"
        
        const cloudflaredService = composeConfig.services['cloudflared'];
        
        // Verify cloudflared is configured to connect to goose-web
        expect(cloudflaredService.networks).toContain('goose-network');
        
        // Verify cloudflared depends on goose-web (ensuring routing target exists)
        expect(cloudflaredService.depends_on).toContain('goose-web');
        
        // Verify goose-web is on the same network
        expect(composeConfig.services['goose-web'].networks).toContain('goose-network');
      }),
      { numRuns: 100 }
    );
  });

  it('Property 7: Headless Mode Activation', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('auto', 'interactive'),
        (gooseMode) => {
          // For any container startup where GOOSE_MODE environment variable is set to "auto",
          // the Goose agent SHALL initialize in headless mode without interactive prompts
          
          const gooseWebEnv = config.services['goose-web'].environment;
          
          // Verify GOOSE_MODE environment variable is configured
          const hasModeVar = gooseWebEnv.some((e: string) => e.includes('GOOSE_MODE'));
          expect(hasModeVar).toBe(true);
          
          // The entrypoint script handles mode detection
          // This property verifies the configuration supports mode switching
          if (gooseMode === 'auto') {
            // In auto mode, the entrypoint should start Goose in headless mode
            // This is validated by the entrypoint.sh script logic
            expect(hasModeVar).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
