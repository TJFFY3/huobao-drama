import { defineConfig } from 'drizzle-kit'
import { getDatabaseConfig } from './src/config.js'

const cfg = getDatabaseConfig()

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'mysql',
  dbCredentials: {
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
  },
  verbose: true,
  strict: true,
})
