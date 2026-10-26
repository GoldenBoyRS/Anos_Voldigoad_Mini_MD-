// src/core/logger.js — buffer global partagé, un seul timer de flush
'use strict';

const fs = require('fs-extra');
const path = require('path');
const pino = require('pino');

const isProd = process.env.NODE_ENV === 'production';
const FLUSH_INTERVAL = Number(process.env.LOG_FLUSH_INTERVAL_MS || 1000);

const buffers = new Map();
let flushTimer = null;
let rootLoggerInstance = null;

function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(async () => {
        flushTimer = null;
        const pending = [];
        for (const [key, entry] of buffers) {
            if (!entry.lines.length) continue;
            const lines = entry.lines.splice(0, entry.lines.length).join('');
            pending.push(fs.ensureDir(entry.dir).then(() => fs.appendFile(entry.file(), lines)));
        }
        await Promise.allSettled(pending);
        if (buffers.size) scheduleFlush();
    }, FLUSH_INTERVAL);
    flushTimer.unref?.();
}

function todayLogPath(dir) {
    return path.join(dir, `${new Date().toISOString().slice(0, 10)}.log`);
}

function createSessionLogger(sessionId, sessionDir) {
    const dir = path.join(sessionDir, 'logs');
    const key = path.resolve(sessionDir) + ':' + sessionId;

    if (!buffers.has(key)) {
        buffers.set(key, { dir, lines: [] });
    }
    const entry = buffers.get(key);
    entry.file = () => todayLogPath(dir);

    const rank = { silent: 0, error: 1, warn: 2, info: 3, debug: 4 };
    const threshold = rank[process.env.LOG_LEVEL || 'info'] ?? rank.info;

    function write(name, obj, msg) {
        if (rank[name] > threshold) return;
        const meta = typeof obj === 'object' && obj !== null ? obj : {};
        const text = typeof obj === 'string' ? obj : (msg || '');
        const line = JSON.stringify({
            sessionId,
            event: text,
            level: name,
            ts: new Date().toISOString(),
            ...meta,
        }) + '\n';
        entry.lines.push(line);
        if (entry.lines.length > 2000) entry.lines.splice(0, entry.lines.length - 2000);
        scheduleFlush();
        if (!isProd && name !== 'debug') {
            const fn = console[name] || console.log;
            fn(`[${sessionId}] ${text}`, typeof obj === 'object' ? obj : '');
        }
    }

    return {
        info: (obj, msg) => write('info', obj, msg),
        warn: (obj, msg) => write('warn', obj, msg),
        error: (obj, msg) => write('error', obj, msg),
        debug: (obj, msg) => write('debug', obj, msg),
        child() { return this; },
    };
}

function buildRootLogger() {
    if (rootLoggerInstance) return rootLoggerInstance;
    const level = process.env.LOG_LEVEL || (isProd ? 'info' : 'debug');
    if (isProd) {
        rootLoggerInstance = pino({ level });
    } else {
        try {
            require.resolve('pino-pretty');
            rootLoggerInstance = pino({
                level,
                transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } },
            });
        } catch (_) {
            rootLoggerInstance = pino({ level });
        }
    }
    return rootLoggerInstance;
}

async function cleanupSessionLogger(sessionId, sessionDir) {
    const key = path.resolve(sessionDir) + ':' + sessionId;
    const entry = buffers.get(key);
    if (entry) {
        if (entry.lines.length) {
            try {
                const lines = entry.lines.splice(0, entry.lines.length).join('');
                await fs.ensureDir(entry.dir);
                await fs.appendFile(entry.file(), lines);
            } catch (_) {}
        }
        buffers.delete(key);
    }
}

async function flushLogs() {
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
    const pending = [];
    for (const entry of buffers.values()) {
        if (!entry.lines.length) continue;
        const lines = entry.lines.splice(0, entry.lines.length).join('');
        pending.push(fs.ensureDir(entry.dir).then(() => fs.appendFile(entry.file(), lines)));
    }
    await Promise.allSettled(pending);
}

const rootLogger = buildRootLogger();

module.exports = { createSessionLogger, cleanupSessionLogger, buildRootLogger, rootLogger, flushLogs };
