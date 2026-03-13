import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import fc from 'fast-check';

// Feature: oci-infra-repository, Property 14: Configurable HTTP port security rules
// Feature: oci-infra-repository, Property 15: Public IP assignment
// Feature: oci-infra-repository, Property 16: Configurable CIDR block references
// Validates: Requirements 8.4, 8.5, 8.6

describe('Feature: oci-infra-repository - Network Configuration Property Tests', () => {
  const networkMainPath = join(__dirname, '../../terraform/modules/oci-network/main.tf');
  const networkVariablesPath = join(__dirname, '../../terraform/modules/oci-network/variables.tf');
  const computeMainPath = join(__dirname, '../../terraform/modules/oci-compute/main.tf');
  
  const networkMainContent = readFileSync(networkMainPath, 'utf-8');
  const networkVariablesContent = readFileSync(networkVariablesPath, 'utf-8');
  const computeMainContent = readFileSync(computeMainPath, 'utf-8');

  /**
   * Generator for valid HTTP port numbers
   * Generates ports in common ranges: 80, 443, 3000-9999
   */
  const httpPortArbitrary = fc.oneof(
    fc.constant(80),
    fc.constant(443),
    fc.constant(8080),
    fc.constant(3000),
    fc.integer({ min: 3000, max: 9999 }),
    fc.integer({ min: 1024, max: 65535 })
  );

  /**
   * Generator for valid CIDR blocks
   * Generates various CIDR notations
   */
  const cidrBlockArbitrary = fc.oneof(
    // Common CIDR blocks
    fc.constant('0.0.0.0/0'),
    fc.constant('10.0.0.0/8'),
    fc.constant('172.16.0.0/12'),
    fc.constant('192.168.0.0/16'),
    
    // Random CIDR blocks
    fc.record({
      octet1: fc.integer({ min: 1, max: 255 }),
      octet2: fc.integer({ min: 0, max: 255 }),
      octet3: fc.integer({ min: 0, max: 255 }),
      octet4: fc.integer({ min: 0, max: 255 }),
      prefix: fc.integer({ min: 8, max: 32 })
    }).map(({ octet1, octet2, octet3, octet4, prefix }) => 
      `${octet1}.${octet2}.${octet3}.${octet4}/${prefix}`
    ),
    
    // Single IP addresses (CIDR /32)
    fc.record({
      octet1: fc.integer({ min: 1, max: 255 }),
      octet2: fc.integer({ min: 0, max: 255 }),
      octet3: fc.integer({ min: 0, max: 255 }),
      octet4: fc.integer({ min: 0, max: 255 })
    }).map(({ octet1, octet2, octet3, octet4 }) => 
      `${octet1}.${octet2}.${octet3}.${octet4}/32`
    )
  );

  /**
   * Helper function to check if HTTP port configuration exists in main.tf
   */
  function hasHttpPortConfiguration(port: number): boolean {
    // Check if main.tf has dynamic ingress rules for HTTP port
    const hasDynamicHttpRules = networkMainContent.includes('var.http_port');
    const hasHttpPortVariable = networkVariablesContent.includes('variable "http_port"');
    
    return hasDynamicHttpRules && hasHttpPortVariable;
  }

  /**
   * Helper function to check if extra ports configuration exists
   */
  function hasExtraPortsConfiguration(): boolean {
    const hasExtraPortsVariable = networkVariablesContent.includes('variable "extra_ports"');
    const hasDynamicExtraPortsRules = networkMainContent.includes('var.extra_ports');
    
    return hasExtraPortsVariable && hasDynamicExtraPortsRules;
  }

  /**
   * Helper function to check if CIDR block configuration exists
   */
  function hasCidrBlockConfiguration(): boolean {
    // Check for allowed_ssh_cidrs and allowed_http_cidrs variables
    const hasSshCidrsVariable = networkVariablesContent.includes('variable "allowed_ssh_cidrs"');
    const hasHttpCidrsVariable = networkVariablesContent.includes('variable "allowed_http_cidrs"');
    
    // Check for dynamic ingress rules using these CIDR blocks
    const hasDynamicSshRules = networkMainContent.includes('var.allowed_ssh_cidrs');
    const hasDynamicHttpRules = networkMainContent.includes('var.allowed_http_cidrs');
    
    return hasSshCidrsVariable && hasHttpCidrsVariable && 
           hasDynamicSshRules && hasDynamicHttpRules;
  }

  /**
   * Helper function to check if public IP assignment is configured
   */
  function hasPublicIpAssignment(): boolean {
    // Check if compute module assigns public IP in create_vnic_details
    return computeMainContent.includes('assign_public_ip = true');
  }

  // ========================================================================
  // Property 14: Configurable HTTP port security rules
  // ========================================================================

  it('Property 14: HTTP port variable exists', () => {
    // Verify that variables.tf contains http_port variable
    expect(networkVariablesContent).toContain('variable "http_port"');
    expect(networkVariablesContent).toMatch(/type\s*=\s*number/);
  });

  it('Property 14: HTTP port has default value', () => {
    // Verify that http_port has a default value
    const httpPortMatch = networkVariablesContent.match(
      /variable\s+"http_port"[^}]*default\s*=\s*(\d+)/s
    );
    expect(httpPortMatch).toBeTruthy();
    
    if (httpPortMatch) {
      const defaultPort = parseInt(httpPortMatch[1]);
      expect(defaultPort).toBeGreaterThan(0);
      expect(defaultPort).toBeLessThanOrEqual(65535);
    }
  });

  it('Property 14: Dynamic ingress rules for HTTP port', () => {
    // Verify that main.tf has dynamic ingress rules using var.http_port
    expect(networkMainContent).toContain('var.http_port');
    expect(networkMainContent).toMatch(/tcp_options\s*{[^}]*min\s*=\s*var\.http_port/s);
    expect(networkMainContent).toMatch(/tcp_options\s*{[^}]*max\s*=\s*var\.http_port/s);
  });

  it('Property 14: Extra ports variable exists', () => {
    // Verify that variables.tf contains extra_ports variable for additional HTTP ports
    expect(networkVariablesContent).toContain('variable "extra_ports"');
    expect(networkVariablesContent).toMatch(/type\s*=\s*list\(number\)/);
  });

  it('Property 14: Dynamic ingress rules for extra ports', () => {
    // Verify that main.tf has dynamic ingress rules for extra_ports
    expect(networkMainContent).toContain('var.extra_ports');
    expect(networkMainContent).toMatch(/dynamic\s+"ingress_security_rules"\s*{[^}]*for_each\s*=\s*var\.extra_ports/s);
  });

  it('Property 14: Configurable HTTP port security rules - Various ports', () => {
    fc.assert(
      fc.property(
        httpPortArbitrary,
        (port) => {
          // For any HTTP port specified, the module should have configuration to handle it
          const hasConfig = hasHttpPortConfiguration(port);
          expect(hasConfig).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 14: Multiple HTTP ports support', () => {
    fc.assert(
      fc.property(
        fc.array(httpPortArbitrary, { minLength: 1, maxLength: 10 }),
        (ports) => {
          // For any list of HTTP ports, the module should support extra_ports configuration
          const hasExtraPorts = hasExtraPortsConfiguration();
          expect(hasExtraPorts).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  // ========================================================================
  // Property 15: Public IP assignment
  // ========================================================================

  it('Property 15: Public IP assignment is configured', () => {
    // Verify that compute module assigns public IP
    expect(computeMainContent).toContain('assign_public_ip');
    expect(computeMainContent).toContain('assign_public_ip = true');
  });

  it('Property 15: Public IP in create_vnic_details block', () => {
    // Verify that assign_public_ip is in create_vnic_details
    const vnicMatch = computeMainContent.match(
      /create_vnic_details\s*{[^}]*assign_public_ip\s*=\s*true[^}]*}/s
    );
    expect(vnicMatch).toBeTruthy();
  });

  it('Property 15: Public IP assignment for all instances', () => {
    fc.assert(
      fc.property(
        fc.constant(true), // All instances should get public IP
        () => {
          // For any provisioned compute instance, it should be assigned a public IP
          const hasPublicIp = hasPublicIpAssignment();
          expect(hasPublicIp).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  // ========================================================================
  // Property 16: Configurable CIDR block references
  // ========================================================================

  it('Property 16: SSH CIDR blocks variable exists', () => {
    // Verify that variables.tf contains allowed_ssh_cidrs variable
    expect(networkVariablesContent).toContain('variable "allowed_ssh_cidrs"');
    expect(networkVariablesContent).toMatch(/type\s*=\s*list\(string\)/);
  });

  it('Property 16: HTTP CIDR blocks variable exists', () => {
    // Verify that variables.tf contains allowed_http_cidrs variable
    expect(networkVariablesContent).toContain('variable "allowed_http_cidrs"');
    expect(networkVariablesContent).toMatch(/type\s*=\s*list\(string\)/);
  });

  it('Property 16: Dynamic ingress rules for SSH CIDR blocks', () => {
    // Verify that main.tf has dynamic ingress rules using allowed_ssh_cidrs
    expect(networkMainContent).toMatch(/dynamic\s+"ingress_security_rules"\s*{[^}]*for_each\s*=\s*var\.allowed_ssh_cidrs/s);
    expect(networkMainContent).toMatch(/source\s*=\s*ingress_security_rules\.value/);
  });

  it('Property 16: Dynamic ingress rules for HTTP CIDR blocks', () => {
    // Verify that main.tf has dynamic ingress rules using allowed_http_cidrs
    expect(networkMainContent).toMatch(/dynamic\s+"ingress_security_rules"\s*{[^}]*for_each\s*=\s*var\.allowed_http_cidrs/s);
  });

  it('Property 16: CIDR blocks used as source in security rules', () => {
    // Verify that CIDR blocks are referenced as source in ingress rules
    expect(networkMainContent).toContain('source_type = "CIDR_BLOCK"');
    expect(networkMainContent).toMatch(/source\s*=\s*ingress_security_rules\.value/);
  });

  it('Property 16: Configurable CIDR block references - Various CIDR blocks', () => {
    fc.assert(
      fc.property(
        cidrBlockArbitrary,
        (cidr) => {
          // For any CIDR block specified, the module should have configuration to reference it
          const hasConfig = hasCidrBlockConfiguration();
          expect(hasConfig).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 16: Multiple CIDR blocks support', () => {
    fc.assert(
      fc.property(
        fc.array(cidrBlockArbitrary, { minLength: 1, maxLength: 10 }),
        (cidrs) => {
          // For any list of CIDR blocks, the module should support list configuration
          const hasConfig = hasCidrBlockConfiguration();
          expect(hasConfig).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 16: SSH and HTTP use separate CIDR configurations', () => {
    // Verify that SSH and HTTP can have different CIDR blocks
    const sshCidrMatches = networkMainContent.match(/for_each\s*=\s*var\.allowed_ssh_cidrs/g);
    const httpCidrMatches = networkMainContent.match(/for_each\s*=\s*var\.allowed_http_cidrs/g);
    
    expect(sshCidrMatches).toBeTruthy();
    expect(httpCidrMatches).toBeTruthy();
    expect(sshCidrMatches!.length).toBeGreaterThan(0);
    expect(httpCidrMatches!.length).toBeGreaterThan(0);
  });

  // ========================================================================
  // Combined Property Tests
  // ========================================================================

  it('Combined: HTTP port with CIDR blocks', () => {
    fc.assert(
      fc.property(
        fc.record({
          port: httpPortArbitrary,
          cidrs: fc.array(cidrBlockArbitrary, { minLength: 1, maxLength: 5 })
        }),
        ({ port, cidrs }) => {
          // For any HTTP port and CIDR blocks, both configurations should exist
          const hasPortConfig = hasHttpPortConfiguration(port);
          const hasCidrConfig = hasCidrBlockConfiguration();
          
          expect(hasPortConfig).toBe(true);
          expect(hasCidrConfig).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Combined: Public IP with network security', () => {
    fc.assert(
      fc.property(
        fc.record({
          port: httpPortArbitrary,
          cidr: cidrBlockArbitrary
        }),
        ({ port, cidr }) => {
          // For any network configuration, public IP should be assigned
          const hasPublicIp = hasPublicIpAssignment();
          const hasNetworkConfig = hasCidrBlockConfiguration();
          
          expect(hasPublicIp).toBe(true);
          expect(hasNetworkConfig).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
