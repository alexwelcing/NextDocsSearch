#!/usr/bin/env bun
/**
 * Film Bridge Manager (Bun Edition)
 * Optimized for Bun runtime with faster startup and better Windows support
 * 
 * Usage:
 *   bun run film-bridge:start    - Start everything
 *   bun run film-bridge:stop     - Stop everything
 *   bun run film-bridge:status   - Check status
 */

import { spawn, type Subprocess } from 'bun';
import { join } from 'path';

const COMFY_DIR = 'C:/Users/alexw/Downloads/USE_THIS_COMFY/ComfyUI_windows_portable';
const DASHBOARD_PORT = 3007;
const COMFY_PORT = 8188;

interface ServiceStatus {
  name: string;
  running: boolean;
  port: number;
  url: string;
  pid?: number;
}

// ANSI colors for Windows
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

function log(message: string, type: 'info' | 'success' | 'error' | 'warn' = 'info'): void {
  const colorMap = {
    info: colors.cyan,
    success: colors.green,
    error: colors.red,
    warn: colors.yellow,
  };
  console.log(`${colorMap[type]}[${type.toUpperCase()}]${colors.reset} ${message}`);
}

// Check if port is in use
async function checkPort(port: number): Promise<boolean> {
  try {
    const proc = spawn({
      cmd: ['cmd', '/c', `netstat -ano | findstr :${port}`],
      stdout: 'pipe',
      stderr: 'pipe',
    });
    
    const output = await new Response(proc.stdout).text();
    return output.includes(`:${port}`);
  } catch {
    return false;
  }
}

// Get process ID using port
async function getPidOnPort(port: number): Promise<number | null> {
  try {
    const proc = spawn({
      cmd: ['cmd', '/c', `netstat -ano | findstr :${port} | findstr LISTENING`],
      stdout: 'pipe',
      stderr: 'pipe',
    });
    
    const output = await new Response(proc.stdout).text();
    const lines = output.trim().split('\n');
    
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 5) {
        return parseInt(parts[parts.length - 1], 10);
      }
    }
    return null;
  } catch {
    return null;
  }
}

// Get service status
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
      pid: comfyRunning ? await getPidOnPort(COMFY_PORT) || undefined : undefined,
    },
    {
      name: 'Film Bridge Dashboard',
      running: dashboardRunning,
      port: DASHBOARD_PORT,
      url: `http://127.0.0.1:${DASHBOARD_PORT}/film-bridge`,
      pid: dashboardRunning ? await getPidOnPort(DASHBOARD_PORT) || undefined : undefined,
    },
  ];
}

// Print status
async function printStatus(): Promise<void> {
  const services = await getStatus();
  
  console.log(`\n${colors.bold}╔═════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bold}║              Film Bridge Status                     ║${colors.reset}`);
  console.log(`${colors.bold}╠═════════════════════════════════════════════════════╣${colors.reset}`);
  
  for (const service of services) {
    const status = service.running 
      ? `${colors.green}● RUNNING${colors.reset}` 
      : `${colors.red}● STOPPED${colors.reset}`;
    
    console.log(`║ ${status} ${service.name.padEnd(30)} ║`);
    console.log(`║    Port: ${service.port.toString().padEnd(4)}  URL: ${service.url.padEnd(32)} ║`);
    if (service.pid) {
      console.log(`║    PID:  ${service.pid.toString().padEnd(43)} ║`);
    }
    console.log('╠═════════════════════════════════════════════════════╣');
  }
  
  console.log(`${colors.bold}╚═════════════════════════════════════════════════════╝${colors.reset}\n`);
}

// Start ComfyUI
async function startComfyUI(): Promise<Subprocess> {
  log('Starting ComfyUI with Bun...', 'info');
  
  const pythonPath = join(COMFY_DIR, 'python_embeded/python.exe');
  const mainPy = join(COMFY_DIR, 'ComfyUI/main.py');
  
  const proc = spawn({
    cmd: [pythonPath, mainPy, '--port', COMFY_PORT.toString(), '--listen', '127.0.0.1'],
    cwd: COMFY_DIR,
    stdout: 'inherit',
    stderr: 'inherit',
  });

  // Wait for healthy
  let attempts = 0;
  const maxAttempts = 60;
  
  while (attempts < maxAttempts) {
    await Bun.sleep(1000);
    
    try {
      const response = await fetch(`http://127.0.0.1:${COMFY_PORT}/system_stats`);
      if (response.ok) {
        log('ComfyUI is ready!', 'success');
        return proc;
      }
    } catch {
      // Not ready yet
    }
    
    process.stdout.write(`\r⏳ Waiting for ComfyUI... (${attempts + 1}/${maxAttempts})`);
    attempts++;
  }
  
  throw new Error('ComfyUI failed to start within 60 seconds');
}

