/**
 * Internal Patterns Module
 * @module
 */

/**
 * Patterns for various validation and sanitization tasks.
 * This module exports a collection of RegEx patterns used for validating and sanitizing inputs,
 * including numeric strings, wildcards, field names, table names, passwords, and sensitive data
 * patterns.
 */
export const PATTERNS = {
  NUMERIC_STRING: /^\d+$/,
  WILDCARD: /%/g,
  FIELD_NAME: /^[a-zA-Z_][a-zA-Z0-9_]*$/,
  TABLE_NAME: /^[a-zA-Z_][a-zA-Z0-9_]*$/,
  PASSWORD: /^[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]*$/,
  INTERNAL_PATHS: [
    /file:\/\/.*$/gm, // File paths
    /at.*\([^)]*\)/g, // Stack traces
    /\b[A-Za-z]:\\[^\\]+\\.*$/gm, // Windows paths
    /\/[^\/\s]+\/[^\/\s]+\/.*$/gm, // Unix path
  ],
  SENSITIVE: {
    CREDENTIALS: [
      /password/i,
      /token/i,
      /secret/i,
      /key/i,
      /credentials/i,
      /authorization/i,
      /authentication/i,
      /jwt/i,
      /api.?key/i,
      /connection.?string/i,
    ],
    SECRETS: [
      /(password|token|secret|key|authorization|authentication|jwt|api.?key|credentials)(\s*[:=]\s*)([^\s]+)/gi,
      /(bearer\s+)([a-zA-Z0-9\-._~+/]+=*)/gi,
    ],
  },
  HOST: [
    /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/,
    /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
  ],
  SQL: {
    FIELD_NAME_INJECTIONS: [
      /['";]/i,
      /--/,
      /\/\*/,
      /\*\//,
      /\bUNION\b/i,
      /\bSELECT\b/i,
      /\bINSERT\b/i,
      /\bUPDATE\b/i,
      /\bDELETE\b/i,
      /\bDROP\b/i,
    ],
    CLAUSE_INJECTIONS: [
      /['";]/i,
      /--/,
      /\/\*/,
      /\*\//,
      /\bUNION\b/i,
      /\bSELECT\b/i,
      /\bINSERT\b/i,
      /\bUPDATE\b/i,
      /\bDELETE\b/i,
      /\bDROP\b/i,
      /\bOR\b/i,
      /\bAND\b/i,
    ],
  },
} as const
