#!/usr/bin/env tsx
/**
 * Film Bridge Manager
 * One-command startup for the entire production pipeline
 * 
 * Usage:
 *   pnpm film-bridge:start    - Start everything (ComfyUI + Dashboard)
 *   pnpm film-bridge:stop     - Stop everything
 *   pnpm film-bridge:status   - Check status
 */

import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const COMFY_DIR = 'C:/Users/alexw/Downloads/USE_THIS_COMFY/ComfyUI_windows_portable';
const DASHBOARD_PORT = 3007;
const COMFY_PORT = 8188;

interface ServiceStatus {
  name: string;
  running: boolean;
  pid?: number;
  port: number;
  url: string;
}

// ═══════════════════════════════════════════════════════════════
// SERVICE MANAGEMENT
// ═══════════════════════════════════════════════════════════════

async function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const { exec } = require('child_process');
    exec(`netstat -ano | findstr :${port}`, (err: any, stdout: string) => {
      resolve(!!stdout && stdout.includes(`:${port}`));
    });
  });
}

async function getStatus(): Promise<ServiceStatus[]> {
  const [comfyRunning, dashboardRunning] = await Promise.all([
    checkPort(COMFY_PORT),
    checkPort(DASHBOARD_PORT),
  ]);

  return [
    {
      name: 'ComfyUI',
      running: comfyRunning,
      port: COMFY_PORT,
      url: `http://127.0.0.1:${COMFY_PORT}`,
    },
    {
      name: 'Film Bridge Dashboard',
      running: dashboardRunning,
      port: DASHBOARD_PORT,
      url: `http://127.0.0.1:${DASHBOARD_PORT}/film-bridge`,
    },
  ];
}

async function printStatus(): Promise<void> {
  const services = await getStatus();
  
  console.log('\n┌─────────────────────────────────────────────────────┐');
  console.log('│              Film Bridge Status                     │');
  console.log('├─────────────────────────────────────────────────────┤');
  
  for (const service of services) {
    const status = service.running ? '✅ RUNNING' : '❌ STOPPED';
    const color = service.running ? '\x1b[32m' : '\x1b[31m';
    const reset = '\x1b[0m';
    
    console.log(`│ ${color}${status}${reset} ${service.name.padEnd(20)} │`);
    console.log(`│    Port: ${service.port.toString().padEnd(4)}  URL: ${service.url.padEnd(32)} │`);
    console.log('├─────────────────────────────────────────────────────┤');
  }
  
  console.log('└─────────────────────────────────────────────────────┘\n');
}

// ═══════════════════════════════════════════════════════════════
// START SERVICES
// ═══════════════════════════════════════════════════════════════

async function startComfyUI(): Promise<ChildProcess> {
  console.log('🚀 Starting ComfyUI...');
  
  const pythonPath = path.join(COMFY_DIR, 'python_embeded/python.exe');
  const mainPy = path.join(COMFY_DIR, 'ComfyUI/main.py');
  
  const proc = spawn(pythonPath, [mainPy, '--port', COMFY_PORT.toString()], {
    cwd: COMFY_DIR,
    detached: false,
    windowsHide: false,  // Show console for visibility
  });

  // Wait for healthy
  let attempts = 0;
  const maxAttempts = 180;
  
  while (attempts < maxAttempts) {
    await new Promise(r => setTimeout(r, 1000));
    
    try {
      const response = await fetch(`http://127.0.0.1:${COMFY_PORT}/system_stats`);
      if (response.ok) {
        console.log('✅ ComfyUI is ready!\n');
        return proc;
      }
    } catch {
      // Not ready yet
    }
    
    process.stdout.write(`⏳ Waiting for ComfyUI... (${attempts + 1}/${maxAttempts})\r`);
    attempts++;
  }
  
  throw new Error('ComfyUI failed to start within 60 seconds');
}

