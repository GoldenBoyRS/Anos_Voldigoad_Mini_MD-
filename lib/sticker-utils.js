const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { tmpdir } = require('os');
const Crypto = require('crypto');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');

ffmpeg.setFfmpegPath(ffmpegPath);

// Limiteur de concurrence des conversions pour préserver CPU et RAM (Section 8.3)
const MAX_CONCURRENT_MEDIA = Number(process.env.MEDIA_CONCURRENCY_LIMIT || 5);
let activeConversions = 0;
const waitingQueue = [];

function acquireMediaSlot() {
    if (activeConversions < MAX_CONCURRENT_MEDIA) {
        activeConversions++;
        return Promise.resolve();
    }
    return new Promise((resolve) => waitingQueue.push(resolve));
}

function releaseMediaSlot() {
    activeConversions--;
    if (waitingQueue.length > 0) {
        activeConversions++;
        const next = waitingQueue.shift();
        next();
    }
}

/**
 * Fetch an image from a given URL.
 * @param {string} url - The image URL.
 * @returns {Promise<Buffer>} - The image buffer.
 */
async function fetchImage(url) {
    try {
        const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
        return response.data;
    } catch (error) {
        console.error("Error fetching image:", error.message);
        throw new Error("Could not fetch image.");
    }
}

/**
 * Fetch a GIF from a given API URL.
 * @param {string} url - API endpoint to fetch GIF.
 * @returns {Promise<Buffer>} - The GIF buffer.
 */
async function fetchGif(url) {
    try {
        const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
        return response.data;
    } catch (error) {
        console.error("Error fetching GIF:", error.message);
        throw new Error("Could not fetch GIF.");
    }
}

/**
 * Converts a GIF buffer to WebP sticker format safely with cleanup and timeout.
 * @param {Buffer} gifBuffer - The GIF buffer.
 * @returns {Promise<Buffer>} - The WebP sticker buffer.
 */
async function gifToSticker(gifBuffer) {
    await acquireMediaSlot();

    const id = Crypto.randomBytes(6).toString('hex');
    const outputPath = path.join(tmpdir(), `anos_${id}.webp`);
    const inputPath = path.join(tmpdir(), `anos_${id}.gif`);

    try {
        await fs.promises.writeFile(inputPath, gifBuffer);

        await new Promise((resolve, reject) => {
            const timeoutTimer = setTimeout(() => {
                reject(new Error("FFmpeg conversion timed out after 30s"));
            }, 30000);

            ffmpeg(inputPath)
                .on("error", (err) => {
                    clearTimeout(timeoutTimer);
                    reject(err);
                })
                .on("end", () => {
                    clearTimeout(timeoutTimer);
                    resolve(true);
                })
                .addOutputOptions([
                    "-vcodec", "libwebp",
                    "-vf", "scale='min(320,iw)':min'(320,ih)':force_original_aspect_ratio=decrease,fps=15,pad=320:320:-1:-1:color=white@0.0,split [a][b];[a] palettegen=reserve_transparent=on:transparency_color=ffffff [p];[b][p] paletteuse",
                    "-loop", "0",
                    "-preset", "default",
                    "-an",
                    "-vsync", "0"
                ])
                .toFormat("webp")
                .save(outputPath);
        });

        const webpBuffer = await fs.promises.readFile(outputPath);
        return webpBuffer;
    } finally {
        // Nettoyage systématique garanti même en cas d'erreur
        await fs.promises.unlink(outputPath).catch(() => {});
        await fs.promises.unlink(inputPath).catch(() => {});
        releaseMediaSlot();
    }
}

module.exports = { fetchImage, fetchGif, gifToSticker };
