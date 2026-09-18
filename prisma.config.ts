// prisma.config.ts — Prisma 7 Configuration
// Defines database connection URLs and schema paths for Prisma Migrate and CLI tooling.

import { defineConfig } from '@prisma/config';

export default defineConfig({
  schema: 'docs/database/schema.prisma',
  migrations: {
    directory: 'docs/database/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/hampers_by_her?schema=public',
  },
});
