import mysql from 'mysql2/promise'
import { drizzle } from 'drizzle-orm/mysql2'
import * as schema from './schema.js'
import { getDatabaseConfig } from '../config.js'

const cfg = getDatabaseConfig()

const pool = mysql.createPool({
  host: cfg.host,
  port: cfg.port,
  user: cfg.user,
  password: cfg.password,
  database: cfg.database,
  connectionLimit: cfg.connectionLimit ?? 10,
  charset: 'utf8mb4',
  dateStrings: true,
})

export const db = drizzle(pool, { schema, mode: 'default' })
export { schema }
export type DB = typeof db
