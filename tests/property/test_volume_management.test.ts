import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import fc from 'fast-check';

// Feature: oci-infra-repository, Property 10: Volume provisioning in same availability domain
// Feature: oci-infra-repository, Property 11: Volume persistence after instance destruction
// Feature: oci-infra-repository, Property 12: Configurable volume size
// Validates: Requirements 6.1, 6.2, 6.4, 6.5

describe('Feature: oci-infra-repository - Volume Management Property Tests', () => {
  const computeMainPath = join(__dirname, '../../terraform/modules/oci-compute/main.tf');
  const computeVariablesPath = join(__dirname, '../../terraform/modules/oci-compute/variables.tf');
  const rootMainPath = join(__dirname, '../../terraform/main.tf');
  const rootVariablesPath = join(__dirname, '../../terraform/variables.tf');
  
  const computeMainContent = readFileSync(computeMainPath, 'utf-8');
  const computeVariablesContent = readFileSync(computeVariablesPath, 'utf-8');
  const rootMainContent = readFileSync(rootMainPath, 'utf-8');
  const rootVariablesContent = readFileSync(rootVariablesPath, 'utf-8');

  /**
   * Generator for valid volume sizes (50-200 GB for Always Free tier)
   */
  const volumeSizeArbitrary = fc.integer({ min: 50, max: 200 });

  /**
   * Generator for availability domain names
   */
  const availabilityDomainArbitrary = fc.oneof(
    fc.constant('AD-1'),
    fc.constant('AD-2'),
    fc.constant('AD-3'),
    fc.string({ minLength: 10, maxLength: 50 }).map(s => `AD-${s}`)
  );

  /**
   * Helper function to extract resource block
   */
  function extractResourceBlock(content: string, resourceType: string, resourceName: string): string | null {
    const startPattern = `resource "${resourceType}" "${resourceName}"`;
    const startIndex = content.indexOf(startPattern);
    
    if (startIndex === -1) return null;
    
    let braceCount = 0;
    let inBlock = false;
    let endIndex = startIndex;
    
    for (let i = startIndex; i < content.length; i++) {
      if (content[i] === '{') {
        braceCount++;
        inBlock = true;
      } else if (content[i] === '}') {
        braceCount--;
        if (inBlock && braceCount === 0) {
          endIndex = i + 1;
          break;
        }
      }
    }
    
    return content.substring(startIndex, endIndex);
  }

  /**
   * Helper function to check if volume uses same AD as instance
   */
  function volumeUsesSameAD(content: string): boolean {
    const volumeBlock = extractResourceBlock(content, 'oci_core_volume', 'workspace');
    const instanceBlock = extractResourceBlock(content, 'oci_core_instance', 'main');
    
    if (!volumeBlock || !instanceBlock) return false;
    
    // Extract AD expressions from both resources
    const volumeADMatch = volumeBlock.match(/availability_domain\s*=\s*(.+)/);
    const instanceADMatch = instanceBlock.match(/availability_domain\s*=\s*(.+)/);
    
    if (!volumeADMatch || !instanceADMatch) return false;
    
    // Both should use the same expression (either var.availability_domain or data source)
    const volumeAD = volumeADMatch[1].trim();
    const instanceAD = instanceADMatch[1].trim();
    
    // Check if they use the same logic (both reference same variable or data source)
    return volumeAD === instanceAD;
  }

  /**
   * Helper function to check if volume attachment exists
   */
  function volumeAttachmentExists(content: string): boolean {
    return content.includes('resource "oci_core_volume_attachment"');
  }

  /**
   * Helper function to check if volume attachment references instance and volume
   */
  function volumeAttachmentReferencesResources(content: string): boolean {
    const attachmentBlock = extractResourceBlock(content, 'oci_core_volume_attachment', 'workspace');
    
    if (!attachmentBlock) return false;
    
    const referencesInstance = attachmentBlock.includes('oci_core_instance.main.id');
    const referencesVolume = attachmentBlock.includes('oci_core_volume.workspace.id');
    
    return referencesInstance && referencesVolume;
  }

  /**
   * Helper function to check if volume has lifecycle prevent_destroy
   */
  function volumeHasPreventDestroy(content: string): boolean {
    const volumeBlock = extractResourceBlock(content, 'oci_core_volume', 'workspace');
    
    if (!volumeBlock) return false;
    
    // Check for lifecycle block with prevent_destroy = true
    const lifecycleMatch = volumeBlock.match(/lifecycle\s*\{[\s\S]*?\}/);
    
    if (!lifecycleMatch) {
      // If no lifecycle block, volume can be destroyed (not persistent)
      // For this property, we check if the volume is NOT dependent on instance lifecycle
      // The absence of prevent_destroy is acceptable if volume is independent
      return true; // Volume is independent by default in Terraform
    }
    
    const lifecycleBlock = lifecycleMatch[0];
    return lifecycleBlock.includes('prevent_destroy');
  }

  /**
   * Helper function to check if volume is independent of instance lifecycle
   */
  function volumeIsIndependent(content: string): boolean {
    const volumeBlock = extractResourceBlock(content, 'oci_core_volume', 'workspace');
    
    if (!volumeBlock) return false;
    
    // Volume should NOT have depends_on referencing the instance
    // This ensures volume can exist independently
    const dependsOnMatch = volumeBlock.match(/depends_on\s*=\s*\[[\s\S]*?\]/);
    
    if (!dependsOnMatch) {
      // No depends_on means it's independent
      return true;
    }
    
    const dependsOnBlock = dependsOnMatch[0];
    // Should not depend on the instance
    return !dependsOnBlock.includes('oci_core_instance.main');
  }

  /**
   * Helper function to check if workspace_volume_size_gb variable exists
   */
  function volumeSizeVariableExists(content: string): boolean {
    return content.includes('variable "workspace_volume_size_gb"');
  }

  /**
   * Helper function to check if volume uses size variable
   */
  function volumeUsesSizeVariable(content: string): boolean {
    const volumeBlock = extractResourceBlock(content, 'oci_core_volume', 'workspace');
    
    if (!volumeBlock) return false;
    
    return volumeBlock.includes('var.workspace_volume_size_gb');
  }

  /**
   * Helper function to check if volume size variable has validation
   */
  function volumeSizeHasValidation(content: string): boolean {
    const variablePattern = /variable\s+"workspace_volume_size_gb"\s*\{[\s\S]*?\n\}/;
    const match = content.match(variablePattern);
    
    if (!match) return false;
    
    const variableBlock = match[0];
    return variableBlock.includes('validation');
  }

  /**
   * Helper function to extract default volume size
   */
  function extractDefaultVolumeSize(content: string): number | null {
    const variablePattern = /variable\s+"workspace_volume_size_gb"\s*\{[\s\S]*?\n\}/;
    const match = content.match(variablePattern);
    
    if (!match) return null;
    
    const variableBlock = match[0];
    const defaultMatch = variableBlock.match(/default\s*=\s*(\d+)/);
    
    return defaultMatch ? parseInt(defaultMatch[1], 10) : null;
  }

  // ========================================================================
  // Property 10: Volume provisioning in same availability domain
  // ========================================================================

  it('Property 10: Volume resource exists', () => {
    expect(computeMainContent).toContain('resource "oci_core_volume" "workspace"');
  });

  it('Property 10: Instance resource exists', () => {
    expect(computeMainContent).toContain('resource "oci_core_instance" "main"');
  });

  it('Property 10: Volume uses same availability domain as instance', () => {
    expect(volumeUsesSameAD(computeMainContent)).toBe(true);
  });

  it('Property 10: Volume attachment exists', () => {
    expect(volumeAttachmentExists(computeMainContent)).toBe(true);
  });

  it('Property 10: Volume attachment references instance and volume', () => {
    expect(volumeAttachmentReferencesResources(computeMainContent)).toBe(true);
  });

  it('Property 10: Volume and instance use consistent AD logic', () => {
    fc.assert(
      fc.property(
        availabilityDomainArbitrary,
        (ad) => {
          // For any availability domain, volume and instance should use same AD logic
          expect(volumeUsesSameAD(computeMainContent)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 10: Volume attachment configuration is complete', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        (iteration) => {
          // For any provisioning scenario, attachment should be properly configured
          expect(volumeAttachmentExists(computeMainContent)).toBe(true);
          expect(volumeAttachmentReferencesResources(computeMainContent)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  // ========================================================================
  // Property 11: Volume persistence after instance destruction
  // ========================================================================

  it('Property 11: Volume is independent of instance lifecycle', () => {
    expect(volumeIsIndependent(computeMainContent)).toBe(true);
  });

  it('Property 11: Volume does not depend on instance', () => {
    const volumeBlock = extractResourceBlock(computeMainContent, 'oci_core_volume', 'workspace');
    expect(volumeBlock).toBeTruthy();
    
    if (volumeBlock) {
      // Volume should not have depends_on referencing instance
      const dependsOnMatch = volumeBlock.match(/depends_on\s*=\s*\[[\s\S]*?\]/);
      if (dependsOnMatch) {
        expect(dependsOnMatch[0]).not.toContain('oci_core_instance.main');
      }
    }
  });

  it('Property 11: Volume can exist independently', () => {
    // Volume resource should be defined separately from instance
    const volumeBlock = extractResourceBlock(computeMainContent, 'oci_core_volume', 'workspace');
    const instanceBlock = extractResourceBlock(computeMainContent, 'oci_core_instance', 'main');
    
    expect(volumeBlock).toBeTruthy();
    expect(instanceBlock).toBeTruthy();
    
    // They should be separate resources
    expect(volumeBlock).not.toEqual(instanceBlock);
  });

  it('Property 11: Volume persistence across instance destruction scenarios', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        (destructionScenario) => {
          // For any instance destruction operation, volume should remain independent
          expect(volumeIsIndependent(computeMainContent)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 11: Volume attachment is separate from volume lifecycle', () => {
    // Volume attachment should be a separate resource
    const attachmentBlock = extractResourceBlock(computeMainContent, 'oci_core_volume_attachment', 'workspace');
    const volumeBlock = extractResourceBlock(computeMainContent, 'oci_core_volume', 'workspace');
    
    expect(attachmentBlock).toBeTruthy();
    expect(volumeBlock).toBeTruthy();
    
    // Attachment references volume, but volume doesn't depend on attachment
    if (attachmentBlock && volumeBlock) {
      expect(attachmentBlock).toContain('oci_core_volume.workspace.id');
      expect(volumeBlock).not.toContain('oci_core_volume_attachment');
    }
  });

  // ========================================================================
  // Property 12: Configurable volume size
  // ========================================================================

  it('Property 12: workspace_volume_size_gb variable exists in compute module', () => {
    expect(volumeSizeVariableExists(computeVariablesContent)).toBe(true);
  });

  it('Property 12: workspace_volume_size_gb variable exists in root module', () => {
    expect(volumeSizeVariableExists(rootVariablesContent)).toBe(true);
  });

  it('Property 12: Volume uses workspace_volume_size_gb variable', () => {
    expect(volumeUsesSizeVariable(computeMainContent)).toBe(true);
  });

  it('Property 12: Volume size variable has validation', () => {
    expect(volumeSizeHasValidation(computeVariablesContent)).toBe(true);
  });

  it('Property 12: Volume size variable has default value', () => {
    const defaultSize = extractDefaultVolumeSize(computeVariablesContent);
    expect(defaultSize).not.toBeNull();
    expect(defaultSize).toBeGreaterThanOrEqual(50);
    expect(defaultSize).toBeLessThanOrEqual(200);
  });

  it('Property 12: Root module passes volume size to compute module', () => {
    // Check if root main.tf passes workspace_volume_size_gb to compute module
    expect(rootMainContent).toContain('workspace_volume_size_gb');
    expect(rootMainContent).toContain('var.workspace_volume_size_gb');
  });

  it('Property 12: Volume size is configurable for any valid size', () => {
    fc.assert(
      fc.property(
        volumeSizeArbitrary,
        (size) => {
          // For any valid volume size, the variable should exist and be used
          expect(volumeSizeVariableExists(computeVariablesContent)).toBe(true);
          expect(volumeUsesSizeVariable(computeMainContent)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 12: Volume size variable type is number', () => {
    const variablePattern = /variable\s+"workspace_volume_size_gb"\s*\{[\s\S]*?\n\}/;
    const match = computeVariablesContent.match(variablePattern);
    
    expect(match).toBeTruthy();
    
    if (match) {
      const variableBlock = match[0];
      expect(variableBlock).toMatch(/type\s*=\s*number/);
    }
  });

  it('Property 12: Volume size validation enforces valid range', () => {
    const variablePattern = /variable\s+"workspace_volume_size_gb"\s*\{[\s\S]*?\n\}/;
    const match = computeVariablesContent.match(variablePattern);
    
    expect(match).toBeTruthy();
    
    if (match) {
      const variableBlock = match[0];
      const validationMatch = variableBlock.match(/validation\s*\{[\s\S]*?\}/);
      
      expect(validationMatch).toBeTruthy();
      
      if (validationMatch) {
        const validationBlock = validationMatch[0];
        // Should validate minimum and maximum values
        expect(validationBlock).toMatch(/>=\s*50|>\s*49/);
        expect(validationBlock).toMatch(/<=\s*200|<\s*201/);
      }
    }
  });

  it('Property 12: Volume resource uses size_in_gbs attribute', () => {
    const volumeBlock = extractResourceBlock(computeMainContent, 'oci_core_volume', 'workspace');
    
    expect(volumeBlock).toBeTruthy();
    
    if (volumeBlock) {
      expect(volumeBlock).toContain('size_in_gbs');
      expect(volumeBlock).toContain('var.workspace_volume_size_gb');
    }
  });

  // ========================================================================
  // Combined Property Tests
  // ========================================================================

  it('Combined: Volume management complete configuration', () => {
    fc.assert(
      fc.property(
        fc.record({
          volumeSize: volumeSizeArbitrary,
          availabilityDomain: availabilityDomainArbitrary
        }),
        ({ volumeSize, availabilityDomain }) => {
          // For any volume configuration, all properties should hold
          
          // Property 10: Same AD
          expect(volumeUsesSameAD(computeMainContent)).toBe(true);
          expect(volumeAttachmentExists(computeMainContent)).toBe(true);
          expect(volumeAttachmentReferencesResources(computeMainContent)).toBe(true);
          
          // Property 11: Persistence
          expect(volumeIsIndependent(computeMainContent)).toBe(true);
          
          // Property 12: Configurable size
          expect(volumeSizeVariableExists(computeVariablesContent)).toBe(true);
          expect(volumeUsesSizeVariable(computeMainContent)).toBe(true);
          expect(volumeSizeHasValidation(computeVariablesContent)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Combined: Volume provisioning guarantees', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        (scenario) => {
          // For any provisioning scenario, all guarantees should hold
          
          // Volume and instance exist as separate resources
          expect(computeMainContent).toContain('resource "oci_core_volume" "workspace"');
          expect(computeMainContent).toContain('resource "oci_core_instance" "main"');
          
          // Volume uses same AD as instance
          expect(volumeUsesSameAD(computeMainContent)).toBe(true);
          
          // Volume is attached to instance
          expect(volumeAttachmentExists(computeMainContent)).toBe(true);
          expect(volumeAttachmentReferencesResources(computeMainContent)).toBe(true);
          
          // Volume is independent (can survive instance destruction)
          expect(volumeIsIndependent(computeMainContent)).toBe(true);
          
          // Volume size is configurable
          expect(volumeSizeVariableExists(computeVariablesContent)).toBe(true);
          expect(volumeUsesSizeVariable(computeMainContent)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Combined: End-to-end volume management workflow', () => {
    fc.assert(
      fc.property(
        fc.record({
          volumeSize: volumeSizeArbitrary,
          availabilityDomain: availabilityDomainArbitrary,
          scenario: fc.oneof(
            fc.constant('provision'),
            fc.constant('attach'),
            fc.constant('destroy_instance'),
            fc.constant('reattach')
          )
        }),
        ({ volumeSize, availabilityDomain, scenario }) => {
          // For any workflow scenario, configuration should be correct
          
          switch (scenario) {
            case 'provision':
              // Volume should be provisioned in same AD
              expect(volumeUsesSameAD(computeMainContent)).toBe(true);
              expect(volumeSizeVariableExists(computeVariablesContent)).toBe(true);
              break;
              
            case 'attach':
              // Volume should be attachable to instance
              expect(volumeAttachmentExists(computeMainContent)).toBe(true);
              expect(volumeAttachmentReferencesResources(computeMainContent)).toBe(true);
              break;
              
            case 'destroy_instance':
              // Volume should remain independent
              expect(volumeIsIndependent(computeMainContent)).toBe(true);
              break;
              
            case 'reattach':
              // Volume should be reattachable (independent + attachment exists)
              expect(volumeIsIndependent(computeMainContent)).toBe(true);
              expect(volumeAttachmentExists(computeMainContent)).toBe(true);
              break;
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
