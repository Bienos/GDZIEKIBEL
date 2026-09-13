import { z } from 'zod';

/**
 * Single validated entry point for server-side environment access.
 *
 * Rules:
 * - Nothing outside this module may read `process.env` for application config.
 * - Unknown/missing values are never defaulted into plausible-looking values;
 *   validation fails loudly instead.
 * - Validation is lazy so that a build or a page that needs no database can
 *   succeed without a database connection string.
 */
const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  /**
   * PostgreSQL connection string. The target database must have the PostGIS
   * extension available (see docs/adr/0001-foundation-stack.md).
   */
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL must not be empty')
    .refine(
      (value) => value.startsWith('postgres://') || value.startsWith('postgresql://'),
      'DATABASE_URL must be a postgres:// or postgresql:// connection string',
    ),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * Parses the given record against the server environment schema.
 *
 * Exported separately from {@link getServerEnv} so it can be unit tested
 * without mutating the real process environment.
 */
export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverEnvSchema.safeParse(source);

  if (!result.success) {
    // Report variable names and reasons only. Never echo the values: a
    // connection string carries credentials.
    const problems = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid server environment configuration: ${problems}`);
  }

  return result.data;
}

let cached: ServerEnv | undefined;

/** Returns the validated server environment, parsing it on first use. */
export function getServerEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}
