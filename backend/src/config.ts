import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { parse } from 'yaml'

export interface DatabaseConfig {
  host: string
  port: number
  user: string
  password: string
  database: string
  connectionLimit?: number
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// backend/src/config.ts → 项目根 configs/config.yaml
const CONFIG_PATH = path.resolve(__dirname, '../../configs/config.yaml')

let cached: any = null
function load() {
  if (cached) return cached
  cached = parse(readFileSync(CONFIG_PATH, 'utf8'))
  return cached
}

export function getDatabaseConfig(): DatabaseConfig {
  const db = load().database
  if (!db?.host || !db?.user || !db?.database) {
    throw new Error(`config.yaml: database 节缺字段 (host/user/database)，路径=${CONFIG_PATH}`)
  }
  return {
    host: db.host,
    port: db.port ?? 3306,
    user: db.user,
    password: db.password ?? '',
    database: db.database,
    connectionLimit: db.connection_limit ?? 10,
  }
}
