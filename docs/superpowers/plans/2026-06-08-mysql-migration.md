# SQLite → MySQL 迁移 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把后端数据存储从 SQLite（better-sqlite3 同步驱动）切换到 MySQL（mysql2 异步驱动），全部数据无损迁移过去，业务功能不缩水。

**Architecture:** 替换 drizzle 适配层（sqlite-core → mysql-core）；新增 yaml 配置加载；schema 类型按"最小业务改动"映射，时间字段保持 varchar 存 ISO 字符串；218 处数据库调用全部异步化；一次性脚本迁移历史数据。

**Tech Stack:** TypeScript, Hono, Drizzle ORM, mysql2, yaml (npm), drizzle-kit, MySQL 8.x

**前置条件：**
- 本机已安装并启动 MySQL 8.x，可用 root 账号登录
- 已创建空库 `huobao_drama`（或脚本中创建）
- 用户的全局规则"不主动提交代码"：每个 commit 步骤都标注"等用户授权后再执行"

---

## File Structure

### 新增
| 文件 | 职责 |
|---|---|
| `backend/src/config.ts` | yaml 配置加载（单例） |
| `backend/drizzle.config.ts` | drizzle-kit 指向 mysql + schema |
| `backend/scripts/migrate-sqlite-to-mysql.ts` | 一次性数据迁移脚本 |
| `backend/drizzle/migrations/0000_initial.sql` | drizzle-kit generate 产物 |
| `configs/config.yaml` | 本机配置（gitignore） |

### 修改
| 文件 | 改动概要 |
|---|---|
| `backend/package.json` | 加 mysql2、yaml；删 better-sqlite3、@types/better-sqlite3 |
| `backend/src/db/schema.ts` | sqlite-core → mysql-core |
| `backend/src/db/index.ts` | better-sqlite3 → mysql2 pool |
| `configs/config.example.yaml` | database 节改 MySQL 模板 |
| `.gitignore` | 加 `configs/config.yaml` |
| `CLAUDE.md` | 更新数据库描述 |
| 25 个业务文件 218 处 db 调用 | 全部异步化 |

---

## Task 1: 依赖切换

**Files:**
- Modify: `backend/package.json`

- [ ] **Step 1.1: 装 mysql2 和 yaml**

```bash
cd backend && pnpm add mysql2 yaml
```

Expected: `pnpm-lock.yaml` 更新，`node_modules` 里出现 `mysql2`、`yaml`。

- [ ] **Step 1.2: 验证 mysql2 可加载**

```bash
cd backend && node -e "require('mysql2/promise'); require('yaml'); console.log('OK')"
```

Expected: 输出 `OK`，无报错。

- [ ] **Step 1.3: 暂不卸 better-sqlite3**

保留至 Task 11 一并清理。理由：在异步化期间还要参考旧 schema 行为，且迁移脚本需要它读 SQLite。

- [ ] **Step 1.4: Commit（等用户授权）**

```bash
git add backend/package.json backend/pnpm-lock.yaml
git commit -m "chore(backend): 加 mysql2 / yaml 依赖"
```

---

## Task 2: 配置加载层（config.ts）

**Files:**
- Create: `backend/src/config.ts`
- Modify: `configs/config.example.yaml`
- Create: `configs/config.yaml`（本机用）
- Modify: `.gitignore`（项目根）

- [ ] **Step 2.1: 写 backend/src/config.ts**

```ts
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
```

- [ ] **Step 2.2: 改 configs/config.example.yaml 的 database 节**

把原来的 SQLite 段：
```yaml
database:
  type: "sqlite"
  path: "./data/huobao_drama.db"
  max_idle: 10
  max_open: 100
```
替换为：
```yaml
database:
  host: "127.0.0.1"
  port: 3306
  user: "huobao"
  password: "change_me"
  database: "huobao_drama"
  connection_limit: 10
```

- [ ] **Step 2.3: 写 configs/config.yaml（本机用，不入库）**

复制 example 内容，按本机 MySQL 实际信息填 password。

- [ ] **Step 2.4: .gitignore 加一行**

在仓库根 `.gitignore` 末尾追加：
```
configs/config.yaml
```

- [ ] **Step 2.5: 验证 loader**

```bash
cd backend && pnpm tsx -e "import('./src/config.ts').then(m => console.log(m.getDatabaseConfig()))"
```

Expected: 打印一个对象，包含 host/port/user/database。

