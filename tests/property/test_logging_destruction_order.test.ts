import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import fc from 'fast-check';

// Feature: oci-infra-repository, Property 13: Agent configuration destruction ordering
// Validates: Requirements 7.5, 9.2

describe('Feature: oci-infra-repository - Logging Destruction Order Property Tests', () => {
  const loggingModulePath = join(__dirname, '../../terraform/modules/oci-logging/main.tf');
  const loggingModuleContent = readFileSync(loggingModulePath, 'utf-8');

  /**
   * Helper function to check if unified agent config has depends_on clause
   * @param content - Terraform file content
   * @returns true if depends_on is present in the agent config
   */
  function agentConfigHasDependsOn(content: string): boolean {
    // Simply check if depends_on exists in the agent config section
    const agentConfigStart = content.indexOf('resource "oci_logging_unified_agent_configuration" "main"');
    if (agentConfigStart === -1) {
      return false;
    }
    
    // Find the end of this resource (next resource or end of file)
    const nextResourceStart = content.indexOf('resource "', agentConfigStart + 10);
    const agentConfigSection = nextResourceStart === -1 
      ? content.substring(agentConfigStart)
      : content.substring(agentConfigStart, nextResourceStart);
    
    return /depends_on\s*=\s*\[/.test(agentConfigSection);
  }

  /**
   * Helper function to check if agent config depends on log resources
   * @param content - Terraform file content
   * @returns true if agent config depends on oci_logging_log.app
   */
  function agentConfigDependsOnLog(content: string): boolean {
    // Find the agent config section
    const agentConfigStart = content.indexOf('resource "oci_logging_unified_agent_configuration" "main"');
    if (agentConfigStart === -1) {
      return false;
    }
    
    const nextResourceStart = content.indexOf('resource "', agentConfigStart + 10);
    const agentConfigSection = nextResourceStart === -1 
      ? content.substring(agentConfigStart)
      : content.substring(agentConfigStart, nextResourceStart);
    
    // Find the depends_on block
    const dependsOnMatch = agentConfigSection.match(/depends_on\s*=\s*\[([\s\S]*?)\]/);
    if (!dependsOnMatch) {
      return false;
    }
    
    const dependenciesStr = dependsOnMatch[1];
    return dependenciesStr.includes('oci_logging_log.app');
  }

  /**
   * Helper function to check if agent config has create_before_destroy = false
   * @param content - Terraform file content
   * @returns true if lifecycle has create_before_destroy = false
   */
  function agentConfigHasCorrectLifecycle(content: string): boolean {
    // Find the agent config section
    const agentConfigStart = content.indexOf('resource "oci_logging_unified_agent_configuration" "main"');
    if (agentConfigStart === -1) {
      return false;
    }
    
    const nextResourceStart = content.indexOf('resource "', agentConfigStart + 10);
    const agentConfigSection = nextResourceStart === -1 
      ? content.substring(agentConfigStart)
      : content.substring(agentConfigStart, nextResourceStart);
    
    // Find the lifecycle block
    const lifecycleMatch = agentConfigSection.match(/lifecycle\s*\{[\s\S]*?\}/);
    if (!lifecycleMatch) {
      return false;
    }
    
    const lifecycleBlock = lifecycleMatch[0];
    return /create_before_destroy\s*=\s*false/.test(lifecycleBlock);
  }

  /**
   * Helper function to check if agent config references log in destination
   * @param content - Terraform file content
   * @returns true if agent config references oci_logging_log.app.id
   */
  function agentConfigReferencesLog(content: string): boolean {
    // Find the agent config section
    const agentConfigStart = content.indexOf('resource "oci_logging_unified_agent_configuration" "main"');
    if (agentConfigStart === -1) {
      return false;
    }
    
    const nextResourceStart = content.indexOf('resource "', agentConfigStart + 10);
    const agentConfigSection = nextResourceStart === -1 
      ? content.substring(agentConfigStart)
      : content.substring(agentConfigStart, nextResourceStart);
    
    // Check if it references the log in destination
    return /log_object_id\s*=\s*oci_logging_log\.app\.id/.test(agentConfigSection);
  }

  /**
   * Helper function to check if log group does NOT depend on agent config
   * @param content - Terraform file content
   * @returns true if log group has no dependency on agent config
   */
  function logGroupHasNoAgentDependency(content: string): boolean {
    // Find the log group section
    const logGroupStart = content.indexOf('resource "oci_logging_log_group" "main"');
    if (logGroupStart === -1) {
      return false;
    }
    
    // Find the end of the log group resource
    const nextResourceStart = content.indexOf('resource "', logGroupStart + 10);
    const logGroupSection = nextResourceStart === -1 
      ? content.substring(logGroupStart)
      : content.substring(logGroupStart, nextResourceStart);
    
    // Check if it has depends_on referencing agent config (should NOT)
    return !logGroupSection.includes('oci_logging_unified_agent_configuration');
  }

  it('Property 13: Agent configuration destruction ordering - Unified agent config exists', () => {
    // Verify that the unified agent configuration resource exists
    expect(loggingModuleContent).toContain('resource "oci_logging_unified_agent_configuration"');
    expect(loggingModuleContent).toContain('"main"');
  });

  it('Property 13: Agent configuration destruction ordering - Log group exists', () => {
    // Verify that the log group resource exists
    expect(loggingModuleContent).toContain('resource "oci_logging_log_group"');
    expect(loggingModuleContent).toContain('"main"');
  });

  it('Property 13: Agent configuration destruction ordering - Agent config has depends_on', () => {
    // Verify that the agent config has depends_on clause
    const hasDeps = agentConfigHasDependsOn(loggingModuleContent);
    expect(hasDeps).toBe(true);
  });

  it('Property 13: Agent configuration destruction ordering - Agent config depends on log resources', () => {
    // Verify that the agent config depends on the log resource
    const dependsOnLog = agentConfigDependsOnLog(loggingModuleContent);
    expect(dependsOnLog).toBe(true);
  });

  it('Property 13: Agent configuration destruction ordering - Agent config has correct lifecycle', () => {
    // Verify lifecycle block exists with create_before_destroy = false
    const hasCorrectLifecycle = agentConfigHasCorrectLifecycle(loggingModuleContent);
    expect(hasCorrectLifecycle).toBe(true);
  });

  it('Property 13: Agent configuration destruction ordering - Agent config references log in destination', () => {
    // Verify that the agent config references the log in its destination configuration
    const referencesLog = agentConfigReferencesLog(loggingModuleContent);
    expect(referencesLog).toBe(true);
  });

  it('Property 13: Agent configuration destruction ordering - No circular dependencies', () => {
    // Verify that log group does not depend on agent config (which would create a cycle)
    const noCircularDep = logGroupHasNoAgentDependency(loggingModuleContent);
    expect(noCircularDep).toBe(true);
  });

  it('Property 13: Agent configuration destruction ordering - Complete verification', () => {
    // Verify all aspects of destruction order are correct
    expect(agentConfigHasDependsOn(loggingModuleContent)).toBe(true);
    expect(agentConfigDependsOnLog(loggingModuleContent)).toBe(true);
    expect(agentConfigHasCorrectLifecycle(loggingModuleContent)).toBe(true);
    expect(agentConfigReferencesLog(loggingModuleContent)).toBe(true);
    expect(logGroupHasNoAgentDependency(loggingModuleContent)).toBe(true);
  });

  it('Property 13: Agent configuration destruction ordering - Property-based test with multiple scenarios', () => {
    fc.assert(
      fc.property(
        fc.record({
          // Generate different scenarios for testing
          scenario: fc.oneof(
            fc.constant('check_depends_on'),
            fc.constant('check_lifecycle'),
            fc.constant('check_dependencies'),
            fc.constant('check_references'),
            fc.constant('check_no_circular'),
            fc.constant('check_complete_order')
          )
        }),
        ({ scenario }) => {
          switch (scenario) {
            case 'check_depends_on':
              // Verify depends_on exists
              expect(agentConfigHasDependsOn(loggingModuleContent)).toBe(true);
              break;

            case 'check_lifecycle':
              // Verify lifecycle configuration
              expect(agentConfigHasCorrectLifecycle(loggingModuleContent)).toBe(true);
              break;

            case 'check_dependencies':
              // Verify dependencies reference log resources
              expect(agentConfigDependsOnLog(loggingModuleContent)).toBe(true);
              break;

            case 'check_references':
              // Verify agent config references log in destination
              expect(agentConfigReferencesLog(loggingModuleContent)).toBe(true);
              break;

            case 'check_no_circular':
              // Verify no circular dependencies
              expect(logGroupHasNoAgentDependency(loggingModuleContent)).toBe(true);
              break;

            case 'check_complete_order':
              // Verify complete destruction order
              expect(agentConfigHasDependsOn(loggingModuleContent)).toBe(true);
              expect(agentConfigDependsOnLog(loggingModuleContent)).toBe(true);
              expect(agentConfigHasCorrectLifecycle(loggingModuleContent)).toBe(true);
              break;
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 13: Agent configuration destruction ordering - Dependency chain verification', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          'oci_logging_log.app',
          'oci_identity_dynamic_group.instance'
        ),
        (expectedDependency) => {
          // Find the agent config section
          const agentConfigStart = loggingModuleContent.indexOf('resource "oci_logging_unified_agent_configuration" "main"');
          expect(agentConfigStart).toBeGreaterThan(-1);
          
          const nextResourceStart = loggingModuleContent.indexOf('resource "', agentConfigStart + 10);
          const agentConfigSection = nextResourceStart === -1 
            ? loggingModuleContent.substring(agentConfigStart)
            : loggingModuleContent.substring(agentConfigStart, nextResourceStart);
          
          // Verify that the expected dependency is present in depends_on
          const dependsOnMatch = agentConfigSection.match(/depends_on\s*=\s*\[([\s\S]*?)\]/);
          expect(dependsOnMatch).toBeTruthy();
          
          if (dependsOnMatch) {
            const dependenciesStr = dependsOnMatch[1];
            expect(dependenciesStr).toContain(expectedDependency);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 13: Agent configuration destruction ordering - Comprehensive destruction order test', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        (iteration) => {
          // For any terraform destroy operation, verify the destruction order is correct
          
          // All critical checks must pass
          expect(agentConfigHasDependsOn(loggingModuleContent)).toBe(true);
          expect(agentConfigDependsOnLog(loggingModuleContent)).toBe(true);
          expect(agentConfigHasCorrectLifecycle(loggingModuleContent)).toBe(true);
          expect(agentConfigReferencesLog(loggingModuleContent)).toBe(true);
          expect(logGroupHasNoAgentDependency(loggingModuleContent)).toBe(true);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 13: Agent configuration destruction ordering - Destruction order guarantees', () => {
    // This test verifies the key property: agent config is destroyed before log group
    // This is guaranteed by:
    // 1. Agent config has depends_on = [oci_logging_log.app, ...]
    // 2. Agent config has lifecycle { create_before_destroy = false }
    // 3. Log group does NOT depend on agent config
    
    // When terraform destroy runs, it will:
    // - Destroy resources in reverse dependency order
    // - Agent config depends on log, so agent config is destroyed first
    // - Then log can be destroyed
    // - Then log group can be destroyed
    
    const hasCorrectDependencies = agentConfigDependsOnLog(loggingModuleContent);
    const hasCorrectLifecycle = agentConfigHasCorrectLifecycle(loggingModuleContent);
    const noCircularDeps = logGroupHasNoAgentDependency(loggingModuleContent);
    
    expect(hasCorrectDependencies).toBe(true);
    expect(hasCorrectLifecycle).toBe(true);
    expect(noCircularDeps).toBe(true);
  });
});
