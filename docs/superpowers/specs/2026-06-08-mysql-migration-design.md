# SQLite → MySQL 迁移设计

- 日期：2026-06-08
- 项目：huobao-drama
- 范围：后端数据库从 SQLite（better-sqlite3）切换到 MySQL（mysql2），并迁移所有现有数据

---

## 1. 目标

把后端数据存储从 `data/drama_generator.db`（SQLite + better-sqlite3 同步驱动）整体替换为 MySQL（mysql2 异步驱动），保留全部历史数据，业务功能不缩水。

## 2. 关键决策（已与用户对齐）

| 决策项 | 选择 |
|---|---|
| 现有数据 | 全部迁移过去 |
| 连接配置位置 | `configs/config.yaml`（新增 yaml loader） |
| 时间字段类型 | 保持 varchar 存 ISO 字符串，业务代码零改动 |
| 建表方式 | drizzle-kit 生成迁移文件 |
| 双轨支持 | 不做，彻底替换 SQLite |
| 异步化策略 | 老实异步化全部 218 处调用 |

## 3. 技术栈选型

| 项 | 选择 | 理由 |
|---|---|---|
| MySQL 驱动 | `mysql2` | drizzle 官方主推，生态稳定 |
| ORM 适配层 | `drizzle-orm/mysql-core` + `drizzle-orm/mysql2` | 替换原 sqlite-core + better-sqlite3 |
| Schema 管理 | `drizzle-kit generate` 出迁移 SQL | 正规做法 |
| YAML 解析 | `yaml`（npm 包） | 轻量，无原生依赖 |
| 数据迁移 | 一次性 TS 脚本，跑完即弃 | 简单可控 |

## 4. Schema 类型映射

字符集统一 `utf8mb4` / `utf8mb4_unicode_ci`（中文剧本必须）。

| 当前 SQLite 列 | MySQL 类型 | drizzle 写法 |
|---|---|---|
| `integer().primaryKey({autoIncrement:true})` | `int` AUTO_INCREMENT | `int().primaryKey().autoincrement()` |
| `integer('drama_id').notNull()` 外键 | `int` | `int(...)` |
| `text('title').notNull()` 普通短文本 | `varchar(255)` | `varchar(..., {length:255})` |
| 长文本（content / script_content / system_prompt / description / prompt / *_prompt / metadata / tags / reference_images / scenes(JSON) / image_url / video_url / url / local_path / error_msg 等） | `text` | `text(...)` |
| `text('created_at').notNull()` 时间 | `varchar(32)` | `varchar(..., {length:32})` |
| `integer({mode:'boolean'})` | `boolean`（底层 `tinyint(1)`） | `boolean(...)` |
| `real(...)` 浮点 | `double` | `double(...)` |
| 复合主键 | 同 | `primaryKey({columns:[...]})` |

**长文本字段判定启发式**：字段名包含 `content` / `prompt` / `description` / `metadata` / `tags` / `reference_images` / `local_path` / `image_url` / `video_url` / `url` / `error_msg` / `scenes`（JSON 字段）等的，统一用 `text`，避免 varchar(255) 装不下。

## 5. 配置加载

### 5.1 新增 `backend/src/config.ts`

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
// backend/src/config.ts → 项目根的 configs/config.yaml
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
  return { connectionLimit: 10, ...db }
}
```

### 5.2 `configs/config.example.yaml` 改写 database 节

```yaml
database:
  host: "127.0.0.1"
  port: 3306
  user: "huobao"
  password: "change_me"
  database: "huobao_drama"
  connection_limit: 10
```

### 5.3 仓库根 `.gitignore` 新增

```
configs/config.yaml
```

`config.example.yaml` 入库做模板。

### 5.4 不做的事

- 不引入 dotenv
- 不做热重载
- 暂不读 yaml 里其它节（app/server/storage/ai 仍走原有逻辑）

## 6. 数据库连接初始化（backend/src/db/index.ts）

旧（同步）：
```ts
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
const sqlite = new Database(path)
sqlite.pragma('journal_mode = WAL')
export const db = drizzle(sqlite, { schema })
```

新（异步）：
```ts
import mysql from 'mysql2/promise'
import { drizzle } from 'drizzle-orm/mysql2'
import * as schema from './schema.js'
import { getDatabaseConfig } from '../config.js'