- [ ] **Step 2.6: Commit（等用户授权）**

```bash
git add backend/src/config.ts configs/config.example.yaml .gitignore
git commit -m "feat(config): 新增 yaml 配置加载与 database 节"
```

---

## Task 3: drizzle.config.ts

**Files:**
- Create: `backend/drizzle.config.ts`

- [ ] **Step 3.1: 写 drizzle.config.ts**

```ts
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
```

- [ ] **Step 3.2: 验证**

```bash
cd backend && pnpm drizzle-kit --version
```

Expected: 输出版本号无报错。drizzle-kit 此时还不会读 schema（下一任务会改 schema）。

- [ ] **Step 3.3: Commit（等用户授权）**

```bash
git add backend/drizzle.config.ts
git commit -m "feat(db): 新增 drizzle.config.ts 指向 mysql"
```

---

## Task 4: 重写 schema.ts 为 mysql-core

**Files:**
- Modify: `backend/src/db/schema.ts`

### 改写规则

1. import 整体替换：`drizzle-orm/sqlite-core` → `drizzle-orm/mysql-core`
2. `sqliteTable` → `mysqlTable`
3. `text(name)` 字段判断：
   - 名字含 `content` / `prompt` / `description` / `metadata` / `tags` / `reference_images` / `image_url` / `video_url` / `url` / `local_path` / `error_msg` / `scenes` / `presetModels` / `endpoint` / `query_endpoint` / `settings` / `voice_sample_url` → 用 `text(name)`
   - 时间字段（`created_at` / `updated_at` / `deleted_at` / `completed_at`）→ `varchar(name, { length: 32 })`
   - 其余 → `varchar(name, { length: 255 })`
4. `integer(name).primaryKey({ autoIncrement: true })` → `int(name).primaryKey().autoincrement()`
5. `integer(name)` 普通 → `int(name)`
6. `integer(name, { mode: 'boolean' })` → `boolean(name)`
7. `real(name)` → `double(name)`
8. `primaryKey({ columns: [...] })` 不变（mysql-core 同名 API）

- [ ] **Step 4.1: 改 import 行**

```ts
import { mysqlTable, text, varchar, int, double, boolean, primaryKey } from 'drizzle-orm/mysql-core'
```

- [ ] **Step 4.2: 逐表替换**

`dramas` 表示例（其余表按相同规则）：

```ts
export const dramas = mysqlTable('dramas', {
  id: int('id').primaryKey().autoincrement(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  genre: varchar('genre', { length: 255 }),
  style: varchar('style', { length: 255 }).default('realistic'),
  totalEpisodes: int('total_episodes').default(1),
  totalDuration: int('total_duration').default(0),
  status: varchar('status', { length: 255 }).notNull().default('draft'),
  thumbnail: text('thumbnail'),
  tags: text('tags'),
  metadata: text('metadata'),
  createdAt: varchar('created_at', { length: 32 }).notNull(),
  updatedAt: varchar('updated_at', { length: 32 }).notNull(),
  deletedAt: varchar('deleted_at', { length: 32 }),
})
```

按相同规则改 14 张表 + 3 张关联表（episodeCharacters / episodeScenes / storyboardCharacters）。

**关键改写要点提示**（在 schema.ts 中查找并改）：
- 5 处 `integer(..., { mode: 'boolean' })` → `boolean(...)`：
  - `aiServiceConfigs.isDefault` / `aiServiceConfigs.isActive`
  - `aiServiceProviders.isActive`
  - `agentConfigs.isActive`
  - `assets.isFavorite`
- 2 处 `real(...)` → `double(...)`：
  - `agentConfigs.temperature`
  - `imageGenerations.cfgScale`
- 1 处复合主键 `storyboardCharacters.pk` 保持 `primaryKey({ columns: [...] })`，只改字段为 `int(...).notNull()`

- [ ] **Step 4.3: typecheck**

```bash
cd backend && pnpm typecheck 2>&1 | tail -20
```

Expected: schema.ts 自身无错（业务文件用 db 的地方会爆，留待 Task 7+ 解决；这一步**只**关心 schema.ts 自身没报错）。

如果只 schema.ts 有错，修复；如果 schema.ts 没错但其它文件报错，跳过。

- [ ] **Step 4.4: Commit（等用户授权）**

```bash
git add backend/src/db/schema.ts
git commit -m "feat(db): schema 改为 mysql-core 类型"
```

---

