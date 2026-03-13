import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import fc from 'fast-check';

// Feature: oci-infra-repository, Property 36: Secret pattern detection
// Validates: Requirements 16.4, 16.8

describe('Feature: oci-infra-repository - Secret Detection Property Tests', () => {
  const testDir = join(__dirname, '../../.test-secrets');
  const verifyScriptPath = join(__dirname, '../../scripts/verify-secrets.sh');

  beforeAll(() => {
    // Create test directory and initialize git repo
    try {
      mkdirSync(testDir, { recursive: true });
    } catch (e) {
      // Directory might already exist
    }

    // Initialize git repo
    try {
      execSync('git init', { cwd: testDir, stdio: 'pipe' });
      execSync('git config user.email "test@test.com"', { cwd: testDir, stdio: 'pipe' });
      execSync('git config user.name "Test"', { cwd: testDir, stdio: 'pipe' });
    } catch (e) {
      // Repo might already exist
    }
  });

  afterAll(() => {
    // Clean up test directory
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  /**
   * Helper function to test if secret patterns are detected
   * @param secrets - Array of secret contents to test
   * @returns number of secrets detected
   */
  function testSecretsDetection(secrets: string[]): number {
    const filename = `test-batch-${Date.now()}.txt`;
    const filePath = join(testDir, filename);
    
    try {
      // Write all secrets to a single file
      const content = secrets.join('\n\n');
      writeFileSync(filePath, content, 'utf-8');
      
      // Add to git tracking
      execSync(`git add -f ${filename}`, { cwd: testDir, stdio: 'pipe' });

      // Run the script with --fail-on-detect flag
      execSync(`bash ${verifyScriptPath} --fail-on-detect`, {
        cwd: testDir,
        stdio: 'pipe',
        encoding: 'utf-8',
        timeout: 10000 // 10 second timeout
      });
      
      // If we reach here, no secrets were detected
      return 0;
    } catch (error: any) {
      // Check if the error is due to secret detection (exit code 1)
      if (error.status === 1) {
        const output = (error.stdout || '') + (error.stderr || '');
        // Extract the number of secrets found from output
        const match = output.match(/Found (\d+) potential secret/);
        if (match) {
          return parseInt(match[1], 10);
        }
        // If we can't parse the count, but we know secrets were found
        return output.includes('potential secret') ? secrets.length : 0;
      }
      // Other errors - log and fail
      console.error('Unexpected error:', error.message);
      throw error;
    } finally {
      // Clean up test file
      try {
        execSync(`git rm -f ${filename}`, { cwd: testDir, stdio: 'pipe' });
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }

  it('Property 36: Secret pattern detection - AWS Access Keys', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.string({ minLength: 16, maxLength: 16 })
            .filter(s => /^[A-Z0-9]+$/.test(s))
            .map(s => `AWS_ACCESS_KEY_ID=AKIA${s}`),
          { minLength: 1, maxLength: 5 }
        ),
        (secrets) => {
          const detected = testSecretsDetection(secrets);
          expect(detected).toBeGreaterThanOrEqual(secrets.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 36: Secret pattern detection - AWS Secret Keys', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.string({ minLength: 40, maxLength: 40 })
            .filter(s => /^[A-Za-z0-9/+=]+$/.test(s))
            .map(s => `aws_secret_access_key = ${s}`),
          { minLength: 1, maxLength: 5 }
        ),
        (secrets) => {
          const detected = testSecretsDetection(secrets);
          expect(detected).toBeGreaterThanOrEqual(secrets.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 36: Secret pattern detection - OCI Tenancy OCIDs', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.string({ minLength: 60, maxLength: 60 })
            .filter(s => /^[a-z0-9]+$/.test(s))
            .map(s => `TENANCY_OCID=ocid1.tenancy.oc1..${s}`),
          { minLength: 1, maxLength: 5 }
        ),
        (secrets) => {
          const detected = testSecretsDetection(secrets);
          expect(detected).toBeGreaterThanOrEqual(secrets.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 36: Secret pattern detection - Private Keys (RSA, Generic, OpenSSH)', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            fc.string({ minLength: 20, maxLength: 50 })
              .map(s => `-----BEGIN RSA PRIVATE KEY-----\n${s}\n-----END RSA PRIVATE KEY-----`),
            fc.string({ minLength: 20, maxLength: 50 })
              .map(s => `-----BEGIN PRIVATE KEY-----\n${s}\n-----END PRIVATE KEY-----`),
            fc.string({ minLength: 20, maxLength: 50 })
              .map(s => `-----BEGIN OPENSSH PRIVATE KEY-----\n${s}\n-----END OPENSSH PRIVATE KEY-----`)
          ),
          { minLength: 1, maxLength: 5 }
        ),
        (secrets) => {
          const detected = testSecretsDetection(secrets);
          expect(detected).toBeGreaterThanOrEqual(secrets.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 36: Secret pattern detection - GitHub Personal Access Tokens', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.string({ minLength: 36, maxLength: 36 })
            .filter(s => /^[a-zA-Z0-9]+$/.test(s))
            .map(s => `GITHUB_TOKEN=ghp_${s}`),
          { minLength: 1, maxLength: 5 }
        ),
        (secrets) => {
          const detected = testSecretsDetection(secrets);
          expect(detected).toBeGreaterThanOrEqual(secrets.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 36: Secret pattern detection - Mixed secret types', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            // AWS Access Key
            fc.string({ minLength: 16, maxLength: 16 })
              .filter(s => /^[A-Z0-9]+$/.test(s))
              .map(s => `AWS_ACCESS_KEY_ID=AKIA${s}`),
            
            // AWS Secret
            fc.string({ minLength: 40, maxLength: 40 })
              .filter(s => /^[A-Za-z0-9/+=]+$/.test(s))
              .map(s => `aws_secret_access_key = ${s}`),
            
            // OCI Tenancy OCID
            fc.string({ minLength: 60, maxLength: 60 })
              .filter(s => /^[a-z0-9]+$/.test(s))
              .map(s => `TENANCY_OCID=ocid1.tenancy.oc1..${s}`),
            
            // RSA Private Key
            fc.string({ minLength: 20, maxLength: 40 })
              .map(s => `-----BEGIN RSA PRIVATE KEY-----\n${s}\n-----END RSA PRIVATE KEY-----`),
            
            // GitHub Token
            fc.string({ minLength: 36, maxLength: 36 })
              .filter(s => /^[a-zA-Z0-9]+$/.test(s))
              .map(s => `GITHUB_TOKEN=ghp_${s}`)
          ),
          { minLength: 1, maxLength: 5 }
        ),
        (secrets) => {
          const detected = testSecretsDetection(secrets);
          // Should detect at least as many secrets as we generated
          expect(detected).toBeGreaterThanOrEqual(secrets.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});
