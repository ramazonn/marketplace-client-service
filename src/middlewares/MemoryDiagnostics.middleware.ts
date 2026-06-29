import { LogTypeEnum } from '@ubaytools/core';
import { Context, Next } from 'koa';

interface MemorySnapshot {
  rssMb: number;
  heapTotalMb: number;
  heapUsedMb: number;
  externalMb: number;
  arrayBuffersMb: number;
}

const BYTES_IN_MB = 1024 * 1024;

const ENABLED = process.env.MEMORY_DIAGNOSTICS_ENABLED !== 'false';
const SAMPLE_RATE = parseNumber(process.env.MEMORY_DIAGNOSTICS_SAMPLE_RATE, 0);
const SLOW_REQUEST_MS = parseNumber(process.env.MEMORY_DIAGNOSTICS_SLOW_REQUEST_MS, 1000);
const HEAP_DELTA_MB = parseNumber(process.env.MEMORY_DIAGNOSTICS_HEAP_DELTA_MB, 10);
const RSS_DELTA_MB = parseNumber(process.env.MEMORY_DIAGNOSTICS_RSS_DELTA_MB, 20);

export async function MemoryDiagnosticsMiddleware(context: Context, next: Next): Promise<void> {
  if (!ENABLED) {
    await next();
    return;
  }

  const startTime = Date.now();
  const startMemory = getMemorySnapshot();
  let caughtError: any;

  try {
    await next();
  } catch (error) {
    caughtError = error;
    throw error;
  } finally {
    const endMemory = getMemorySnapshot();
    const durationMs = Date.now() - startTime;
    const delta = {
      rssMb: roundMb(endMemory.rssMb - startMemory.rssMb),
      heapUsedMb: roundMb(endMemory.heapUsedMb - startMemory.heapUsedMb),
      externalMb: roundMb(endMemory.externalMb - startMemory.externalMb),
      arrayBuffersMb: roundMb(endMemory.arrayBuffersMb - startMemory.arrayBuffersMb),
    };
    const shouldLog =
      shouldSample() ||
      durationMs >= SLOW_REQUEST_MS ||
      delta.heapUsedMb >= HEAP_DELTA_MB ||
      delta.rssMb >= RSS_DELTA_MB ||
      Boolean(caughtError);

    if (!shouldLog) return;

    console.warn(
      JSON.stringify({
        source: 'MemoryDiagnosticsMiddleware',
        logType: LogTypeEnum.APP_LOG,
        appLevel: process.env.SERVICE_NAME,
        type: 'endpoint_memory_diagnostics',
        timestamp: new Date().toISOString(),
        refId: context.refId,
        method: context.method,
        path: context.path,
        status: caughtError ? context.status || 500 : context.status,
        durationMs,
        user: context.client?.getId()?.toString(),
        memory: endMemory,
        delta,
        trigger: {
          sampled: SAMPLE_RATE > 0,
          slowRequest: durationMs >= SLOW_REQUEST_MS,
          heapGrowth: delta.heapUsedMb >= HEAP_DELTA_MB,
          rssGrowth: delta.rssMb >= RSS_DELTA_MB,
          error: Boolean(caughtError),
        },
        error: caughtError ? { message: caughtError?.message, code: caughtError?.code } : null,
      }),
    );
  }
}

function getMemorySnapshot(): MemorySnapshot {
  const memory = process.memoryUsage();

  return {
    //memory.rss is a method that returns an integer representing the Resident Set Size (RSS) in bytes
    rssMb: roundMb(memory.rss / BYTES_IN_MB),
    heapTotalMb: roundMb(memory.heapTotal / BYTES_IN_MB),
    heapUsedMb: roundMb(memory.heapUsed / BYTES_IN_MB),
    externalMb: roundMb(memory.external / BYTES_IN_MB),
    arrayBuffersMb: roundMb(memory.arrayBuffers / BYTES_IN_MB),
  };
}

function shouldSample(): boolean {
  return SAMPLE_RATE > 0 && Math.random() < SAMPLE_RATE;
}

function parseNumber(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundMb(value: number): number {
  return Math.round(value * 100) / 100;
}
