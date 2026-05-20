'use strict';
const db = require('../db');

/**
 * Registra una acción de auditoría en la base de datos
 * @param {string} username - Usuario que realiza la acción
 * @param {string} action - Tipo de acción (CREATE, UPDATE, DELETE, etc.)
 * @param {string} entityType - Tipo de entidad (project, contractor, report, etc.)
 * @param {number} entityId - ID de la entidad (opcional)
 * @param {string} entityName - Nombre de la entidad (opcional)
 * @param {object} details - Detalles adicionales (opcional)
 */
async function logAudit(username, action, entityType, entityId = null, entityName = null, details = null) {
  try {
    await db.query(`
      INSERT INTO audit_logs (username, action, entity_type, entity_id, entity_name, details)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [username, action, entityType, entityId, entityName, details ? JSON.stringify(details) : null]);
  } catch (err) {
    console.error('Error logging audit:', err);
    // No lanzamos error para no interrumpir la operación principal
  }
}

/**
 * Middleware para agregar la función logAudit al request
 */
function auditMiddleware(req, res, next) {
  req.logAudit = (action, entityType, entityId = null, entityName = null, details = null) => {
    const username = req.session.username || 'sistema';
    return logAudit(username, action, entityType, entityId, entityName, details);
  };
  next();
}

module.exports = { logAudit, auditMiddleware };
