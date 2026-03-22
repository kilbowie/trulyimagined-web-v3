"use strict";
/**
 * Shared Utility Functions for Truly Imagined v3
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateId = generateId;
exports.successResponse = successResponse;
exports.errorResponse = errorResponse;
exports.now = now;
exports.formatDate = formatDate;
exports.isValidEmail = isValidEmail;
exports.isValidUUID = isValidUUID;
exports.sanitizeString = sanitizeString;
exports.truncate = truncate;
const uuid_1 = require("uuid");
// ==================== ID GENERATION ====================
function generateId() {
    return (0, uuid_1.v4)();
}
// ==================== API RESPONSE BUILDERS ====================
function successResponse(data) {
    return {
        success: true,
        data,
        timestamp: new Date().toISOString(),
    };
}
function errorResponse(error) {
    return {
        success: false,
        error,
        timestamp: new Date().toISOString(),
    };
}
// ==================== DATE UTILITIES ====================
function now() {
    return new Date();
}
function formatDate(date) {
    return date.toISOString();
}
// ==================== VALIDATION UTILITIES ====================
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}
function isValidUUID(id) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
}
// ==================== STRING UTILITIES ====================
function sanitizeString(input) {
    return input.trim().replace(/[<>]/g, '');
}
function truncate(text, maxLength) {
    if (text.length <= maxLength)
        return text;
    return text.substring(0, maxLength - 3) + '...';
}
//# sourceMappingURL=index.js.map