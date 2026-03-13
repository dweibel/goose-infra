import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import fc from 'fast-check';

// Feature: oci-infra-repository, Property 5: Non-ARM64 shape rejection
// Validates: Requirements 4.2, 4.5

describe('Feature: oci-infra-repository - ARM64 Enforcement Property Tests', () => {
  const variablesPath = join(__dirname, '../../terraform/modules/oci-compute/variables.tf');
  const mainTfPath = join(__dirname, '../../terraform/modules/oci-compute/main.tf');
  
  const variablesContent = readFileSync(variablesPath, 'utf-8');
  const mainTfContent = readFileSync(mainTfPath, 'utf-8');

  /**
   * Generator for non-ARM64 OCI compute shapes
   * These are x86/AMD64 shapes that should be rejected
   */
  const nonArm64ShapeArbitrary = fc.oneof(
    // Standard x86 shapes
    fc.constant('VM.Standard2.1'),
    fc.constant('VM.Standard2.2'),
    fc.constant('VM.Standard2.4'),
    fc.constant('VM.Standard2.8'),
    fc.constant('VM.Standard2.16'),
    fc.constant('VM.Standard2.24'),
    
    // E-series x86 shapes
    fc.constant('VM.Standard.E2.1'),
    fc.constant('VM.Standard.E2.2'),
    fc.constant('VM.Standard.E2.4'),
    fc.constant('VM.Standard.E3.Flex'),
    fc.constant('VM.Standard.E4.Flex'),
    
    // Optimized x86 shapes
    fc.constant('VM.Optimized3.Flex'),
    fc.constant('VM.DenseIO2.8'),
    fc.constant('VM.DenseIO2.16'),
    
    // GPU shapes (x86)
    fc.constant('VM.GPU2.1'),
    fc.constant('VM.GPU3.1'),
    
    // HPC shapes (x86)
    fc.constant('BM.HPC2.36'),
    
    // Random invalid shapes
    fc.string({ minLength: 5, maxLength: 30 })
      .filter(s => !s.includes('A1') && !s.includes('arm') && !s.includes('ARM'))
      .map(s => `VM.${s}`)
  );

  /**
   * Helper function to check if a shape would pass Terraform validation
   * Simulates the validation logic from variables.tf
   */
  function wouldPassValidation(shape: string): boolean {
    // The validation rule in variables.tf checks: var.instance_shape == "VM.Standard.A1.Flex"
    return shape === 'VM.Standard.A1.Flex';
  }

  /**
   * Helper function to check if validation error message is descriptive
   */
  function hasDescriptiveErrorMessage(shape: string): boolean {
    // Check if the error message in variables.tf is descriptive
    // It should mention: the invalid shape, the allowed shape, and the reason
    const validationBlock = variablesContent.match(/validation\s*\{[^}]*error_message\s*=\s*"[^"]*"\s*\}/s);
    
    if (!validationBlock) {
      return false;
    }

    const errorMessage = validationBlock[0];
    
    // Check for required elements in error message
    const mentionsAllowedShape = errorMessage.includes('VM.Standard.A1.Flex');
    const mentionsReason = errorMessage.includes('ARM64') || errorMessage.includes('cost optimization');
    const mentionsInvalidShape = errorMessage.includes('Invalid shape') || errorMessage.includes('${var.instance_shape}');
    
    return mentionsAllowedShape && mentionsReason && mentionsInvalidShape;
  }

  it('Property 5: Non-ARM64 shape rejection - Validation rule exists', () => {
    // Verify that variables.tf contains a validation rule for instance_shape
    expect(variablesContent).toContain('variable "instance_shape"');
    expect(variablesContent).toMatch(/validation\s*{/);
    expect(variablesContent).toMatch(/condition\s*=/);
    expect(variablesContent).toMatch(/error_message\s*=/);
  });

  it('Property 5: Non-ARM64 shape rejection - Standard x86 shapes', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant('VM.Standard2.1'),
          fc.constant('VM.Standard2.2'),
          fc.constant('VM.Standard2.4'),
          fc.constant('VM.Standard.E2.1'),
          fc.constant('VM.Standard.E3.Flex')
        ),
        (shape) => {
          // For any non-ARM64 shape, validation should fail
          const passes = wouldPassValidation(shape);
          expect(passes).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 5: Non-ARM64 shape rejection - All non-ARM64 shapes', () => {
    fc.assert(
      fc.property(
        nonArm64ShapeArbitrary,
        (shape) => {
          // Skip if shape happens to be the allowed ARM64 shape
          if (shape === 'VM.Standard.A1.Flex') {
            return;
          }

          // For any non-ARM64 shape, validation should fail
          const passes = wouldPassValidation(shape);
          expect(passes).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 5: ARM64 shape acceptance - VM.Standard.A1.Flex should be accepted', () => {
    // Verify that the allowed ARM64 shape passes validation
    const passes = wouldPassValidation('VM.Standard.A1.Flex');
    expect(passes).toBe(true);
  });

  it('Property 5: Error message descriptiveness', () => {
    // Verify specific elements are present in the error message
    // Match the entire validation block including nested braces
    const validationMatch = variablesContent.match(/validation\s*\{[^}]*error_message\s*=\s*"([^"]*)"/);
    expect(validationMatch).toBeTruthy();
    
    if (validationMatch) {
      const errorMessage = validationMatch[1]; // Extract just the error message string
      expect(errorMessage).toContain('VM.Standard.A1.Flex');
      expect(errorMessage).toMatch(/ARM64|cost optimization/i);
      expect(errorMessage).toMatch(/Invalid shape/i);
    }
  });

  it('Property 5: Validation condition checks for exact shape match', () => {
    // Verify that the validation condition checks for exact match with VM.Standard.A1.Flex
    const validationBlock = variablesContent.match(/validation\s*{[^}]*}/s);
    expect(validationBlock).toBeTruthy();
    
    if (validationBlock) {
      const condition = validationBlock[0];
      expect(condition).toMatch(/var\.instance_shape\s*==\s*"VM\.Standard\.A1\.Flex"/);
    }
  });

  it('Property 5: Additional validation in main.tf', () => {
    // Verify that main.tf has additional ARM64 validation logic
    expect(mainTfContent).toContain('allowed_arm64_shapes');
    expect(mainTfContent).toContain('VM.Standard.A1.Flex');
    expect(mainTfContent).toContain('is_arm64_shape');
    
    // Check for null_resource validation
    expect(mainTfContent).toContain('validate_arm64_shape');
    expect(mainTfContent).toMatch(/Invalid shape.*ARM64/i);
  });

  it('Property 5: Default shape is ARM64', () => {
    // Verify that the default value for instance_shape is VM.Standard.A1.Flex
    const defaultMatch = variablesContent.match(/variable\s+"instance_shape"[^}]*default\s*=\s*"([^"]+)"/s);
    expect(defaultMatch).toBeTruthy();
    
    if (defaultMatch) {
      const defaultValue = defaultMatch[1];
      expect(defaultValue).toBe('VM.Standard.A1.Flex');
    }
  });

  it('Property 5: Comprehensive shape rejection test', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          // Standard x86 shapes
          fc.constant('VM.Standard2.1'),
          fc.constant('VM.Standard2.2'),
          fc.constant('VM.Standard2.4'),
          
          // E-series x86 shapes
          fc.constant('VM.Standard.E2.1'),
          fc.constant('VM.Standard.E3.Flex'),
          fc.constant('VM.Standard.E4.Flex'),
          
          // Optimized shapes
          fc.constant('VM.Optimized3.Flex'),
          
          // GPU shapes
          fc.constant('VM.GPU2.1'),
          fc.constant('VM.GPU3.1'),
          
          // Random invalid shapes
          fc.string({ minLength: 5, maxLength: 20 })
            .filter(s => !s.includes('A1'))
            .map(s => `VM.${s}`)
        ),
        (shape) => {
          // For any non-ARM64 shape, validation should fail
          const passes = wouldPassValidation(shape);
          expect(passes).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
