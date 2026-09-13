/**
 * Loads local environment files for integration tests.
 *
 * Values already present in the process environment win, so CI can supply
 * DATABASE_URL as a secret without a file.
 */
import { config as loadEnvFile } from 'dotenv';

loadEnvFile({ path: '.env.local', quiet: true });
loadEnvFile({ quiet: true });