// Start Dashboard with Bun
async function startDashboard(): Promise<Subprocess> {
  log('Starting Film Bridge Dashboard with Bun...', 'info');
  
  const proc = spawn({
    cmd: ['bun', 'run', 'next', 'dev', '-p', DASHBOARD_PORT.toString()],
    cwd: process.cwd(),
    stdout: 'inherit',
    stderr: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'development',
      NEXT_TELEMETRY_DISABLED: '1',
    },
  });

  // Wait for server
  let attempts = 0;
  const maxAttempts = 30;
  
  while (attempts < maxAttempts) {
    await Bun.sleep(1000);
    
    try {
      const response = await fetch(`http://127.0.0.1:${DASHBOARD_PORT}`);
      if (response.ok) {
        log('Dashboard is ready!', 'success');
        log(`Open: http://127.0.0.1:${DASHBOARD_PORT}/film-bridge`, 'info');
        return proc;
      }
    } catch {
      // Not ready yet
    }
    
    process.stdout.write(`\r⏳ Waiting for dashboard... (${attempts + 1}/${maxAttempts})`);
    attempts++;
  }
  
  throw new Error('Dashboard failed to start within 30 seconds');
}

// Start all services
async function startAll(): Promise<void> {
  console.log(`\n${colors.bold}${colors.cyan}`);
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║         Film Bridge Production Pipeline (Bun)         ║');
  console.log('╚═══════════════════════════════════════════════════════╝');
  console.log(`${colors.reset}\n`);

  const status = await getStatus();
  
  const comfyRunning = status.find(s => s.name === 'ComfyUI')?.running;
  const dashboardRunning = status.find(s => s.name === 'Film Bridge Dashboard')?.running;
  
  const processes: Subprocess[] = [];
  
  try {
    // Start ComfyUI first
    if (!comfyRunning) {
      const comfyProc = await startComfyUI();
      processes.push(comfyProc);
    } else {
      log('ComfyUI already running', 'success');
    }
    
    // Start Dashboard
    if (!dashboardRunning) {
      const dashProc = await startDashboard();
      processes.push(dashProc);
    } else {
      log('Dashboard already running', 'success');
      log(`http://127.0.0.1:${DASHBOARD_PORT}/film-bridge`, 'info');
    }
    
    await printStatus();
    
    console.log(`${colors.yellow}Press Ctrl+C to stop all services${colors.reset}\n`);
    
    // Handle shutdown
    process.on('SIGINT', () => {
      console.log(`\n\n${colors.yellow}🛑 Shutting down...${colors.reset}`);
      for (const proc of processes) {
        proc.kill();
      }
      process.exit(0);
    });
    
    // Keep running
    await new Promise(() => {});
    
  } catch (error) {
    console.error(`\n${colors.red}❌ Startup failed:${colors.reset}`, error);
    
    for (const proc of processes) {
      proc.kill();
    }
    
    process.exit(1);
  }
}

// Stop all services
async function stopAll(): Promise<void> {
  log('Stopping Film Bridge services...', 'info');
  
  // Kill processes by port
  const comfyPid = await getPidOnPort(COMFY_PORT);
  const dashPid = await getPidOnPort(DASHBOARD_PORT);
  
  if (comfyPid) {
    try {
      spawn({ cmd: ['taskkill', '/PID', comfyPid.toString(), '/F'] });
      log('ComfyUI stopped', 'success');
    } catch {
      log('Failed to stop ComfyUI gracefully', 'warn');
    }
  }
  
  if (dashPid) {
    try {
      spawn({ cmd: ['taskkill', '/PID', dashPid.toString(), '/F'] });
      log('Dashboard stopped', 'success');
    } catch {
      log('Failed to stop Dashboard gracefully', 'warn');
    }
  }
  
  // Also kill any Node processes on these ports as fallback
  spawn({ cmd: ['cmd', '/c', `for /f "tokens=5" %a in ('netstat -ano ^| findstr :${COMFY_PORT}') do taskkill /PID %a /F 2>nul`] });
  spawn({ cmd: ['cmd', '/c', `for /f "tokens=5" %a in ('netstat -ano ^| findstr :${DASHBOARD_PORT}') do taskkill /PID %a /F 2>nul`] });
  
  await Bun.sleep(1000);
  log('All services stopped', 'success');
}

// Restart services
async function restart(): Promise<void> {
  await stopAll();
  await Bun.sleep(2000);
  await startAll();
}

// Main
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
    restart();
    break;
  default:
    console.log(`
${colors.bold}Film Bridge Manager (Bun Edition)${colors.reset}

Usage:
  bun run film-bridge:start    Start ComfyUI + Dashboard
  bun run film-bridge:stop     Stop all services
  bun run film-bridge:status   Check service status
  bun run film-bridge:restart  Restart all services

Dashboard: http://127.0.0.1:3007/film-bridge
ComfyUI:   http://127.0.0.1:8188

${colors.cyan}Bun version:${colors.reset} ${Bun.version}
`);
    printStatus();
}
