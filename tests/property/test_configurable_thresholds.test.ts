import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import fc from 'fast-check';

// Feature: oci-infra-repository, Property 30: Configurable alarm thresholds
// Validates: Requirements 13.4

describe('Feature: oci-infra-repository - Configurable Alarm Thresholds Property Tests', () => {
  const monitoringMainPath = join(__dirname, '../../terraform/modules/oci-monitoring/main.tf');
  const monitoringVariablesPath = join(__dirname, '../../terraform/modules/oci-monitoring/variables.tf');
  
  const monitoringMainContent = readFileSync(monitoringMainPath, 'utf-8');
  const monitoringVariablesContent = readFileSync(monitoringVariablesPath, 'utf-8');

  /**
   * Generator for valid threshold percentages
   * Generates percentages between 1 and 100
   */
  const thresholdArbitrary = fc.integer({ min: 1, max: 100 });

  /**
   * Generator for CPU idle threshold (0-99)
   * Lower values indicate more idle time
   */
  const cpuIdleThresholdArbitrary = fc.integer({ min: 0, max: 99 });

  /**
   * Generator for threshold configurations
   * Generates realistic threshold combinations
   */
  const thresholdConfigArbitrary = fc.record({
    cpu: fc.integer({ min: 70, max: 100 }),
    memory: fc.integer({ min: 70, max: 100 }),
    disk: fc.integer({ min: 70, max: 100 }),
    cpuIdle: fc.integer({ min: 5, max: 30 })
  });

  /**
   * Helper function to check if a threshold variable exists
   */
  function hasThresholdVariable(variableName: string): boolean {
    const variablePattern = new RegExp(`variable\\s+"${variableName}"`, 's');
    return variablePattern.test(monitoringVariablesContent);
  }

  /**
   * Helper function to check if a threshold variable has proper validation
   */
  function hasThresholdValidation(variableName: string, min: number, max: number): boolean {
    // Extract the variable block
    const variablePattern = new RegExp(
      `variable\\s+"${variableName}"\\s*{[^}]*validation\\s*{[^}]*}[^}]*}`,
      's'
    );
    const match = monitoringVariablesContent.match(variablePattern);
    
    if (!match) return false;
    
    const variableBlock = match[0];
    
    // Check for validation condition
    const hasValidation = variableBlock.includes('validation');
    const hasCondition = variableBlock.includes('condition');
    const hasMinCheck = variableBlock.includes(`> ${min}`) || variableBlock.includes(`>= ${min}`);
    const hasMaxCheck = variableBlock.includes(`<= ${max}`) || variableBlock.includes(`< ${max + 1}`);
    
    return hasValidation && hasCondition && hasMinCheck && hasMaxCheck;
  }

  /**
   * Helper function to extract an alarm resource block
   */
  function extractAlarmBlock(alarmResource: string): string | null {
    // Find the start of the resource
    const startPattern = `resource "oci_monitoring_alarm" "${alarmResource}"`;
    const startIndex = monitoringMainContent.indexOf(startPattern);
    
    if (startIndex === -1) return null;
    
    // Find the matching closing brace
    let braceCount = 0;
    let inBlock = false;
    let endIndex = startIndex;
    
    for (let i = startIndex; i < monitoringMainContent.length; i++) {
      if (monitoringMainContent[i] === '{') {
        braceCount++;
        inBlock = true;
      } else if (monitoringMainContent[i] === '}') {
        braceCount--;
        if (inBlock && braceCount === 0) {
          endIndex = i + 1;
          break;
        }
      }
    }
    
    return monitoringMainContent.substring(startIndex, endIndex);
  }

  /**
   * Helper function to check if an alarm uses a threshold variable
   */
  function alarmUsesThresholdVariable(alarmResource: string, variableName: string): boolean {
    const block = extractAlarmBlock(alarmResource);
    if (!block) return false;
    
    // Check if the query contains the variable reference
    // In Terraform, it's ${var.threshold}, but in the file it's literally that string
    return block.includes('${var.' + variableName + '}');
  }

  /**
   * Helper function to extract threshold value from alarm query
   */
  function extractThresholdFromAlarm(alarmResource: string): string | null {
    const block = extractAlarmBlock(alarmResource);
    if (!block) return null;
    
    // Extract the query line - need to handle escaped quotes
    // Match query = "..." where ... can contain \"
    const queryMatch = block.match(/query\s*=\s*"((?:[^"\\]|\\.)*)"/s);
    if (!queryMatch) return null;
    
    const query = queryMatch[1];
    
    // Extract threshold reference - look for the one after comparison operators (>, <, =)
    // This will be the threshold variable, not other variables like instance_id
    const thresholdMatch = query.match(/[><]=?\s*\$\{var\.(\w+)\}/);
    return thresholdMatch ? thresholdMatch[1] : null;
  }

  /**
   * Helper function to check if alarm body references the threshold
   */
  function alarmBodyReferencesThreshold(alarmResource: string, variableName: string): boolean {
    const block = extractAlarmBlock(alarmResource);
    if (!block) return false;
    
    // Extract the body line - need to handle escaped quotes
    // Match body = "..." where ... can contain \"
    const bodyMatch = block.match(/body\s*=\s*"((?:[^"\\]|\\.)*)"/s);
    if (!bodyMatch) return false;
    
    const body = bodyMatch[1];
    
    // Check if body contains the variable reference
    return body.includes('${var.' + variableName + '}');
  }

  // ========================================================================
  // Property 30: Configurable alarm thresholds
  // ========================================================================

  it('Property 30: CPU threshold variable exists', () => {
    expect(hasThresholdVariable('cpu_threshold')).toBe(true);
    expect(monitoringVariablesContent).toContain('variable "cpu_threshold"');
    expect(monitoringVariablesContent).toMatch(/type\s*=\s*number/);
  });

  it('Property 30: Memory threshold variable exists', () => {
    expect(hasThresholdVariable('memory_threshold')).toBe(true);
    expect(monitoringVariablesContent).toContain('variable "memory_threshold"');
    expect(monitoringVariablesContent).toMatch(/type\s*=\s*number/);
  });

  it('Property 30: Disk threshold variable exists', () => {
    expect(hasThresholdVariable('disk_threshold')).toBe(true);
    expect(monitoringVariablesContent).toContain('variable "disk_threshold"');
    expect(monitoringVariablesContent).toMatch(/type\s*=\s*number/);
  });

  it('Property 30: CPU idle threshold variable exists', () => {
    expect(hasThresholdVariable('cpu_idle_threshold')).toBe(true);
    expect(monitoringVariablesContent).toContain('variable "cpu_idle_threshold"');
    expect(monitoringVariablesContent).toMatch(/type\s*=\s*number/);
  });

  it('Property 30: CPU threshold has validation', () => {
    expect(hasThresholdValidation('cpu_threshold', 0, 100)).toBe(true);
  });

  it('Property 30: Memory threshold has validation', () => {
    expect(hasThresholdValidation('memory_threshold', 0, 100)).toBe(true);
  });

  it('Property 30: Disk threshold has validation', () => {
    expect(hasThresholdValidation('disk_threshold', 0, 100)).toBe(true);
  });

  it('Property 30: CPU idle threshold has validation', () => {
    expect(hasThresholdValidation('cpu_idle_threshold', 0, 99)).toBe(true);
  });

  it('Property 30: CPU alarm uses cpu_threshold variable', () => {
    expect(alarmUsesThresholdVariable('cpu_high', 'cpu_threshold')).toBe(true);
  });

  it('Property 30: Memory alarm uses memory_threshold variable', () => {
    expect(alarmUsesThresholdVariable('memory_high', 'memory_threshold')).toBe(true);
  });

  it('Property 30: Disk alarm uses disk_threshold variable', () => {
    expect(alarmUsesThresholdVariable('disk_high', 'disk_threshold')).toBe(true);
  });

  it('Property 30: CPU idle alarm uses cpu_idle_threshold variable', () => {
    expect(alarmUsesThresholdVariable('cpu_idle', 'cpu_idle_threshold')).toBe(true);
  });

  it('Property 30: CPU alarm query contains threshold variable', () => {
    const threshold = extractThresholdFromAlarm('cpu_high');
    expect(threshold).toBe('cpu_threshold');
  });

  it('Property 30: Memory alarm query contains threshold variable', () => {
    const threshold = extractThresholdFromAlarm('memory_high');
    expect(threshold).toBe('memory_threshold');
  });

  it('Property 30: Disk alarm query contains threshold variable', () => {
    const threshold = extractThresholdFromAlarm('disk_high');
    expect(threshold).toBe('disk_threshold');
  });

  it('Property 30: CPU idle alarm query contains threshold variable', () => {
    const threshold = extractThresholdFromAlarm('cpu_idle');
    expect(threshold).toBe('cpu_idle_threshold');
  });

  it('Property 30: CPU alarm body references threshold', () => {
    expect(alarmBodyReferencesThreshold('cpu_high', 'cpu_threshold')).toBe(true);
  });

  it('Property 30: Memory alarm body references threshold', () => {
    expect(alarmBodyReferencesThreshold('memory_high', 'memory_threshold')).toBe(true);
  });

  it('Property 30: Disk alarm body references threshold', () => {
    expect(alarmBodyReferencesThreshold('disk_high', 'disk_threshold')).toBe(true);
  });

  it('Property 30: CPU idle alarm body references threshold', () => {
    expect(alarmBodyReferencesThreshold('cpu_idle', 'cpu_idle_threshold')).toBe(true);
  });

  // ========================================================================
  // Property-Based Tests: Various threshold values
  // ========================================================================

  it('Property 30: CPU threshold variable exists for any valid percentage', () => {
    fc.assert(
      fc.property(
        thresholdArbitrary,
        (threshold) => {
          // For any valid threshold percentage, the cpu_threshold variable should exist
          expect(hasThresholdVariable('cpu_threshold')).toBe(true);
          expect(hasThresholdValidation('cpu_threshold', 0, 100)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 30: Memory threshold variable exists for any valid percentage', () => {
    fc.assert(
      fc.property(
        thresholdArbitrary,
        (threshold) => {
          // For any valid threshold percentage, the memory_threshold variable should exist
          expect(hasThresholdVariable('memory_threshold')).toBe(true);
          expect(hasThresholdValidation('memory_threshold', 0, 100)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 30: Disk threshold variable exists for any valid percentage', () => {
    fc.assert(
      fc.property(
        thresholdArbitrary,
        (threshold) => {
          // For any valid threshold percentage, the disk_threshold variable should exist
          expect(hasThresholdVariable('disk_threshold')).toBe(true);
          expect(hasThresholdValidation('disk_threshold', 0, 100)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 30: CPU idle threshold variable exists for any valid percentage', () => {
    fc.assert(
      fc.property(
        cpuIdleThresholdArbitrary,
        (threshold) => {
          // For any valid idle threshold percentage, the cpu_idle_threshold variable should exist
          expect(hasThresholdVariable('cpu_idle_threshold')).toBe(true);
          expect(hasThresholdValidation('cpu_idle_threshold', 0, 99)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 30: All alarms use their respective threshold variables', () => {
    fc.assert(
      fc.property(
        thresholdConfigArbitrary,
        (config) => {
          // For any threshold configuration, all alarms should use their respective variables
          expect(alarmUsesThresholdVariable('cpu_high', 'cpu_threshold')).toBe(true);
          expect(alarmUsesThresholdVariable('memory_high', 'memory_threshold')).toBe(true);
          expect(alarmUsesThresholdVariable('disk_high', 'disk_threshold')).toBe(true);
          expect(alarmUsesThresholdVariable('cpu_idle', 'cpu_idle_threshold')).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 30: All alarm queries contain threshold variables', () => {
    fc.assert(
      fc.property(
        thresholdConfigArbitrary,
        (config) => {
          // For any threshold configuration, all alarm queries should reference variables
          expect(extractThresholdFromAlarm('cpu_high')).toBe('cpu_threshold');
          expect(extractThresholdFromAlarm('memory_high')).toBe('memory_threshold');
          expect(extractThresholdFromAlarm('disk_high')).toBe('disk_threshold');
          expect(extractThresholdFromAlarm('cpu_idle')).toBe('cpu_idle_threshold');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 30: All alarm bodies reference threshold variables', () => {
    fc.assert(
      fc.property(
        thresholdConfigArbitrary,
        (config) => {
          // For any threshold configuration, all alarm bodies should reference variables
          expect(alarmBodyReferencesThreshold('cpu_high', 'cpu_threshold')).toBe(true);
          expect(alarmBodyReferencesThreshold('memory_high', 'memory_threshold')).toBe(true);
          expect(alarmBodyReferencesThreshold('disk_high', 'disk_threshold')).toBe(true);
          expect(alarmBodyReferencesThreshold('cpu_idle', 'cpu_idle_threshold')).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  // ========================================================================
  // Combined Property Tests
  // ========================================================================

  it('Property 30: Complete threshold configuration for all alarm types', () => {
    fc.assert(
      fc.property(
        thresholdConfigArbitrary,
        (config) => {
          // For any threshold configuration, all components should be properly configured
          
          // Variables exist
          expect(hasThresholdVariable('cpu_threshold')).toBe(true);
          expect(hasThresholdVariable('memory_threshold')).toBe(true);
          expect(hasThresholdVariable('disk_threshold')).toBe(true);
          expect(hasThresholdVariable('cpu_idle_threshold')).toBe(true);
          
          // Variables have validation
          expect(hasThresholdValidation('cpu_threshold', 0, 100)).toBe(true);
          expect(hasThresholdValidation('memory_threshold', 0, 100)).toBe(true);
          expect(hasThresholdValidation('disk_threshold', 0, 100)).toBe(true);
          expect(hasThresholdValidation('cpu_idle_threshold', 0, 99)).toBe(true);
          
          // Alarms use variables
          expect(alarmUsesThresholdVariable('cpu_high', 'cpu_threshold')).toBe(true);
          expect(alarmUsesThresholdVariable('memory_high', 'memory_threshold')).toBe(true);
          expect(alarmUsesThresholdVariable('disk_high', 'disk_threshold')).toBe(true);
          expect(alarmUsesThresholdVariable('cpu_idle', 'cpu_idle_threshold')).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 30: Threshold variables are consistently referenced', () => {
    fc.assert(
      fc.property(
        thresholdConfigArbitrary,
        (config) => {
          // For any threshold configuration, variables should be referenced in both query and body
          
          // CPU alarm
          expect(extractThresholdFromAlarm('cpu_high')).toBe('cpu_threshold');
          expect(alarmBodyReferencesThreshold('cpu_high', 'cpu_threshold')).toBe(true);
          
          // Memory alarm
          expect(extractThresholdFromAlarm('memory_high')).toBe('memory_threshold');
          expect(alarmBodyReferencesThreshold('memory_high', 'memory_threshold')).toBe(true);
          
          // Disk alarm
          expect(extractThresholdFromAlarm('disk_high')).toBe('disk_threshold');
          expect(alarmBodyReferencesThreshold('disk_high', 'disk_threshold')).toBe(true);
          
          // CPU idle alarm
          expect(extractThresholdFromAlarm('cpu_idle')).toBe('cpu_idle_threshold');
          expect(alarmBodyReferencesThreshold('cpu_idle', 'cpu_idle_threshold')).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
