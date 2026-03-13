import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import fc from 'fast-check';

// Feature: oci-infra-repository, Property 1: Gitignore excludes sensitive patterns
// Validates: Requirements 1.5, 16.2

describe('Feature: oci-infra-repository - Property Tests', () => {
  const gitignorePath = join(__dirname, '../../.gitignore');
  const gitignoreContent = readFileSync(gitignorePath, 'utf-8');
  const gitignoreLines = gitignoreContent.split('\n').map(line => line.trim());

  /**
   * Helper function to check if a file pattern is covered by .gitignore rules
   * @param filename - The filename to check
   * @param gitignoreRules - Array of gitignore patterns
   * @returns true if the file would be ignored
   */
  function isIgnored(filename: string, gitignoreRules: string[]): boolean {
    let ignored = false;
    
    for (const rule of gitignoreRules) {
      // Skip empty lines and comments
      if (!rule || rule.startsWith('#')) continue;

      // Handle negation patterns (starting with !)
      if (rule.startsWith('!')) {
        const negatedPattern = rule.slice(1);
        if (matchesPattern(filename, negatedPattern)) {
          ignored = false; // Un-ignore this file
        }
        continue;
      }

      if (matchesPattern(filename, rule)) {
        ignored = true;
      }
    }
    return ignored;
  }

  /**
   * Helper function to check if a filename matches a gitignore pattern
   * @param filename - The filename to check
   * @param pattern - The gitignore pattern
   * @returns true if the filename matches the pattern
   */
  function matchesPattern(filename: string, pattern: string): boolean {
    // Convert gitignore pattern to regex
    // Simple pattern matching - handles *, **, and exact matches
    let regexPattern = pattern
      .replace(/\./g, '\\.') // Escape dots
      .replace(/\*\*/g, '.*') // ** matches any path
      .replace(/\*/g, '[^/]*') // * matches anything except /
      .replace(/\?/g, '.'); // ? matches single char

    // If pattern ends with /, it only matches directories
    if (regexPattern.endsWith('/')) {
      regexPattern = regexPattern.slice(0, -1);
    }

    // Create regex - match from start or after a /
    const regex = new RegExp(`(^|/)${regexPattern}(/|$)`);
    
    if (regex.test(filename)) {
      return true;
    }

    // Also check exact match
    if (filename === pattern || filename.endsWith('/' + pattern)) {
      return true;
    }
    
    return false;
  }

  it('Property 1: Gitignore excludes sensitive patterns - Terraform state files', () => {
    fc.assert(
      fc.property(
        fc.record({
          // Generate various terraform state file patterns
          stateFile: fc.oneof(
            fc.constant('terraform.tfstate'),
            fc.constant('terraform.tfstate.backup'),
            fc.string({ minLength: 1, maxLength: 20 }).map(s => `${s}.tfstate`),
            fc.string({ minLength: 1, maxLength: 20 }).map(s => `${s}.tfstate.backup`),
            fc.string({ minLength: 1, maxLength: 20 }).map(s => `terraform/${s}.tfstate`),
            fc.string({ minLength: 1, maxLength: 20 }).map(s => `modules/${s}.tfstate.backup`)
          )
        }),
        ({ stateFile }) => {
          // For any terraform state file pattern, it should be covered by .gitignore
          const ignored = isIgnored(stateFile, gitignoreLines);
          
          expect(ignored).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 1: Gitignore excludes sensitive patterns - .env files', () => {
    fc.assert(
      fc.property(
        fc.record({
          // Generate various .env file patterns
          envFile: fc.oneof(
            fc.constant('.env'),
            fc.constant('.env.local'),
            fc.constant('.env.production'),
            fc.constant('.env.development'),
            fc.string({ minLength: 1, maxLength: 20 }).map(s => `${s}/.env`),
            fc.string({ minLength: 1, maxLength: 20 }).map(s => `scripts/${s}/.env`)
          )
        }),
        ({ envFile }) => {
          // For any .env file pattern, it should be covered by .gitignore
          // Note: .env.example should NOT be ignored
          if (envFile.includes('.env.example')) {
            return; // Skip .env.example files
          }
          
          const ignored = isIgnored(envFile, gitignoreLines);
          
          expect(ignored).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 1: Gitignore excludes sensitive patterns - Private keys', () => {
    fc.assert(
      fc.property(
        fc.record({
          // Generate various private key file patterns
          keyFile: fc.oneof(
            fc.string({ minLength: 1, maxLength: 20 }).map(s => `${s}.pem`),
            fc.string({ minLength: 1, maxLength: 20 }).map(s => `${s}.key`),
            fc.string({ minLength: 1, maxLength: 20 }).map(s => `keys/${s}.pem`),
            fc.string({ minLength: 1, maxLength: 20 }).map(s => `certs/${s}.key`),
            fc.constant('id_rsa'),
            fc.constant('id_ed25519'),
            fc.string({ minLength: 1, maxLength: 20 }).map(s => `${s}_rsa`),
            fc.string({ minLength: 1, maxLength: 20 }).map(s => `${s}_ed25519`)
          )
        }),
        ({ keyFile }) => {
          // For any private key file pattern, it should be covered by .gitignore
          const ignored = isIgnored(keyFile, gitignoreLines);
          
          expect(ignored).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 1: Gitignore excludes sensitive patterns - Terraform directories', () => {
    fc.assert(
      fc.property(
        fc.record({
          // Generate various .terraform directory patterns
          terraformDir: fc.oneof(
            fc.constant('.terraform/'),
            fc.constant('.terraform/providers/'),
            fc.constant('.terraform/modules/'),
            fc.string({ minLength: 1, maxLength: 20 }).map(s => `${s}/.terraform/`),
            fc.string({ minLength: 1, maxLength: 20 }).map(s => `terraform/${s}/.terraform/`)
          )
        }),
        ({ terraformDir }) => {
          // For any .terraform directory, it should be covered by .gitignore
          const ignored = isIgnored(terraformDir, gitignoreLines);
          
          expect(ignored).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 1: Gitignore excludes sensitive patterns - Combined test', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          // Terraform state files
          fc.constant('terraform.tfstate'),
          fc.constant('terraform.tfstate.backup'),
          fc.string({ minLength: 1, maxLength: 15 }).map(s => `${s}.tfstate`),
          
          // .env files (excluding .env.example)
          fc.constant('.env'),
          fc.constant('.env.local'),
          fc.constant('.env.production'),
          
          // Private keys
          fc.string({ minLength: 1, maxLength: 15 }).map(s => `${s}.pem`),
          fc.string({ minLength: 1, maxLength: 15 }).map(s => `${s}.key`),
          
          // .terraform directories
          fc.constant('.terraform/'),
          fc.constant('.terraform/providers/')
        ),
        (sensitiveFile) => {
          // For any sensitive file pattern, it should be covered by .gitignore
          const ignored = isIgnored(sensitiveFile, gitignoreLines);
          
          expect(ignored).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 1: Gitignore excludes sensitive patterns - .env.example should NOT be ignored', () => {
    // Verify that .env.example is NOT ignored (it should be committed)
    const envExampleIgnored = isIgnored('.env.example', gitignoreLines);
    expect(envExampleIgnored).toBe(false);
  });
});
