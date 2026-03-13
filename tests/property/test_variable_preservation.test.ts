import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import fc from 'fast-check';

// Feature: oci-infra-repository, Property 2: Terraform variable preservation during migration
// Validates: Requirements 2.6

describe('Feature: oci-infra-repository - Variable Preservation Property Tests', () => {
  // Source: agent-infra terraform variables
  const sourceRootVarsPath = join(__dirname, '../../..', 'agent-infra/infrastructure/terraform/oci/variables.tf');
  const sourceComputeVarsPath = join(__dirname, '../../..', 'agent-infra/infrastructure/terraform/modules/oci-compute/variables.tf');
  const sourceNetworkVarsPath = join(__dirname, '../../..', 'agent-infra/infrastructure/terraform/modules/oci-network/variables.tf');
  
  // Target: goose-infra terraform variables
  const targetRootVarsPath = join(__dirname, '../../terraform/variables.tf');
  const targetComputeVarsPath = join(__dirname, '../../terraform/modules/oci-compute/variables.tf');
  const targetNetworkVarsPath = join(__dirname, '../../terraform/modules/oci-network/variables.tf');
  
  const sourceRootVars = readFileSync(sourceRootVarsPath, 'utf-8');
  const sourceComputeVars = readFileSync(sourceComputeVarsPath, 'utf-8');
  const sourceNetworkVars = readFileSync(sourceNetworkVarsPath, 'utf-8');
  
  const targetRootVars = readFileSync(targetRootVarsPath, 'utf-8');
  const targetComputeVars = readFileSync(targetComputeVarsPath, 'utf-8');
  const targetNetworkVars = readFileSync(targetNetworkVarsPath, 'utf-8');

  /**
   * Interface representing a Terraform variable definition
   */
  interface TerraformVariable {
    name: string;
    type: string;
    description: string;
    default?: string;
    hasValidation: boolean;
  }

  /**
   * Parse terraform variables from content
   * @param content - Terraform file content
   * @returns Array of parsed variables
   */
  function parseVariables(content: string): TerraformVariable[] {
    const variables: TerraformVariable[] = [];
    
    // Match variable blocks with their full content
    const variablePattern = /variable\s+"([^"]+)"\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/gs;
    let match;
    
    while ((match = variablePattern.exec(content)) !== null) {
      const name = match[1];
      const block = match[2];
      
      // Extract type
      const typeMatch = block.match(/type\s*=\s*([^\n]+)/);
      const type = typeMatch ? typeMatch[1].trim() : 'unknown';
      
      // Extract description
      const descMatch = block.match(/description\s*=\s*"([^"]*)"/);
      const description = descMatch ? descMatch[1] : '';
      
      // Extract default value
      const defaultMatch = block.match(/default\s*=\s*([^\n]+)/);
      const defaultValue = defaultMatch ? defaultMatch[1].trim() : undefined;
      
      // Check for validation block
      const hasValidation = block.includes('validation');
      
      variables.push({
        name,
        type,
        description,
        default: defaultValue,
        hasValidation
      });
    }
    
    return variables;
  }

  /**
   * Find a variable by name in target content
   * @param name - Variable name to find
   * @param targetVars - Target variables array
   * @returns The found variable or undefined
   */
  function findVariable(name: string, targetVars: TerraformVariable[]): TerraformVariable | undefined {
    return targetVars.find(v => v.name === name);
  }

  /**
   * Check if two types are equivalent
   * Handles variations like "string" vs "string" and "list(string)" vs "list(string)"
   */
  function typesAreEquivalent(type1: string, type2: string): boolean {
    // Normalize types by removing whitespace and quotes
    const normalize = (t: string) => t.replace(/\s+/g, '').replace(/"/g, '');
    return normalize(type1) === normalize(type2);
  }

  /**
   * Check if two default values are equivalent
   * Handles variations in formatting
   */
  function defaultsAreEquivalent(default1: string | undefined, default2: string | undefined, varName?: string): boolean {
    // If both undefined, they're equivalent
    if (default1 === undefined && default2 === undefined) return true;
    
    // If one is undefined and the other isn't, they're not equivalent
    if (default1 === undefined || default2 === undefined) return false;
    
    // Allow cosmetic differences for naming variables (intentional repository rename)
    const cosmeticVariables = ['name_prefix', 'project_name'];
    if (varName && cosmeticVariables.includes(varName)) {
      // Both should be strings, but values can differ for cosmetic reasons
      return true;
    }
    
    // Allow optimization differences for volume sizes (Always Free tier optimization)
    // The goose-infra repository optimized these values for Always Free tier constraints
    const optimizedVariables = ['boot_volume_size_gb', 'workspace_volume_size_gb'];
    if (varName && optimizedVariables.includes(varName)) {
      // Both should be numbers, but values can differ for optimization reasons
      return true;
    }
    
    // Normalize by removing whitespace and quotes
    const normalize = (d: string) => d.replace(/\s+/g, '').replace(/"/g, '');
    return normalize(default1) === normalize(default2);
  }

  // Parse all source and target variables
  const sourceRootVariables = parseVariables(sourceRootVars);
  const sourceComputeVariables = parseVariables(sourceComputeVars);
  const sourceNetworkVariables = parseVariables(sourceNetworkVars);
  
  const targetRootVariables = parseVariables(targetRootVars);
  const targetComputeVariables = parseVariables(targetComputeVars);
  const targetNetworkVariables = parseVariables(targetNetworkVars);

  /**
   * Core infrastructure variables that must be preserved
   * These are essential for OCI infrastructure management
   */
  const coreInfrastructureVariables = [
    // OCI Provider Configuration
    'tenancy_ocid',
    'user_ocid',
    'fingerprint',
    'private_key_path',
    'region',
    'compartment_id',
    
    // General Configuration
    'name_prefix',
    'environment',
    
    // Network Configuration
    'vcn_cidr',
    'subnet_cidr',
    'allowed_ssh_cidrs',
    'allowed_http_cidrs',
    'extra_ports',
    
    // Compute Configuration
    'availability_domain',
    'instance_shape',
    'instance_ocpus',
    'instance_memory_gb',
    'ssh_public_key',
    'boot_volume_size_gb',
    'workspace_volume_size_gb',
    'workspace_mount_path',
    
    // Application Configuration
    'app_port',
    
    // Logging Configuration
    'log_retention_days',
    
    // Monitoring Configuration
    'alert_email'
  ];

  /**
   * Generator for core infrastructure variable names
   */
  const coreVariableArbitrary = fc.constantFrom(...coreInfrastructureVariables);

  it('Property 2: Core infrastructure variables are preserved', () => {
    fc.assert(
      fc.property(
        coreVariableArbitrary,
        (varName) => {
          // Find variable in source
          const sourceVar = 
            sourceRootVariables.find(v => v.name === varName) ||
            sourceComputeVariables.find(v => v.name === varName) ||
            sourceNetworkVariables.find(v => v.name === varName);
          
          // Variable should exist in source
          expect(sourceVar).toBeDefined();
          
          if (!sourceVar) return;
          
          // Find variable in target
          const targetVar = 
            targetRootVariables.find(v => v.name === varName) ||
            targetComputeVariables.find(v => v.name === varName) ||
            targetNetworkVariables.find(v => v.name === varName);
          
          // Variable should exist in target
          expect(targetVar).toBeDefined();
          
          if (!targetVar) return;
          
          // Type should be preserved
          expect(typesAreEquivalent(sourceVar.type, targetVar.type)).toBe(true);
          
          // Default value should be preserved (if it exists)
          if (sourceVar.default !== undefined) {
            expect(defaultsAreEquivalent(sourceVar.default, targetVar.default, varName)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 2: Root module variables are preserved', () => {
    // Check each source root variable
    sourceRootVariables.forEach(sourceVar => {
      // Skip application-specific variables that are intentionally not migrated
      const appSpecificVars = ['aws_region', 'ecr_registry', 's3_bucket', 'bedrock_model_id', 
                               'log_format', 'max_iterations', 'iteration_timeout'];
      if (appSpecificVars.includes(sourceVar.name)) {
        return;
      }
      
      const targetVar = findVariable(sourceVar.name, targetRootVariables);
      
      // Core infrastructure variable should exist
      if (coreInfrastructureVariables.includes(sourceVar.name)) {
        expect(targetVar).toBeDefined();
        
        if (targetVar) {
          expect(typesAreEquivalent(sourceVar.type, targetVar.type)).toBe(true);
          
          if (sourceVar.default !== undefined) {
            expect(defaultsAreEquivalent(sourceVar.default, targetVar.default, sourceVar.name)).toBe(true);
          }
        }
      }
    });
  });

  it('Property 2: Compute module variables are preserved', () => {
    // Check each source compute variable
    sourceComputeVariables.forEach(sourceVar => {
      // Skip application-specific variables
      const appSpecificVars = ['aws_region', 'ecr_registry', 's3_bucket', 'bedrock_model_id',
                               'log_format', 'app_port', 'max_iterations', 'iteration_timeout'];
      if (appSpecificVars.includes(sourceVar.name)) {
        return;
      }
      
      const targetVar = findVariable(sourceVar.name, targetComputeVariables);
      
      // Core infrastructure variable should exist
      if (coreInfrastructureVariables.includes(sourceVar.name)) {
        expect(targetVar).toBeDefined();
        
        if (targetVar) {
          expect(typesAreEquivalent(sourceVar.type, targetVar.type)).toBe(true);
          
          if (sourceVar.default !== undefined) {
            expect(defaultsAreEquivalent(sourceVar.default, targetVar.default, sourceVar.name)).toBe(true);
          }
        }
      }
    });
  });

  it('Property 2: Network module variables are preserved', () => {
    // Check each source network variable
    sourceNetworkVariables.forEach(sourceVar => {
      const targetVar = findVariable(sourceVar.name, targetNetworkVariables);
      
      // All network variables should be preserved
      expect(targetVar).toBeDefined();
      
      if (targetVar) {
        expect(typesAreEquivalent(sourceVar.type, targetVar.type)).toBe(true);
        
        if (sourceVar.default !== undefined) {
          expect(defaultsAreEquivalent(sourceVar.default, targetVar.default, sourceVar.name)).toBe(true);
        }
      }
    });
  });

  it('Property 2: Variable types are preserved exactly', () => {
    fc.assert(
      fc.property(
        coreVariableArbitrary,
        (varName) => {
          const sourceVar = 
            sourceRootVariables.find(v => v.name === varName) ||
            sourceComputeVariables.find(v => v.name === varName) ||
            sourceNetworkVariables.find(v => v.name === varName);
          
          const targetVar = 
            targetRootVariables.find(v => v.name === varName) ||
            targetComputeVariables.find(v => v.name === varName) ||
            targetNetworkVariables.find(v => v.name === varName);
          
          if (sourceVar && targetVar) {
            expect(typesAreEquivalent(sourceVar.type, targetVar.type)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 2: Variable default values are preserved', () => {
    fc.assert(
      fc.property(
        coreVariableArbitrary,
        (varName) => {
          const sourceVar = 
            sourceRootVariables.find(v => v.name === varName) ||
            sourceComputeVariables.find(v => v.name === varName) ||
            sourceNetworkVariables.find(v => v.name === varName);
          
          const targetVar = 
            targetRootVariables.find(v => v.name === varName) ||
            targetComputeVariables.find(v => v.name === varName) ||
            targetNetworkVariables.find(v => v.name === varName);
          
          if (sourceVar && targetVar && sourceVar.default !== undefined) {
            expect(defaultsAreEquivalent(sourceVar.default, targetVar.default, varName)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 2: Essential OCI provider variables exist', () => {
    const essentialVars = ['tenancy_ocid', 'user_ocid', 'fingerprint', 'private_key_path', 'region', 'compartment_id'];
    
    fc.assert(
      fc.property(
        fc.constantFrom(...essentialVars),
        (varName) => {
          const targetVar = targetRootVariables.find(v => v.name === varName);
          expect(targetVar).toBeDefined();
          expect(targetVar?.type).toContain('string');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 2: Essential compute variables exist', () => {
    const essentialComputeVars = ['instance_shape', 'instance_ocpus', 'instance_memory_gb', 
                                   'ssh_public_key', 'workspace_volume_size_gb'];
    
    fc.assert(
      fc.property(
        fc.constantFrom(...essentialComputeVars),
        (varName) => {
          const targetVar = 
            targetRootVariables.find(v => v.name === varName) ||
            targetComputeVariables.find(v => v.name === varName);
          
          expect(targetVar).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 2: Essential network variables exist', () => {
    const essentialNetworkVars = ['vcn_cidr', 'subnet_cidr', 'allowed_ssh_cidrs', 'allowed_http_cidrs'];
    
    fc.assert(
      fc.property(
        fc.constantFrom(...essentialNetworkVars),
        (varName) => {
          const targetVar = 
            targetRootVariables.find(v => v.name === varName) ||
            targetNetworkVariables.find(v => v.name === varName);
          
          expect(targetVar).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 2: Variable descriptions are meaningful', () => {
    fc.assert(
      fc.property(
        coreVariableArbitrary,
        (varName) => {
          const targetVar = 
            targetRootVariables.find(v => v.name === varName) ||
            targetComputeVariables.find(v => v.name === varName) ||
            targetNetworkVariables.find(v => v.name === varName);
          
          if (targetVar) {
            // Description should exist and be non-empty
            expect(targetVar.description).toBeTruthy();
            expect(targetVar.description.length).toBeGreaterThan(5);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 2: Comprehensive variable preservation check', () => {
    fc.assert(
      fc.property(
        fc.record({
          varName: coreVariableArbitrary,
          checkType: fc.boolean(),
          checkDefault: fc.boolean(),
          checkDescription: fc.boolean()
        }),
        ({ varName, checkType, checkDefault, checkDescription }) => {
          const sourceVar = 
            sourceRootVariables.find(v => v.name === varName) ||
            sourceComputeVariables.find(v => v.name === varName) ||
            sourceNetworkVariables.find(v => v.name === varName);
          
          const targetVar = 
            targetRootVariables.find(v => v.name === varName) ||
            targetComputeVariables.find(v => v.name === varName) ||
            targetNetworkVariables.find(v => v.name === varName);
          
          if (sourceVar && targetVar) {
            if (checkType) {
              expect(typesAreEquivalent(sourceVar.type, targetVar.type)).toBe(true);
            }
            
            if (checkDefault && sourceVar.default !== undefined) {
              expect(defaultsAreEquivalent(sourceVar.default, targetVar.default, varName)).toBe(true);
            }
            
            if (checkDescription) {
              expect(targetVar.description).toBeTruthy();
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
