/**
 * 一次性脚本：把 data/drama_generator.db (SQLite) 数据迁移到 MySQL
 * 用法：
 *   pnpm db:migrate-data            正式跑
 *   pnpm db:migrate-data --dry-run  只统计行数不写
 *   pnpm db:migrate-data --force    目标表非空时仍迁
 */
import Database from 'better-sqlite3'
import mysql from 'mysql2/promise'
import path from 'path'
import { fileURLToPath } from 'url'
import { getDatabaseConfig } from '../src/config.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SQLITE_PATH = path.resolve(__dirname, '../../data/huobao_drama.db')

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const FORCE = args.includes('--force')
const BATCH = 500

// 按外键依赖排序
const TABLE_ORDER = [
  'ai_service_providers',
  'ai_voices',
  'agent_configs',
  'ai_service_configs',
  'dramas',
  'episodes',
  'characters',
  'scenes',
  'props',
  'storyboards',
  'episode_characters',
  'episode_scenes',
  'storyboard_characters',
  'image_generations',
  'video_generations',
  'video_merges',
  'assets',
]

async function main() {
  const cfg = getDatabaseConfig()
  console.log(`[migrate] SQLite=${SQLITE_PATH}`)
  console.log(`[migrate] MySQL=${cfg.user}@${cfg.host}:${cfg.port}/${cfg.database}`)
  console.log(`[migrate] dry-run=${DRY_RUN}, force=${FORCE}`)

  const sqlite = new Database(SQLITE_PATH, { readonly: true })
  const mysqlConn = await mysql.createConnection({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    charset: 'utf8mb4',
    multipleStatements: false,
  })

  const summary: Array<{ table: string; src: number; copied: number; skipped: boolean }> = []

  for (const table of TABLE_ORDER) {
    let srcCount: { c: number }
    try {
      srcCount = sqlite.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as { c: number }
    } catch (err: any) {
      console.log(`[skip] ${table} SQLite 中不存在该表，跳过`)
      summary.push({ table, src: 0, copied: 0, skipped: true })
      continue
    }

    const [dstRows] = await mysqlConn.query(`SELECT COUNT(*) as c FROM \`${table}\``)
    const dstCount = (dstRows as any)[0].c as number

    if (dstCount > 0 && !FORCE) {
      console.log(`[skip] ${table} 目标库已有 ${dstCount} 行，跳过（--force 覆盖）`)
      summary.push({ table, src: srcCount.c, copied: 0, skipped: true })
      continue
    }

    if (DRY_RUN) {
      console.log(`[dry-run] ${table}: SQLite=${srcCount.c}, MySQL=${dstCount}`)
      summary.push({ table, src: srcCount.c, copied: 0, skipped: true })
      continue
    }

    const rows = sqlite.prepare(`SELECT * FROM ${table}`).all() as any[]
    if (rows.length === 0) {
      summary.push({ table, src: 0, copied: 0, skipped: false })
      continue
    }

    await mysqlConn.beginTransaction()
    try {
      // 如果是 --force 模式且目标表非空，先清空
      if (FORCE && dstCount > 0) {
        await mysqlConn.execute(`DELETE FROM \`${table}\``)
      }

      const cols = Object.keys(rows[0])
      const placeholders = cols.map(() => '?').join(',')
      const colList = cols.map(c => `\`${c}\``).join(',')
      const sql = `INSERT INTO \`${table}\` (${colList}) VALUES (${placeholders})`

      let copied = 0
      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH)
        for (const r of batch) {
          const values = cols.map(c => r[c])
          await mysqlConn.execute(sql, values)
        }
        copied += batch.length
        if (rows.length > BATCH) {
          console.log(`[migrate] ${table}: ${copied}/${rows.length}`)
        }
      }
      await mysqlConn.commit()
      console.log(`[done] ${table}: ${copied} 行`)
      summary.push({ table, src: srcCount.c, copied, skipped: false })
    } catch (err) {
      await mysqlConn.rollback()
      console.error(`[error] ${table} 迁移失败，已回滚：`, err)
      throw err
    }
  }

  await mysqlConn.end()
  sqlite.close()

  console.log('\n=== 对账 ===')
  console.table(summary)
  console.log('完成。')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
