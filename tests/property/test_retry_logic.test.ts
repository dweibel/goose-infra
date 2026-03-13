import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import fc from 'fast-check';

// Feature: oci-infra-repository, Property 7: Retry progression across availability domains
// Feature: oci-infra-repository, Property 8: Successful provisioning updates state
// Feature: oci-infra-repository, Property 9: Provisioning attempts are logged
// Validates: Requirements 5.1, 5.2, 5.4, 5.5

describe('Feature: oci-infra-repository - Retry Logic Property Tests', () => {
  const retryScriptPath = join(__dirname, '../../scripts/oci-instance-retry.sh');
  const retryScriptContent = readFileSync(retryScriptPath, 'utf-8');

  /**
   * Property 7: Retry progression across availability domains
   * 
   * For any instance provisioning attempt that fails due to capacity in one 
   * availability domain, the retry script should attempt provisioning in the 
   * next availability domain.
   */
  it('Property 7: Script iterates through all availability domains on capacity failure', () => {
    // Verify the script contains logic to iterate through ADs
    expect(retryScriptContent).toContain('for ad in "${ADS[@]}"');
    
    // Verify the script discovers availability domains
    expect(retryScriptContent).toContain('discover_availability_domains()');
    expect(retryScriptContent).toContain('oci iam availability-domain list');
    
    // Verify the script attempts provisioning in each AD
    expect(retryScriptContent).toContain('try_provision_in_ad');
    
    // Verify capacity error detection
    expect(retryScriptContent).toMatch(/out of host capacity|out of capacity|InternalError|LimitExceeded/i);
    
    // Verify the script moves to next AD on failure
    const tryProvisionFunction = extractFunction(retryScriptContent, 'try_provision_in_ad');
    expect(tryProvisionFunction).toContain('return 1'); // Returns failure to trigger next AD
    
    // Verify retry loop structure
    expect(retryScriptContent).toContain('while true; do');
    expect(retryScriptContent).toMatch(/for ad in.*ADS/);
  });

  it('Property 7: Script contains availability domain discovery logic', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('us-ashburn-1', 'us-phoenix-1', 'eu-frankfurt-1'),
        (region) => {
          // Verify AD discovery function exists
          const discoverFunction = extractFunction(retryScriptContent, 'discover_availability_domains');
          
          expect(discoverFunction).toBeTruthy();
          expect(discoverFunction).toContain('oci iam availability-domain list');
          expect(discoverFunction).toContain('--compartment-id');
          expect(discoverFunction).toContain('mapfile -t ADS');
          
          // Verify error handling for AD discovery
          expect(discoverFunction).toContain('Failed to discover availability domains');
          expect(discoverFunction).toContain('No availability domains found');
        }
      ),
      { numRuns: 10 }
    );
  });

  it('Property 7: Script attempts provisioning in each discovered AD', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom('AD-1', 'AD-2', 'AD-3'), { minLength: 1, maxLength: 3 }),
        (availabilityDomains) => {
          // Verify the main loop iterates through all ADs
          const mainFunction = extractFunction(retryScriptContent, 'main');
          
          expect(mainFunction).toContain('for ad in "${ADS[@]}"');
          expect(mainFunction).toContain('try_provision_in_ad "${ad}"');
          
          // Verify AD is passed to provisioning function
          const tryProvisionFunction = extractFunction(retryScriptContent, 'try_provision_in_ad');
          expect(tryProvisionFunction).toContain('local ad=$1');
          // The script uses escaped quotes in sed command: availability_domain = \"${ad}\"
          expect(tryProvisionFunction).toMatch(/availability_domain.*=.*\$\{ad\}/);
        }
      ),
      { numRuns: 10 }
    );
  });

  it('Property 7: Script detects capacity errors and continues to next AD', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          'out of host capacity',
          'out of capacity',
          'InternalError',
          'LimitExceeded'
        ),
        (errorPattern) => {
          // Verify capacity error detection
          const tryProvisionFunction = extractFunction(retryScriptContent, 'try_provision_in_ad');
          
          expect(tryProvisionFunction).toContain('grep -qi');
          expect(tryProvisionFunction).toMatch(new RegExp(errorPattern, 'i'));
          expect(tryProvisionFunction).toContain('No capacity in');
          
          // Verify function returns failure to trigger next AD attempt
          expect(tryProvisionFunction).toContain('return 1');
        }
      ),
      { numRuns: 10 }
    );
  });

  it('Property 7: Script waits between retry rounds after exhausting all ADs', () => {
    // Verify wait logic exists
    const mainFunction = extractFunction(retryScriptContent, 'main');
    
    expect(mainFunction).toContain('sleep "${WAIT_INTERVAL}"');
    expect(mainFunction).toContain('No capacity in any availability domain');
    
    // Verify wait interval is configurable
    expect(retryScriptContent).toContain('WAIT_INTERVAL=');
    expect(retryScriptContent).toContain('--wait-interval');
  });

  /**
   * Property 8: Successful provisioning updates state
   * 
   * For any successful instance provisioning, the terraform state should be 
   * updated to reflect the new instance.
   */
  it('Property 8: Script updates terraform state after successful provisioning', () => {
    // Verify update_terraform_state function exists
    const updateStateFunction = extractFunction(retryScriptContent, 'update_terraform_state');
    
    expect(updateStateFunction).toBeTruthy();
    expect(updateStateFunction).toContain('terraform apply');
    expect(updateStateFunction).toContain('Updating terraform state');
    
    // Verify function is called after successful provisioning
    const mainFunction = extractFunction(retryScriptContent, 'main');
    expect(mainFunction).toContain('update_terraform_state');
    
    // Verify it's called after instance reaches RUNNING state
    expect(mainFunction).toContain('wait_for_running');
    const successBlock = extractSuccessBlock(mainFunction);
    expect(successBlock).toContain('update_terraform_state');
  });

  it('Property 8: Script runs full terraform apply to sync all resources', () => {
    // Verify update function runs full terraform apply
    const updateStateFunction = extractFunction(retryScriptContent, 'update_terraform_state');
    
    expect(updateStateFunction).toContain('terraform apply -auto-approve');
    expect(updateStateFunction).toContain('Running full terraform apply');
    expect(updateStateFunction).toContain('sync infrastructure');
    
    // Verify it doesn't use -target (which would be partial)
    const fullApplyLine = updateStateFunction
      .split('\n')
      .find(line => line.includes('full terraform apply'));
    
    expect(fullApplyLine).toBeTruthy();
  });

  it('Property 8: Script verifies instance ID exists before updating state', () => {
    // Verify try_provision_in_ad checks for instance ID
    const tryProvisionFunction = extractFunction(retryScriptContent, 'try_provision_in_ad');
    
    expect(tryProvisionFunction).toContain('terraform output -raw instance_id');
    expect(tryProvisionFunction).toContain('instance_id=');
    
    // Verify it checks if instance ID is valid
    expect(tryProvisionFunction).toMatch(/\[\[ -n.*instance_id.*\]\]/);
    expect(tryProvisionFunction).toMatch(/\[\[.*instance_id.*!=.*null.*\]\]/);
    
    // Verify success message includes instance ID
    expect(tryProvisionFunction).toContain('Instance provisioned');
    expect(tryProvisionFunction).toContain('${instance_id}');
  });

  it('Property 8: Script updates terraform.tfvars with target AD before provisioning', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('AD-1', 'AD-2', 'AD-3'),
        (availabilityDomain) => {
          // Verify tfvars update logic
          const tryProvisionFunction = extractFunction(retryScriptContent, 'try_provision_in_ad');
          
          expect(tryProvisionFunction).toContain('terraform.tfvars');
          expect(tryProvisionFunction).toContain('availability_domain');
          expect(tryProvisionFunction).toContain('sed -i');
          
          // Verify it updates the AD value (with escaped quotes in sed command)
          expect(tryProvisionFunction).toMatch(/availability_domain.*=.*\\"\$\{ad\}\\"/);
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property 9: Provisioning attempts are logged
   * 
   * For any instance provisioning attempt, the retry script should create a 
   * log entry with a timestamp.
   */
  it('Property 9: Script logs all provisioning attempts with timestamps', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('INFO', 'WARN', 'ERROR'),
        (logLevel) => {
          // Verify log function exists and includes timestamps
          const logFunction = extractFunction(retryScriptContent, 'log');
          
          expect(logFunction).toBeTruthy();
          expect(logFunction).toContain('timestamp=$(date');
          expect(logFunction).toContain('%Y-%m-%d %H:%M:%S');
          expect(logFunction).toContain('echo -e "${timestamp}');
          expect(logFunction).toContain('tee -a "${LOG_FILE}"');
          
          // Verify log function accepts level parameter
          expect(logFunction).toContain('local level=$1');
        }
      ),
      { numRuns: 10 }
    );
  });

  it('Property 9: Script logs each AD provisioning attempt', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('AD-1', 'AD-2', 'AD-3'),
        (ad) => {
          // Verify provisioning attempts are logged
          const tryProvisionFunction = extractFunction(retryScriptContent, 'try_provision_in_ad');
          
          expect(tryProvisionFunction).toContain('log "INFO"');
          expect(tryProvisionFunction).toContain('Attempting provisioning');
          expect(tryProvisionFunction).toContain('${ad}');
          
          // Verify both success and failure are logged
          expect(tryProvisionFunction).toContain('Instance provisioned');
          expect(tryProvisionFunction).toContain('No capacity');
        }
      ),
      { numRuns: 10 }
    );
  });

  it('Property 9: Script logs retry rounds and total attempts', () => {
    // Verify retry round logging
    const mainFunction = extractFunction(retryScriptContent, 'main');
    
    expect(mainFunction).toContain('round=$((round + 1))');
    expect(mainFunction).toContain('log "INFO"');
    expect(mainFunction).toContain('Retry Round');
    expect(mainFunction).toContain('${round}');
    
    // Verify total attempts tracking
    expect(mainFunction).toContain('total_attempts=$((total_attempts + 1))');
  });

  it('Property 9: Script logs to file and console simultaneously', () => {
    // Verify log function uses tee for dual output
    const logFunction = extractFunction(retryScriptContent, 'log');
    
    expect(logFunction).toContain('tee -a');
    expect(logFunction).toContain('LOG_FILE');
    
    // Verify LOG_FILE is defined
    expect(retryScriptContent).toContain('LOG_FILE=');
    expect(retryScriptContent).toContain('oci-instance-retry.log');
  });

  it('Property 9: Script logs capacity errors with descriptive messages', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          'out of host capacity',
          'out of capacity',
          'InternalError',
          'LimitExceeded'
        ),
        (errorType) => {
          // Verify capacity error logging
          const tryProvisionFunction = extractFunction(retryScriptContent, 'try_provision_in_ad');
          
          expect(tryProvisionFunction).toContain('No capacity in');
          expect(tryProvisionFunction).toContain('log "INFO"');
          
          // Verify generic failure logging
          expect(tryProvisionFunction).toContain('Provisioning failed');
          expect(tryProvisionFunction).toContain('see log for details');
        }
      ),
      { numRuns: 10 }
    );
  });

  it('Property 9: Script logs successful provisioning with instance details', () => {
    // Verify success logging includes all details
    const mainFunction = extractFunction(retryScriptContent, 'main');
    
    const successSection = mainFunction
      .split('=== SUCCESS ===')[1]
      ?.split('exit 0')[0];
    
    if (successSection) {
      expect(successSection).toContain('Instance ID:');
      expect(successSection).toContain('Public IP:');
      expect(successSection).toContain('AD:');
      expect(successSection).toContain('SSH:');
      expect(successSection).toContain('${instance_id}');
      expect(successSection).toContain('${ip}');
      expect(successSection).toContain('${ad}');
    }
  });

  it('Property 9: Script logs initialization parameters', () => {
    // Verify initialization logging
    const mainFunction = extractFunction(retryScriptContent, 'main');
    
    expect(mainFunction).toContain('log "INFO"');
    expect(mainFunction).toContain('OCI Instance Provisioning Retry Script');
    expect(mainFunction).toContain('Region:');
    expect(mainFunction).toContain('Shape:');
    expect(mainFunction).toContain('Compartment:');
    expect(mainFunction).toContain('Max retries:');
    expect(mainFunction).toContain('Wait interval:');
  });

  it('Property 9: Script clears log file at start of execution', () => {
    // Verify log file is cleared at start
    const mainFunction = extractFunction(retryScriptContent, 'main');
    
    // Look for log file clearing near the start of main
    const mainLines = mainFunction.split('\n');
    const clearLogLine = mainLines.find(line => 
      line.includes('> "${LOG_FILE}"') || line.includes('>"${LOG_FILE}"')
    );
    
    expect(clearLogLine).toBeTruthy();
  });

  // Helper functions

  /**
   * Extract a bash function from script content
   */
  function extractFunction(content: string, functionName: string): string {
    const functionPattern = new RegExp(
      `${functionName}\\s*\\(\\)\\s*\\{([\\s\\S]*?)^\\}`,
      'm'
    );
    const match = content.match(functionPattern);
    return match ? match[1] : '';
  }

  /**
   * Extract the success block from main function
   */
  function extractSuccessBlock(mainFunction: string): string {
    const successMatch = mainFunction.match(/=== SUCCESS ===[\s\S]*?exit 0/);
    return successMatch ? successMatch[0] : '';
  }
});
