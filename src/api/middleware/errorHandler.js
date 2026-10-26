// src/api/middleware/errorHandler.js — traduit les erreurs typées en réponses JSON propres
'use strict';

const { AppError } = require('../../utils/errors');

function errorHandler(logger) {
    return (err, req, res, next) => { // eslint-disable-line no-unused-vars
        if (err instanceof AppError) {
            return res.status(err.statusCode).json({ error: err.message, code: err.code });
        }
        logger.error(`Unhandled API error on ${req.method} ${req.path}: ${err.stack || err.message}`);
        return res.status(500).json({ error: 'Internal Server Error', message: err.message });
    };
}

module.exports = { errorHandler };