## Task 5: 生成迁移 SQL 并在本机 MySQL 建库

**Files:**
- Create: `backend/drizzle/migrations/0000_*.sql` (drizzle-kit 自动生成)

- [ ] **Step 5.1: 创建空数据库**

```bash
mysql -uroot -p -e "CREATE DATABASE huobao_drama DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -uroot -p -e "CREATE USER 'huobao'@'localhost' IDENTIFIED BY 'change_me';"
mysql -uroot -p -e "GRANT ALL ON huobao_drama.* TO 'huobao'@'localhost'; FLUSH PRIVILEGES;"
```

（用户/密码与 `configs/config.yaml` 对齐）

- [ ] **Step 5.2: 生成迁移文件**

```bash
cd backend && pnpm drizzle-kit generate
```

Expected: 在 `backend/drizzle/migrations/` 下生成 `0000_xxx.sql` 与 `meta/` 目录。

- [ ] **Step 5.3: 检查 SQL 没有意外**

```bash
ls backend/drizzle/migrations/
head -50 backend/drizzle/migrations/0000_*.sql
```

Expected: SQL 包含 `CREATE TABLE` 语句，主键/外键/默认值符合预期。

- [ ] **Step 5.4: 应用 SQL 到 MySQL**

```bash
mysql -uhuobao -pchange_me huobao_drama < backend/drizzle/migrations/0000_*.sql
```

如有 `--`、`statement-breakpoint` 等 drizzle 特殊注释导致 mysql cli 报错，替代方案：

```bash
cd backend && pnpm drizzle-kit push
```

（push 命令直接同步 schema 到 DB，绕过 SQL 文件解析）

- [ ] **Step 5.5: 校验表已建**

```bash
mysql -uhuobao -pchange_me huobao_drama -e "SHOW TABLES;"
```

Expected: 看到 17 张表（含 dramas, episodes, characters, scenes, storyboards, props, assets, ai_service_configs, ai_service_providers, ai_voices, agent_configs, image_generations, video_generations, video_merges, episode_characters, episode_scenes, storyboard_characters）。

- [ ] **Step 5.6: Commit（等用户授权）**

```bash
git add backend/drizzle/migrations/
git commit -m "feat(db): 生成 mysql 初始建表迁移"
```

---

## Task 6: 改 db/index.ts 连接初始化

**Files:**
- Modify: `backend/src/db/index.ts`

- [ ] **Step 6.1: 整体替换 db/index.ts**

```ts
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
  dateStrings: true, // 时间字段统一字符串返回，业务侧零感知
})

export const db = drizzle(pool, { schema, mode: 'default' })
export { schema }
```

（如果原 `db/index.ts` 还导出别的东西，比如 helper 函数，保留它们，只改连接部分。读原文件确认。）

- [ ] **Step 6.2: typecheck（预期爆）**

```bash
cd backend && pnpm typecheck 2>&1 | head -50
```

Expected: 大量错误，集中在 `.all()`/`.get()`/`.run()`/`.values()` 等同步链式调用上。**这是预期**，下一组任务专门修。

记下错误总数大致量级（如 "Found 200+ errors"），后面比对。

- [ ] **Step 6.3: 不 commit**

等异步化全部跑通再一并 commit。

---

## Task 7: 异步化 services/ai.ts（核心被依赖最多）

**Files:**
- Modify: `backend/src/services/ai.ts`

### 改写规则（适用于本任务以及 Task 8/9/10）

| 旧（同步） | 新（异步） |
|---|---|
| `db.select().from(t).where(...).all()` | `await db.select().from(t).where(...)` |
| `const [r] = db.select()...all()` | `const [r] = await db.select()...` |
| `db.insert(t).values({...}).run()` | `await db.insert(t).values({...})` |
| `db.update(t).set({...}).where(...).run()` | `await db.update(t).set({...}).where(...)` |
| `db.delete(t).where(...).run()` | `await db.delete(t).where(...)` |
| `.all().filter(...)` 等链式 | 先 `const rows = await db.select()...`，再 `rows.filter(...)` |
| 函数没声明 async | 加 `async`，返回类型变 `Promise<T>` |

- [ ] **Step 7.1: 把所有 db 调用函数变 async**

services/ai.ts 现状（参考）：
```ts
export function getActiveConfig(serviceType: ServiceType): AIConfig | null {
  const rows = db.select().from(...).all()
  // ...
}
export function getTextConfig(): AIConfig { ... }
export function getAudioConfig(): AIConfig { ... }
export function getConfigById(id: number): AIConfig | null { ... }
```

