#!/usr/bin/env tsx
/**
 * Film Bridge E2E Test Suite
 * Tests all major components end-to-end
 */

import * as fs from 'fs';
import * as path from 'path';

// Test configuration
const TEST_CONFIG = {
  comfyUrl: 'http://127.0.0.1:8188',
  dashboardUrl: 'http://127.0.0.1:3007',
  timeouts: {
    comfyStartup: 120000,
    dashboardStartup: 30000,
    apiRequest: 10000,
  },
};

// Test results
interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  data?: unknown;
}

const results: TestResult[] = [];

// Helper functions
async function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout = 5000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

function log(message: string, type: 'info' | 'success' | 'error' | 'warn' = 'info'): void {
  const colors = {
    info: '\x1b[36m',    // cyan
    success: '\x1b[32m', // green
    error: '\x1b[31m',   // red
    warn: '\x1b[33m',    // yellow
  };
  const reset = '\x1b[0m';
  console.log(`${colors[type]}[${type.toUpperCase()}]${reset} ${message}`);
}

// Test 1: ComfyUI Health
async function testComfyHealth(): Promise<TestResult> {
  const start = Date.now();
  const name = 'ComfyUI Health Check';
  
  try {
    log('Testing ComfyUI health endpoint...');
    const response = await fetchWithTimeout(
      `${TEST_CONFIG.comfyUrl}/system_stats`,
      {},
      TEST_CONFIG.timeouts.apiRequest
    );
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    log(`ComfyUI device: ${data.device || 'unknown'}`, 'success');
    
    return {
      name,
      passed: true,
      duration: Date.now() - start,
      data: { device: data.device, vram_total: data.vram_total },
    };
  } catch (error) {
    return {
      name,
      passed: false,
      duration: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Test 2: Dashboard Health
async function testDashboardHealth(): Promise<TestResult> {
  const start = Date.now();
  const name = 'Dashboard Health Check';
  
  try {
    log('Testing Dashboard API...');
    const response = await fetchWithTimeout(
      `${TEST_CONFIG.dashboardUrl}/api/film-bridge/status`,
      {},
      TEST_CONFIG.timeouts.apiRequest
    );
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    log(`Dashboard status: ${data.status}`, 'success');
    
    return {
      name,
      passed: true,
      duration: Date.now() - start,
      data: { status: data.status },
    };
  } catch (error) {
    return {
      name,
      passed: false,
      duration: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Test 3: Artifact Registry
async function testArtifactRegistry(): Promise<TestResult> {
  const start = Date.now();
  const name = 'Artifact Registry';
  
  try {
    log('Testing artifact creation...');
    
    const testArtifact = {
      slug: 'e2e-test-artifact',
      name: 'E2E Test Artifact',
      storySignature: {
        series: 'e2e-test',
        episode: 1,
        narrativeWeight: 0.5,
      },
      physical: {
        category: 'tool',
        materials: ['steel', 'wood'],
        dimensions: { length: 15, width: 3, height: 2 },
        distinguishingFeatures: ['test mark'],
      },
      generation: {
        canonicalSeed: 42,
        stylePrompt: 'test style',
        priorityViews: ['front'],
      },
      assets: {
        canonicalImages: {},
        videoReferences: [],
      },
    };
    
    // Create artifact
    const createResponse = await fetchWithTimeout(
      `${TEST_CONFIG.dashboardUrl}/api/film-bridge/artifacts`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testArtifact),
      },
      TEST_CONFIG.timeouts.apiRequest
    );
    
    if (!createResponse.ok) {
      throw new Error(`Create failed: HTTP ${createResponse.status}`);
    }
    
    const created = await createResponse.json();
    log(`Created artifact: ${created.id}`, 'success');
    
    // List artifacts
    const listResponse = await fetchWithTimeout(
      `${TEST_CONFIG.dashboardUrl}/api/film-bridge/artifacts`,
      {},
      TEST_CONFIG.timeouts.apiRequest
    );
    
    if (!listResponse.ok) {
      throw new Error(`List failed: HTTP ${listResponse.status}`);
    }
    
    const artifacts = await listResponse.json();
    log(`Found ${artifacts.length} artifacts`, 'success');
    
    return {
      name,
      passed: true,
      duration: Date.now() - start,
      data: { createdId: created.id, count: artifacts.length },
    };
  } catch (error) {
    return {
      name,
      passed: false,
      duration: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Test 4: ComfyUI Workflow Execution
async function testWorkflowExecution(): Promise<TestResult> {
  const start = Date.now();
  const name = 'Workflow Execution';
  
  try {
    log('Testing workflow execution...');
    
    // Simple test workflow (just load checkpoint and save)
    const workflow = {
      "1": {
        "class_type": "CheckpointLoaderSimple",
        "inputs": { "ckpt_name": "v1-5-pruned-emaonly-fp16.safetensors" }
      },
      "2": {
        "class_type": "SaveImage",
        "inputs": {
          "images": [["1", 0]],
          "filename_prefix": "e2e_test"
        }
      }
    };
    
    // Queue workflow
    const queueResponse = await fetchWithTimeout(
      `${TEST_CONFIG.comfyUrl}/api/prompt`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: workflow, client_id: 'e2e-test' }),
      },
      TEST_CONFIG.timeouts.apiRequest
    );
    
    if (!queueResponse.ok) {
      throw new Error(`Queue failed: HTTP ${queueResponse.status}`);
    }
    
    const queued = await queueResponse.json();
    log(`Queued workflow: ${queued.prompt_id}`, 'success');
    
    // Wait for completion (poll for 30 seconds)
    let completed = false;
    const maxAttempts = 30;
    
    for (let i = 0; i < maxAttempts; i++) {
      await sleep(1000);
      
      try {
        const historyResponse = await fetchWithTimeout(
          `${TEST_CONFIG.comfyUrl}/api/history/${queued.prompt_id}`,
          {},
          5000
        );
        
        if (historyResponse.ok) {
          const history = await historyResponse.json();
          if (history[queued.prompt_id]) {
            completed = true;
            log('Workflow completed!', 'success');
            break;
          }
        }
      } catch {
        // Continue polling
      }
      
      process.stdout.write(`\rWaiting for completion... (${i + 1}/${maxAttempts})`);
    }
    
    console.log(); // New line after progress
    
    if (!completed) {
      throw new Error('Workflow timeout');
    }
    
    return {
      name,
      passed: true,
      duration: Date.now() - start,
      data: { promptId: queued.prompt_id },
    };
  } catch (error) {
    return {
      name,
      passed: false,
      duration: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Test 5: VRAM Monitoring
async function testVRAMMonitoring(): Promise<TestResult> {
  const start = Date.now();
  const name = 'VRAM Monitoring';
  
  try {
    log('Testing VRAM monitoring...');
    
    // Make multiple calls to check VRAM changes
    const readings: number[] = [];
    
    for (let i = 0; i < 3; i++) {
      const response = await fetchWithTimeout(
        `${TEST_CONFIG.comfyUrl}/system_stats`,
        {},
        5000
      );
      
      if (response.ok) {
        const data = await response.json();
        readings.push(data.vram_used);
      }
      
      await sleep(1000);
    }
    
    log(`VRAM readings: ${readings.map(r => `${(r/1024).toFixed(1)}GB`).join(', ')}`, 'success');
    
    return {
      name,
      passed: true,
      duration: Date.now() - start,
      data: { readings },
    };
  } catch (error) {
    return {
      name,
      passed: false,
      duration: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Main test runner
async function runTests(): Promise<void> {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║           Film Bridge E2E Test Suite                         ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  // Check if services are running
  log('Checking service availability...');
  
  // Run tests
  results.push(await testComfyHealth());
  results.push(await testDashboardHealth());
  results.push(await testArtifactRegistry());
  results.push(await testVRAMMonitoring());
  // Skip workflow test for now as it requires more setup
  // results.push(await testWorkflowExecution());
  
  // Print results
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                      Test Results                            ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  
  let passed = 0;
  let failed = 0;
  
  for (const result of results) {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    const color = result.passed ? '\x1b[32m' : '\x1b[31m';
    const reset = '\x1b[0m';
    
    console.log(`║ ${color}${status}${reset} ${result.name.padEnd(40)} ${result.duration.toString().padStart(5)}ms ║`);
    
    if (result.passed) {
      passed++;
    } else {
      failed++;
      console.log(`║   Error: ${result.error?.substring(0, 50).padEnd(50)} ║`);
    }
  }
  
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║ Total: ${passed} passed, ${failed} failed${''.padEnd(43)} ║`);
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  // Summary
  if (failed === 0) {
    log('All tests passed! 🎉', 'success');
    process.exit(0);
  } else {
    log(`${failed} test(s) failed. Check logs above.`, 'error');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});