async function startDashboard(): Promise<ChildProcess> {
  console.log('🚀 Starting Film Bridge Dashboard...');
  
  const proc = spawn('pnpm', ['dev:film-bridge'], {
    cwd: process.cwd(),
    detached: false,
    windowsHide: false,
    shell: true,
  });

  // Wait for server
  let attempts = 0;
  const maxAttempts = 30;
  
  while (attempts < maxAttempts) {
    await new Promise(r => setTimeout(r, 1000));
    
    try {
      const response = await fetch(`http://127.0.0.1:${DASHBOARD_PORT}`);
      if (response.ok) {
        console.log('✅ Dashboard is ready!\n');
        console.log(`🌐 Open: http://127.0.0.1:${DASHBOARD_PORT}/film-bridge\n`);
        return proc;
      }
    } catch {
      // Not ready yet
    }
    
    process.stdout.write(`⏳ Waiting for dashboard... (${attempts + 1}/${maxAttempts})\r`);
    attempts++;
  }
  
  throw new Error('Dashboard failed to start within 30 seconds');
}

async function startAll(): Promise<void> {
  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log('║         Film Bridge Production Pipeline               ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  const status = await getStatus();
  
  // Check if already running
  const comfyRunning = status.find(s => s.name === 'ComfyUI')?.running;
  const dashboardRunning = status.find(s => s.name === 'Film Bridge Dashboard')?.running;
  
  const processes: ChildProcess[] = [];
  
  try {
    // Start ComfyUI first (if not running)
    if (!comfyRunning) {
      const comfyProc = await startComfyUI();
      processes.push(comfyProc);
    } else {
      console.log('✅ ComfyUI already running\n');
    }
    
    // Start Dashboard
    if (!dashboardRunning) {
      const dashProc = await startDashboard();
      processes.push(dashProc);
    } else {
      console.log('✅ Dashboard already running');
      console.log(`🌐 http://127.0.0.1:${DASHBOARD_PORT}/film-bridge\n`);
    }
    
    // Print final status
    await printStatus();
    
    console.log('Press Ctrl+C to stop all services\n');
    
    // Handle shutdown
    process.on('SIGINT', () => {
      console.log('\n\n🛑 Shutting down...');
      for (const proc of processes) {
        proc.kill();
      }
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      console.log('\n\n🛑 Shutting down...');
      for (const proc of processes) {
        proc.kill();
      }
      process.exit(0);
    });
    
    // Keep running
    await new Promise(() => {});
    
  } catch (error) {
    console.error('\n❌ Startup failed:', error);
    
    // Cleanup
    for (const proc of processes) {
      proc.kill();
    }
    
    process.exit(1);
  }
}

// ═══════════════════════════════════════════════════════════════
// STOP SERVICES
// ═══════════════════════════════════════════════════════════════

async function stopAll(): Promise<void> {
  console.log('\n🛑 Stopping Film Bridge services...\n');
  
  const { exec } = require('child_process');
  const util = require('util');
  const execAsync = util.promisify(exec);
  
  // Find and kill processes by port
  try {
    // Kill ComfyUI (port 8188)
    const { stdout: comfyPids } = await execAsync(
      `netstat -ano | findstr :${COMFY_PORT} | findstr LISTENING`
    ).catch(() => ({ stdout: '' }));
    
    if (comfyPids) {
      const pid = comfyPids.trim().split(/\s+/).pop();
      if (pid) {
        await execAsync(`taskkill /PID ${pid} /F`);
        console.log('✅ ComfyUI stopped');
      }
    }
    
    // Kill Dashboard (port 3007)
    const { stdout: dashPids } = await execAsync(
      `netstat -ano | findstr :${DASHBOARD_PORT} | findstr LISTENING`
    ).catch(() => ({ stdout: '' }));
    
    if (dashPids) {
      const pid = dashPids.trim().split(/\s+/).pop();
      if (pid) {
        await execAsync(`taskkill /PID ${pid} /F`);
        console.log('✅ Dashboard stopped');
      }
    }
    
    console.log('\n✨ All services stopped\n');
  } catch (error) {
    console.error('Error stopping services:', error);
  }
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

const command = process.argv[2];

switch (command) {
  case 'start':
    startAll();
    break;
  case 'stop':
    stopAll();
    break;
  case 'status':
    printStatus();
    break;
  case 'restart':
    stopAll().then(() => {
      setTimeout(startAll, 2000);
    });
    break;
  default:
    console.log(`
Film Bridge Manager

Usage:
  pnpm film-bridge:start    Start ComfyUI + Dashboard
  pnpm film-bridge:stop     Stop all services
  pnpm film-bridge:status   Check service status
  pnpm film-bridge:restart  Restart all services

Dashboard: http://127.0.0.1:3007/film-bridge
ComfyUI:   http://127.0.0.1:8188
`);
    printStatus();
}