改为：
```ts
export async function getActiveConfig(serviceType: ServiceType): Promise<AIConfig | null> {
  const rows = (await db.select().from(schema.aiServiceConfigs)
    .where(eq(schema.aiServiceConfigs.serviceType, serviceType)))
    .filter(r => r.isActive)
    .sort((a, b) => (b.priority || 0) - (a.priority || 0))
  // ... 其余逻辑不变
}
export async function getTextConfig(): Promise<AIConfig> {
  const config = await getActiveConfig('text')
  if (!config) throw new Error('No active text AI config')
  return config
}
// getAudioConfig / getAudioConfigById / getConfigById 同理
```

注意 `getTextProviderBaseUrl` 不读 DB，保持同步。

- [ ] **Step 7.2: typecheck 检查 ai.ts**

```bash
cd backend && pnpm typecheck 2>&1 | grep "src/services/ai.ts" | head
```

Expected: ai.ts 自身无错（调用方还会报 await 缺失，留到 Task 8/9/10）。

- [ ] **Step 7.3: 不 commit**（等批次完成）

---

## Task 8: 异步化 agents/tools/* 与 agents/index.ts

**Files:**
- Modify: `backend/src/agents/tools/script-tools.ts`
- Modify: `backend/src/agents/tools/extract-tools.ts`
- Modify: `backend/src/agents/tools/storyboard-tools.ts`
- Modify: `backend/src/agents/tools/voice-tools.ts`
- Modify: `backend/src/agents/tools/grid-prompt-tools.ts`
- Modify: `backend/src/agents/index.ts`

- [ ] **Step 8.1: 逐文件按改写规则改**

每个工具文件里的 Mastra `execute: async (...)` 已经是 async，重点：
- 函数体内的 `db....all()` → `await db.....`
- `db....run()` → `await db....`
- `const [r] = db...all()` → `const [r] = await db...`

每改完一个文件 typecheck 一次：
```bash
cd backend && pnpm typecheck 2>&1 | grep "agents/tools/<filename>" | head
```

- [ ] **Step 8.2: 改 agents/index.ts 的 getAgentConfig 和 getModel**

```ts
async function getAgentConfig(agentType: string) {
  const rows = await db.select().from(schema.agentConfigs)
    .where(and(eq(schema.agentConfigs.agentType, agentType), isNull(schema.agentConfigs.deletedAt)))
  return rows.find(r => r.isActive) || rows[0] || null
}

async function getModel(dbConfig: any) {
  const textConfig = await getTextConfig()
  const resolvedBaseURL = getTextProviderBaseUrl(textConfig)
  // ...其余不变
}

export async function createAgent(type: string, episodeId: number, dramaId: number): Promise<Agent | null> {
  const defaults = DEFAULT_PROMPTS[type]
  if (!defaults) return null
  const dbConfig = await getAgentConfig(type)
  const model = await getModel(dbConfig)
  // ... 其余不变
}
```

`createAgent` 变 async 会传染到 routes/agent.ts 的调用方。

- [ ] **Step 8.3: typecheck**

```bash
cd backend && pnpm typecheck 2>&1 | grep "agents/" | head
```

