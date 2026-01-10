/**
 * Performance logging utility
 * Tracks FPS, frame times, and provides statistics
 */

interface PerformanceLog {
  timestamp: number;
  fps: number;
  frameTime: number;
  event?: string;
}

class PerformanceLogger {
  private logs: PerformanceLog[] = [];
  private maxLogs = 1000;
  private enabled = false;

  constructor() {
    if (typeof window !== 'undefined') {
      // @ts-ignore - Add to window for console access
      window.perfLogger = this;
    }
  }

  enable() {
    this.enabled = true;
    console.log('📊 Performance logging enabled. Use perfLogger methods:');
    console.log('  - perfLogger.getStats() - View statistics');
    console.log('  - perfLogger.getLogs() - View all logs');
    console.log('  - perfLogger.exportCSV() - Export as CSV');
    console.log('  - perfLogger.clear() - Clear logs');
    console.log('  - perfLogger.disable() - Disable logging');
  }

  disable() {
    this.enabled = false;
    console.log('📊 Performance logging disabled');
  }

  log(fps: number, frameTime: number, event?: string) {
    if (!this.enabled) return;

    this.logs.push({
      timestamp: Date.now(),
      fps,
      frameTime,
      event,
    });

    // Keep only last N logs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
  }

  async sendToEndpoint(url: string) {
    if (this.logs.length === 0) return;
    
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logs: this.logs }),
      });
      console.log('📊 Performance logs sent to', url);
    } catch (error) {
      console.error('Failed to send performance logs:', error);
    }
  }

  async flush(url: string) {
    await this.sendToEndpoint(url);
    this.clear();
  }

  getStats() {
    if (this.logs.length === 0) {
      console.log('No performance data collected yet');
      return null;
    }

    const fps = this.logs.map(l => l.fps);
    const frameTimes = this.logs.map(l => l.frameTime);

    const stats = {
      totalSamples: this.logs.length,
      fps: {
        min: Math.min(...fps),
        max: Math.max(...fps),
        avg: Math.round(fps.reduce((a, b) => a + b, 0) / fps.length),
        p50: this.percentile(fps, 50),
        p95: this.percentile(fps, 95),
        p99: this.percentile(fps, 99),
      },
      frameTime: {
        min: Math.round(Math.min(...frameTimes) * 10) / 10,
        max: Math.round(Math.max(...frameTimes) * 10) / 10,
        avg: Math.round((frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length) * 10) / 10,
        p50: Math.round(this.percentile(frameTimes, 50) * 10) / 10,
        p95: Math.round(this.percentile(frameTimes, 95) * 10) / 10,
        p99: Math.round(this.percentile(frameTimes, 99) * 10) / 10,
      },
      duration: Math.round((this.logs[this.logs.length - 1].timestamp - this.logs[0].timestamp) / 1000),
    };

    console.table(stats);
    return stats;
  }

  private percentile(arr: number[], p: number): number {
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[index];
  }

  getLogs() {
    return this.logs;
  }

  exportCSV() {
    const csv = [
      'timestamp,fps,frameTime,event',
      ...this.logs.map(log =>
        `${log.timestamp},${log.fps},${log.frameTime},${log.event || ''}`
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-log-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    console.log('📥 Performance log exported as CSV');
  }

  clear() {
    this.logs = [];
    console.log('🗑️ Performance logs cleared');
  }

  markEvent(eventName: string) {
    if (!this.enabled) return;

    console.log(`📍 Performance marker: ${eventName}`);

    // Add marker to most recent log
    if (this.logs.length > 0) {
      this.logs[this.logs.length - 1].event = eventName;
    }
  }
}

export const perfLogger = new PerformanceLogger();

// Auto-enable in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.log('📊 Performance logger available. Type perfLogger.enable() to start tracking');
}
