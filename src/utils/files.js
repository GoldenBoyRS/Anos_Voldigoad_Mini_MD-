// src/utils/files.js — E/S fichier atomiques & sécurisées (source de vérité = disque)
'use strict';

const fs = require('fs-extra');
const path = require('path');

/**
 * Écrit un fichier de façon atomique : écrit dans un .tmp puis rename().
 */
async function atomicWriteFile(filePath, data) {
    await fs.ensureDir(path.dirname(filePath));
    const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmpPath, data);
    await fs.rename(tmpPath, filePath);
}

async function atomicWriteJSON(filePath, obj) {
    await atomicWriteFile(filePath, JSON.stringify(obj, null, 2));
}

async function readJSON(filePath, fallback = null) {
    try {
        if (!(await fs.pathExists(filePath))) return fallback;
        const raw = await fs.readFile(filePath, 'utf8');
        if (!raw.trim()) return fallback;
        return JSON.parse(raw);
    } catch (err) {
        console.error(`[files] JSON invalide dans ${filePath}: ${err.message}`);
        return fallback;
    }
}

async function ensureDir(dirPath) {
    await fs.ensureDir(dirPath);
    return dirPath;
}

async function removeDir(dirPath) {
    await fs.remove(dirPath);
}

async function pathExists(p) {
    return fs.pathExists(p);
}

async function appendLine(filePath, line) {
    await fs.ensureDir(path.dirname(filePath));
    await fs.appendFile(filePath, line.endsWith('\n') ? line : line + '\n');
}

/** Lit les N dernières lignes d'un fichier texte sans charger tout le fichier */
async function tailLines(filePath, lines = 100) {
    if (!(await fs.pathExists(filePath))) return [];
    const raw = await fs.readFile(filePath, 'utf8');
    const all = raw.split('\n').filter(Boolean);
    return all.slice(-lines);
}

function assertSafeSubdirectory(rootDir, targetDir) {
    const resolvedRoot = path.resolve(rootDir);
    const resolvedTarget = path.resolve(targetDir);
    if (!resolvedTarget.startsWith(resolvedRoot) || resolvedTarget === resolvedRoot) {
        throw new Error(`Accès interdit en dehors du répertoire autorisé: ${resolvedTarget}`);
    }
    return resolvedTarget;
}

async function safeRemoveDir(rootDir, targetDir) {
    const verifiedPath = assertSafeSubdirectory(rootDir, targetDir);
    await fs.remove(verifiedPath);
    return verifiedPath;
}

module.exports = {
    atomicWriteFile,
    atomicWriteJSON,
    readJSON,
    ensureDir,
    removeDir,
    pathExists,
    appendLine,
    tailLines,
    assertSafeSubdirectory,
    safeRemoveDir,
};