Expected: agents/* 自身全部 OK。

- [ ] **Step 8.4: 不 commit**

---

## Task 9: 异步化 routes/*（15 个文件）

**Files:**
- Modify: `backend/src/routes/dramas.ts`
- Modify: `backend/src/routes/episodes.ts`
- Modify: `backend/src/routes/storyboards.ts`
- Modify: `backend/src/routes/scenes.ts`
- Modify: `backend/src/routes/characters.ts`
- Modify: `backend/src/routes/images.ts`
- Modify: `backend/src/routes/videos.ts`
- Modify: `backend/src/routes/upload.ts`
- Modify: `backend/src/routes/aiConfigs.ts`
- Modify: `backend/src/routes/agentConfigs.ts`
- Modify: `backend/src/routes/agent.ts`
- Modify: `backend/src/routes/compose.ts`
- Modify: `backend/src/routes/merge.ts`
- Modify: `backend/src/routes/grid.ts`
- Modify: `backend/src/routes/skills.ts`
- Modify: `backend/src/routes/webhooks.ts`
- Modify: `backend/src/routes/aiVoices.ts`

- [ ] **Step 9.1: 按文件批量改**

Hono 路由 handler 大多已经是 `async (c) => {...}`，只需把里面的 db 调用按改写规则加 await、去掉 `.all()/.run()/.get()`、且涉及链式 `.filter().sort()` 时拆成两步。

特别提示：
- `aiConfigs.ts` 里 `huobao-preset` 处理器有循环写 DB，循环体内每个 `db.update/insert.run()` 都要 `await`，循环必须在 `async` 函数里。
- 任何 `[row] = db.select()...all()` 改为 `[row] = await db.select()...`。
- `routes/agent.ts` 调 `createAgent(...)` 改为 `await createAgent(...)`（Task 8 让它变 async 了）。

- [ ] **Step 9.2: 每改完几个文件 typecheck 一次**

```bash
cd backend && pnpm typecheck 2>&1 | grep "src/routes/" | head -30
```

每轮看错误数下降。

- [ ] **Step 9.3: 不 commit**

---

## Task 10: 异步化剩余 services/*

**Files:**
- Modify: `backend/src/services/image-generation.ts`
- Modify: `backend/src/services/video-generation.ts`
- Modify: `backend/src/services/tts-generation.ts`
- Modify: `backend/src/services/ffmpeg-compose.ts`
- Modify: `backend/src/services/ffmpeg-merge.ts`
- Modify: `backend/src/services/grid-split.ts`

- [ ] **Step 10.1: 按改写规则修每个文件**

注意 `getTextConfig`/`getAudioConfig`/`getConfigById` 等 Task 7 变 async 后，所有调用方都得加 await。

- [ ] **Step 10.2: 跑完整 typecheck**

```bash
cd backend && pnpm typecheck
```

Expected: **0 错误**。

- [ ] **Step 10.3: 启动后端冒烟**

```bash
cd backend && pnpm dev > /tmp/huobao-dev.log 2>&1 &
sleep 5
curl -s http://localhost:5679/api/v1/health
```

Expected: `{"status":"ok",...}`

如启动失败，看 `/tmp/huobao-dev.log` 排查。

```bash
# 测试基本路由（不依赖业务数据）
curl -s http://localhost:5679/api/v1/dramas | head -100
```

Expected: 返回 JSON（此时 MySQL 是空库，dramas 为空数组）。

```bash
# 停掉
pkill -f "tsx watch src/index.ts"
```

- [ ] **Step 10.4: Commit 一大批异步化变动（等用户授权）**

```bash
git add backend/src/db/index.ts backend/src/services backend/src/routes backend/src/agents
git commit -m "refactor(backend): 全面异步化 db 调用，切换 mysql2 驱动"
```

---

## Task 11: 写数据迁移脚本

**Files:**
- Create: `backend/scripts/migrate-sqlite-to-mysql.ts`
- Modify: `backend/package.json`（加 script）

- [ ] **Step 11.1: 写 backend/scripts/migrate-sqlite-to-mysql.ts**

```ts
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
const SQLITE_PATH = path.resolve(__dirname, '../../data/drama_generator.db')

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
    host: cfg.host, port: cfg.port, user: cfg.user,
    password: cfg.password, database: cfg.database,
    charset: 'utf8mb4',
    multipleStatements: false,
  })

  const summary: Array<{ table: string; src: number; copied: number; skipped: boolean }> = []

  for (const table of TABLE_ORDER) {
    const srcCount = sqlite.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as { c: number }
    const [dstRows] = await mysqlConn.query(`SELECT COUNT(*) as c FROM ${table}`)
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
        console.log(`[migrate] ${table}: ${copied}/${rows.length}`)
      }
      await mysqlConn.commit()
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
```

- [ ] **Step 11.2: package.json 加 script**

`backend/package.json` 的 `scripts` 节加：
```json
"db:migrate-data": "tsx scripts/migrate-sqlite-to-mysql.ts"
```

- [ ] **Step 11.3: typecheck**

```bash
cd backend && pnpm typecheck
```

Expected: 0 错误。

- [ ] **Step 11.4: dry-run**

```bash
cd backend && pnpm db:migrate-data --dry-run
```

Expected: 列出每张表 SQLite 行数与 MySQL 行数对照，不写入数据。

- [ ] **Step 11.5: Commit（等用户授权）**

```bash
git add backend/scripts/migrate-sqlite-to-mysql.ts backend/package.json
git commit -m "feat(scripts): 新增 sqlite → mysql 一次性数据迁移脚本"
```

---

## Task 12: 跑数据迁移

- [ ] **Step 12.1: 备份 SQLite（保险）**

```bash
cp data/drama_generator.db data/drama_generator.db.bak.$(date +%Y%m%d-%H%M%S)
```

- [ ] **Step 12.2: 正式跑迁移**

```bash
cd backend && pnpm db:migrate-data
```

Expected: 每张表打印 `[migrate] table: N/M`，最后输出对账表。

如某张表行数对不上，看错误日志排查（可能是字符集、可空字段、特殊字符等）。

- [ ] **Step 12.3: 手工对账**

```bash
mysql -uhuobao -pchange_me huobao_drama -e "SELECT 'dramas', COUNT(*) FROM dramas UNION ALL SELECT 'episodes', COUNT(*) FROM episodes UNION ALL SELECT 'characters', COUNT(*) FROM characters UNION ALL SELECT 'storyboards', COUNT(*) FROM storyboards;"
```

与对账表的 src 列比对，应完全一致。

---

## Task 13: 清理 + 烟测

**Files:**
- Modify: `backend/package.json`
- Modify: `CLAUDE.md`

- [ ] **Step 13.1: 卸 better-sqlite3 依赖**

迁移脚本依赖 better-sqlite3 读 SQLite —— 用完之后可以卸；但脚本会失效。**推荐保留 better-sqlite3 作 devDependency**，避免哪天要复跑迁移时麻烦。

把 `better-sqlite3` 和 `@types/better-sqlite3` 从 `dependencies` 移到 `devDependencies`：

```bash
cd backend
pnpm remove better-sqlite3 @types/better-sqlite3
pnpm add -D better-sqlite3 @types/better-sqlite3
```

- [ ] **Step 13.2: 改 CLAUDE.md**

把"Database: SQLite at `data/drama_generator.db`. ..."替换为：
```
## Database
MySQL 8.x via mysql2 + Drizzle ORM (mysql-core). 
Connection in `configs/config.yaml` (gitignored; see `config.example.yaml`).
Schema in `backend/src/db/schema.ts`. Migrations under `backend/drizzle/migrations/`.
```

把 backend section 中"better-sqlite3"也相应移除。

- [ ] **Step 13.3: 启动全链路烟测**

```bash
# 后端
cd backend && pnpm dev > /tmp/huobao-dev.log 2>&1 &
sleep 5
curl -s http://localhost:5679/api/v1/health
curl -s http://localhost:5679/api/v1/dramas | head -200
```

Expected: dramas 返回原 SQLite 中的数据。

```bash
# 前端
cd frontend && pnpm dev &
sleep 30
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3013/
```

Expected: 前端 HTTP 200。

手工冒烟：
- 浏览器打开 http://localhost:3013/
- 看到剧集列表
- 进入某部剧 → 工作台 → 看到角色/分镜
- 创建一个新角色，保存，刷新页面验证持久化

```bash
# 停掉
pkill -f "tsx watch src/index.ts"
pkill -f "nuxt dev"
```

- [ ] **Step 13.4: 最终 commit（等用户授权）**

```bash
git add backend/package.json backend/pnpm-lock.yaml CLAUDE.md
git commit -m "chore: better-sqlite3 移至 devDependencies；CLAUDE.md 更新为 mysql"
```

---

## 验收清单（全部任务完成后）

- [ ] `pnpm typecheck`（backend） 0 错误
- [ ] `pnpm dev`（backend）启动正常，无报错
- [ ] `curl /api/v1/health` 返回 200
- [ ] `GET /api/v1/dramas` 返回的剧集数与原 SQLite 中一致
- [ ] 前端可打开剧集工作台，看到原有数据
- [ ] 可新建一条剧/角色，刷新仍在
- [ ] `mysql ... SHOW TABLES` 17 张表全部存在
- [ ] `configs/config.yaml` 已加入 `.gitignore`

---

## 回滚方案

每个任务都对应独立 commit。如某步出问题：
- 若仅 schema 错：`git revert` 对应 commit，重生迁移
- 若数据迁移错：`mysql ... DROP DATABASE huobao_drama;` → 重建 → 重跑脚本（脚本幂等，会跳过非空表，加 `--force` 覆盖）
- 若 MySQL 整体出问题，原 SQLite 文件未删，把 `db/index.ts` revert 即可回到 SQLite

历史 SQLite 文件 `data/drama_generator.db` 全程保留不删，长期归档。
