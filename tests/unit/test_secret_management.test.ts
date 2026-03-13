import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

describe('Feature: oci-infra-repository - Secret Management', () => {
  const repoRoot = join(__dirname, '../..');
  const gitignorePath = join(repoRoot, '.gitignore');
  const envExamplePath = join(repoRoot, '.env.example');
  const verifySecretsScriptPath = join(repoRoot, 'scripts/verify-secrets.sh');

  /**
   * Validates: Requirements 16.2
   * Test that .env is listed in .gitignore to prevent accidental commits
   */
  it('16.2 - .env is in .gitignore', () => {
    expect(existsSync(gitignorePath)).toBe(true);
    
    const gitignoreContent = readFileSync(gitignorePath, 'utf-8');
    const lines = gitignoreContent.split('\n').map(line => line.trim());
    
    // Check for .env entry (exact match or pattern)
    const hasEnvEntry = lines.some(line => 
      line === '.env' || 
      line === '.env.*' ||
      line.startsWith('.env')
    );
    
    expect(hasEnvEntry).toBe(true);
  });

  /**
   * Validates: Requirements 16.3
   * Test that .env.example contains all required OCI infrastructure variables
   */
  it('16.3 - .env.example contains all required OCI variables', () => {
    expect(existsSync(envExamplePath)).toBe(true);
    
    const envContent = readFileSync(envExamplePath, 'utf-8');

    // OCI Authentication variables
    const requiredOciVars = [
      'OCI_TENANCY_OCID',
      'OCI_USER_OCID',
      'OCI_FINGERPRINT',
      'OCI_PRIVATE_KEY_PATH',
      'OCI_REGION',
      'OCI_COMPARTMENT_OCID',
    ];

    for (const varName of requiredOciVars) {
      expect(envContent).toContain(varName);
    }
  });

  /**
   * Validates: Requirements 16.3
   * Test that .env.example contains all required Wiki.js variables
   */
  it('16.3 - .env.example contains all required Wiki.js variables', () => {
    const envContent = readFileSync(envExamplePath, 'utf-8');

    const requiredWikiVars = [
      'WIKI_ADMIN_EMAIL',
      'WIKI_ADMIN_PASSWORD',
      'POSTGRES_PASSWORD',
    ];

    for (const varName of requiredWikiVars) {
      expect(envContent).toContain(varName);
    }
  });

  /**
   * Validates: Requirements 16.3
   * Test that .env.example contains all required MCP Server variables
   */
  it('16.3 - .env.example contains all required MCP Server variables', () => {
    const envContent = readFileSync(envExamplePath, 'utf-8');

    const requiredMcpVars = [
      'MCP_ADMIN_TOKEN',
      'MCP_ENABLE_WRITES',
    ];

    for (const varName of requiredMcpVars) {
      expect(envContent).toContain(varName);
    }
  });

  /**
   * Validates: Requirements 16.3
   * Test that .env.example contains all required ECR variables
   */
  it('16.3 - .env.example contains all required ECR variables', () => {
    const envContent = readFileSync(envExamplePath, 'utf-8');

    const requiredEcrVars = [
      'AWS_REGION',
      'AWS_ACCESS_KEY_ID',
      'AWS_SECRET_ACCESS_KEY',
      'ECR_REGISTRY',
    ];

    for (const varName of requiredEcrVars) {
      expect(envContent).toContain(varName);
    }
  });

  /**
   * Validates: Requirements 16.3
   * Test that .env.example contains all required SSH variables
   */
  it('16.3 - .env.example contains all required SSH variables', () => {
    const envContent = readFileSync(envExamplePath, 'utf-8');

    const requiredSshVars = [
      'SSH_PUBLIC_KEY_PATH',
      'SSH_PRIVATE_KEY_PATH',
    ];

    for (const varName of requiredSshVars) {
      expect(envContent).toContain(varName);
    }
  });

  /**
   * Validates: Requirements 16.4, 16.8
   * Test that verification script detects AWS access keys
   */
  it('16.4, 16.8 - verification script detects AWS access keys', () => {
    expect(existsSync(verifySecretsScriptPath)).toBe(true);

    // Create a temporary test file with an AWS access key
    const testFilePath = join(repoRoot, 'test_aws_key.txt');
    const testContent = 'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE\n';
    
    try {
      // Write test file
      require('fs').writeFileSync(testFilePath, testContent);
      
      // Add to git tracking (required for script to scan it)
      try {
        execSync(`git add -N "${testFilePath}"`, { cwd: repoRoot, stdio: 'pipe' });
      } catch (e) {
        // If git add fails, skip this test (not in a git repo)
        require('fs').unlinkSync(testFilePath);
        return;
      }

      // Run verification script
      try {
        execSync(`bash "${verifySecretsScriptPath}"`, { 
          cwd: repoRoot,
          stdio: 'pipe',
          encoding: 'utf-8'
        });
        
        // If script didn't detect the secret, fail the test
        expect(false).toBe(true); // Should not reach here
      } catch (error: any) {
        // Script should output information about the detected secret
        const output = error.stdout?.toString() || error.stderr?.toString() || '';
        
        // Verify the script detected the AWS key
        expect(
          output.includes('AWS') || 
          output.includes('test_aws_key.txt') ||
          output.includes('secret')
        ).toBe(true);
      }
    } finally {
      // Cleanup
      try {
        execSync(`git reset HEAD "${testFilePath}"`, { cwd: repoRoot, stdio: 'pipe' });
      } catch (e) {
        // Ignore cleanup errors
      }
      try {
        require('fs').unlinkSync(testFilePath);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  });

  /**
   * Validates: Requirements 16.4, 16.8
   * Test that verification script detects private key patterns
   */
  it('16.4, 16.8 - verification script detects private key patterns', () => {
    expect(existsSync(verifySecretsScriptPath)).toBe(true);

    // Create a temporary test file with a private key pattern
    const testFilePath = join(repoRoot, 'test_private_key.txt');
    const testContent = '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----\n';
    
    try {
      // Write test file
      require('fs').writeFileSync(testFilePath, testContent);
      
      // Add to git tracking (required for script to scan it)
      try {
        execSync(`git add -N "${testFilePath}"`, { cwd: repoRoot, stdio: 'pipe' });
      } catch (e) {
        // If git add fails, skip this test (not in a git repo)
        require('fs').unlinkSync(testFilePath);
        return;
      }

      // Run verification script
      try {
        execSync(`bash "${verifySecretsScriptPath}"`, { 
          cwd: repoRoot,
          stdio: 'pipe',
          encoding: 'utf-8'
        });
        
        // If script didn't detect the secret, fail the test
        expect(false).toBe(true); // Should not reach here
      } catch (error: any) {
        // Script should output information about the detected secret
        const output = error.stdout?.toString() || error.stderr?.toString() || '';
        
        // Verify the script detected the private key
        expect(
          output.includes('Private Key') || 
          output.includes('RSA') ||
          output.includes('test_private_key.txt') ||
          output.includes('secret')
        ).toBe(true);
      }
    } finally {
      // Cleanup
      try {
        execSync(`git reset HEAD "${testFilePath}"`, { cwd: repoRoot, stdio: 'pipe' });
      } catch (e) {
        // Ignore cleanup errors
      }
      try {
        require('fs').unlinkSync(testFilePath);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  });

  /**
   * Validates: Requirements 16.1
   * Test that .env file usage is documented and expected
   */
  it('16.1 - .env file is documented for secret storage', () => {
    // Verify .env.example exists and has documentation
    const envContent = readFileSync(envExamplePath, 'utf-8');
    
    // Should have comments explaining the purpose
    expect(envContent).toContain('#');
    
    // Should have multiple sections with headers
    const commentLines = envContent.split('\n').filter(line => line.trim().startsWith('#'));
    expect(commentLines.length).toBeGreaterThan(10);
  });

  /**
   * Validates: Requirements 16.2
   * Test that .gitignore prevents .env from being committed
   */
  it('16.2 - .gitignore prevents .env from being committed', () => {
    const gitignoreContent = readFileSync(gitignorePath, 'utf-8');
    
    // Should explicitly exclude .env
    expect(gitignoreContent).toContain('.env');
    
    // Should NOT exclude .env.example (verify with negation pattern)
    const lines = gitignoreContent.split('\n');
    const hasEnvExampleException = lines.some(line => 
      line.trim() === '!.env.example'
    );
    
    expect(hasEnvExampleException).toBe(true);
  });

  /**
   * Validates: Requirements 16.8
   * Test that verification script checks for common secret patterns
   */
  it('16.8 - verification script checks for multiple secret patterns', () => {
    const scriptContent = readFileSync(verifySecretsScriptPath, 'utf-8');
    
    // Verify script contains patterns for various secret types
    const expectedPatterns = [
      'AKIA', // AWS Access Key
      'BEGIN RSA PRIVATE KEY', // RSA Private Key
      'BEGIN PRIVATE KEY', // Generic Private Key
      'BEGIN OPENSSH PRIVATE KEY', // OpenSSH Private Key
    ];

    for (const pattern of expectedPatterns) {
      expect(scriptContent).toContain(pattern);
    }
  });

  /**
   * Validates: Requirements 16.5
   * Test that verification script exits with error when secrets detected
   */
  it('16.5 - verification script exits with error code when --fail-on-detect is used', () => {
    const scriptContent = readFileSync(verifySecretsScriptPath, 'utf-8');
    
    // Verify script has --fail-on-detect option
    expect(scriptContent).toContain('--fail-on-detect');
    expect(scriptContent).toContain('FAIL_ON_DETECT');
    
    // Verify script exits with error code 1
    expect(scriptContent).toContain('exit 1');
  });
});
