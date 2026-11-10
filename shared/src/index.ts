// Single source of truth for the API contract. The server validates its
// requests with these schemas and the client parses responses with them,
// so a breaking change shows up as a type error on both sides.
import { z } from 'zod';

// Validation messages in Spanish for the whole app (server and client share this zod instance).
z.config(z.locales.es());

export * from './elements.js';
export * from './errors.js';
export * from './health.js';
export * from './projects.js';