const cfg = getDatabaseConfig()
const pool = mysql.createPool({
  host: cfg.host, port: cfg.port, user: cfg.user,
  password: cfg.password, database: cfg.database,
  connectionLimit: cfg.connectionLimit ?? 10,
  charset: 'utf8mb4',
})
export const db = drizzle(pool, { schema, mode: 'default' })
export { schema }
```

## 7. 异步化（218 处调用，25 个文件）

### 7.1 改写规则

| 旧（同步） | 新（异步） |
|---|---|
| `db.select().from(t).where(...).all()` | `await db.select().from(t).where(...)` |
| `const [r] = db.select()....all()` | `const [r] = await db.select()....` |
| `db.insert(t).values({...}).run()` | `await db.insert(t).values({...})` |
| `db.update(t).set({...}).where(...).run()` | `await db.update(t).set({...}).where(...)` |
| `db.delete(t).where(...).run()` | `await db.delete(t).where(...)` |

### 7.2 改写顺序

按依赖反向，每改完一个文件 `pnpm typecheck` 一次：

1. `src/services/ai.ts`（被大量上游依赖，先稳）
2. `src/utils/*`（被多处依赖）
3. `src/agents/tools/*`（5 个工具文件）
4. `src/agents/index.ts`
5. `src/routes/*`（15 个路由文件）
6. `src/services/*`（其余 services）

### 7.3 函数签名传染

`getActiveConfig`/`getTextConfig`/`getAudioConfig`/`getConfigById` 等同步工具函数会变成 `async`，所有调用方都要相应改 `await`。这是必然的"波纹"，靠 typecheck 兜底。

### 7.4 SELECT 返回类型变化

SQLite drizzle 的 `.all()` 返回 `T[]`，mysql2 drizzle 的 `await db.select()...` 也直接返回 `T[]`，结构兼容。**风险点**：少数地方用了 `.get()` 拿单条，要改成 `[row]` 解构。

## 8. 数据迁移脚本

### 8.1 路径与入口
- `backend/scripts/migrate-sqlite-to-mysql.ts`
- `package.json` scripts 加：`"db:migrate-data": "tsx scripts/migrate-sqlite-to-mysql.ts"`
- 支持 `--dry-run`（只统计行数不写）、`--force`（目标表非空时仍迁移）

### 8.2 流程
1. 读 `configs/config.yaml` 获取 MySQL 连接
2. 以 `readonly:true` 打开 `data/drama_generator.db`
3. 连接 MySQL（用同一个 mysql2 pool）
4. 检查目标库表已存在；按依赖顺序逐表处理：
   - 检查目标表行数，非 0 且非 `--force` 则跳过该表
   - 事务内：`SELECT * FROM sqlite_table` → 500 行一批 `INSERT INTO mysql_table` 显式带 id
5. 打印每张表迁移行数对账表

### 8.3 表迁移顺序
```
ai_service_providers, ai_voices, agent_configs, ai_service_configs,
dramas, episodes, characters, scenes, props,
storyboards, episode_characters, episode_scenes, storyboard_characters,
image_generations, video_generations, video_merges, assets
```

### 8.4 字段值处理
- 自增 ID：显式保留原值
- 布尔字段：SQLite 0/1，mysql2 写入时驱动会处理为 tinyint(1)
- 时间字段：原样写入（都是字符串）
- null：原样

### 8.5 跑完即弃
迁移完成后脚本不再使用，但保留在仓库（备查/可复跑）。

## 9. 改动清单

### 新增
- `backend/src/config.ts`
- `backend/scripts/migrate-sqlite-to-mysql.ts`
- `backend/drizzle/migrations/0000_*.sql`（drizzle-kit 产物）
- `configs/config.yaml`（本机用，gitignore）

### 修改
- `backend/package.json` — 加 `mysql2`、`yaml`；删 `better-sqlite3`、`@types/better-sqlite3`
- `backend/drizzle.config.ts`（如已有则改 dialect，没有则新增）
- `backend/src/db/schema.ts` — 全表从 sqlite-core 改为 mysql-core
- `backend/src/db/index.ts` — 替换连接初始化
- `configs/config.example.yaml` — database 节改 MySQL 模板
- `.gitignore` — 加 `configs/config.yaml`
- `CLAUDE.md` — 数据库部分描述更新
- 25 个业务文件 218 处调用异步化（见第 7 节）

### 删除
- `better-sqlite3` 依赖
- `@types/better-sqlite3` 依赖
- `data/drama_generator.db` **不删**（备份），用户自行处置

## 10. 实施步骤（按顺序）

1. **配置层**：加依赖、写 `config.ts`、更新 example
2. **改 schema**：sqlite-core → mysql-core，typecheck
3. **生成迁移 SQL**：drizzle-kit generate；本机 MySQL 跑 SQL 建空库
4. **改连接初始化**：db/index.ts 换 mysql2 pool（这一步过后 typecheck 大面积爆错，预期）
5. **异步化 218 处**：按 7.2 顺序逐文件改，typecheck 全绿后启动后端
6. **跑迁移脚本**：先 dry-run 后正式跑，对账行数
7. **清理 + 烟测**：卸 better-sqlite3、更新 CLAUDE.md、前端打开核心页面验证

## 11. 风险

| 风险 | 概率 | 应对 |
|---|---|---|
| 异步化漏改 .all()/.run() 运行时报错 | 中 | typecheck + 启动冒烟 |
| 中文乱码 | 中 | 建表显式 `DEFAULT CHARACTER SET utf8mb4` |
| varchar(255) 装不下偶发长字段 | 低 | 启发式归 text；保险起见 URL/prompt/path/json 类一律 text |
| 时间字段格式差异 | 低 | 统一 varchar 原样复制 |
| boolean 字段为 null | 低 | 迁移时遇 null 显式赋默认值 |
| 函数签名波纹 | 高 | typecheck 兜底逐个修 |
| pnpm v10 装 mysql2 失败 | 低 | mysql2 纯 JS 无原生依赖 |

## 12. 验收

1. `pnpm typecheck` 无错
2. `pnpm dev` 启动正常
3. `curl /api/v1/health` → 200
4. `GET /api/v1/dramas` 返回原 SQLite 中剧集列表（条数一致）
5. 前端打开剧集工作台，原有角色/分镜数据可见
6. 创建一条新剧、新角色，刷新后仍在

## 13. 不在本次范围

- AI provider 配置迁移到 yaml（保持 DB 表方案）
- 异步化以外的代码重构
- 数据库分库分表/读写分离
- 历史 SQLite 文件归档自动化
