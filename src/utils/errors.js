// src/utils/errors.js — erreurs typées pour un traitement propre par l'API
'use strict';

class AppError extends Error {
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}

class NotFoundError extends AppError {
    constructor(message = 'Ressource introuvable') {
        super(message, 404, 'NOT_FOUND');
    }
}

class ValidationError extends AppError {
    constructor(message = 'Requête invalide') {
        super(message, 400, 'VALIDATION_ERROR');
    }
}

class ConflictError extends AppError {
    constructor(message = 'Conflit — action déjà en cours') {
        super(message, 409, 'CONFLICT');
    }
}

class UnauthorizedError extends AppError {
    constructor(message = 'Non autorisé') {
        super(message, 401, 'UNAUTHORIZED');
    }
}

class RateLimitError extends AppError {
    constructor(message = 'Trop de requêtes, réessaie plus tard') {
        super(message, 429, 'RATE_LIMITED');
    }
}

class DisconnectionPermanentError extends AppError {
    constructor(message = 'Déconnexion définitive (credentials invalidés)', statusCode = 401) {
        super(message, statusCode, 'DISCONNECTION_PERMANENT');
    }
}

class DisconnectionTemporaryError extends AppError {
    constructor(message = 'Déconnexion temporaire (reconnexion autorisée)', statusCode = 503) {
        super(message, statusCode, 'DISCONNECTION_TEMPORARY');
    }
}

module.exports = {
    AppError,
    NotFoundError,
    ValidationError,
    ConflictError,
    UnauthorizedError,
    RateLimitError,
    DisconnectionPermanentError,
    DisconnectionTemporaryError,
};
