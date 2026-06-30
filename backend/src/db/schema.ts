/**
 * Drizzle schema — 精确匹配现有数据库列名
 * MySQL 版本（从 SQLite 迁移）
 */
import { mysqlTable, text, varchar, int, double, boolean, primaryKey } from 'drizzle-orm/mysql-core'

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

export const episodes = mysqlTable('episodes', {
  id: int('id').primaryKey().autoincrement(),
  dramaId: int('drama_id').notNull(),
  episodeNumber: int('episode_number').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content'),
  scriptContent: text('script_content'),
  description: text('description'),
  duration: int('duration').default(0),
  status: varchar('status', { length: 255 }).default('draft'),
  videoUrl: text('video_url'),
  thumbnail: text('thumbnail'),
  imageConfigId: int('image_config_id'),
  videoConfigId: int('video_config_id'),
  audioConfigId: int('audio_config_id'),
  createdAt: varchar('created_at', { length: 32 }).notNull(),
  updatedAt: varchar('updated_at', { length: 32 }).notNull(),
  deletedAt: varchar('deleted_at', { length: 32 }),
})

export const characters = mysqlTable('characters', {
  id: int('id').primaryKey().autoincrement(),
  dramaId: int('drama_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  role: varchar('role', { length: 255 }),
  description: text('description'),
  appearance: text('appearance'),
  personality: text('personality'),
  voiceStyle: varchar('voice_style', { length: 255 }),
  imageUrl: text('image_url'),
  referenceImages: text('reference_images'),
  seedValue: varchar('seed_value', { length: 255 }),
  sortOrder: int('sort_order'),
  localPath: text('local_path'),
  voiceSampleUrl: text('voice_sample_url'),
  voiceProvider: varchar('voice_provider', { length: 255 }),
  createdAt: varchar('created_at', { length: 32 }).notNull(),
  updatedAt: varchar('updated_at', { length: 32 }).notNull(),
  deletedAt: varchar('deleted_at', { length: 32 }),
})

// Episode-Character many-to-many
export const episodeCharacters = mysqlTable('episode_characters', {
  id: int('id').primaryKey().autoincrement(),
  episodeId: int('episode_id').notNull(),
  characterId: int('character_id').notNull(),
  createdAt: varchar('created_at', { length: 32 }).notNull(),
})

// Episode-Scene many-to-many
export const episodeScenes = mysqlTable('episode_scenes', {
  id: int('id').primaryKey().autoincrement(),
  episodeId: int('episode_id').notNull(),
  sceneId: int('scene_id').notNull(),
  createdAt: varchar('created_at', { length: 32 }).notNull(),
})

export const scenes = mysqlTable('scenes', {
  id: int('id').primaryKey().autoincrement(),
  dramaId: int('drama_id').notNull(),
  episodeId: int('episode_id'),
  location: text('location').notNull(),
  time: varchar('time', { length: 255 }).notNull(),
  prompt: text('prompt').notNull(),
  storyboardCount: int('storyboard_count').default(1),
  imageUrl: text('image_url'),
  status: varchar('status', { length: 255 }).default('pending'),
  localPath: text('local_path'),
  createdAt: varchar('created_at', { length: 32 }).notNull(),
  updatedAt: varchar('updated_at', { length: 32 }).notNull(),
  deletedAt: varchar('deleted_at', { length: 32 }),
})

export const storyboards = mysqlTable('storyboards', {
  id: int('id').primaryKey().autoincrement(),
  episodeId: int('episode_id').notNull(),
  sceneId: int('scene_id'),
  storyboardNumber: int('storyboard_number').notNull(),
  title: varchar('title', { length: 255 }),
  location: text('location'),
  time: varchar('time', { length: 255 }),
  shotType: varchar('shot_type', { length: 255 }),
  angle: varchar('angle', { length: 255 }),
  movement: varchar('movement', { length: 255 }),
  action: text('action'),
  result: text('result'),
  atmosphere: text('atmosphere'),
  imagePrompt: text('image_prompt'),
  videoPrompt: text('video_prompt'),
  bgmPrompt: text('bgm_prompt'),
  soundEffect: text('sound_effect'),
  dialogue: text('dialogue'),
  description: text('description'),
  duration: int('duration').default(0),
  composedImage: text('composed_image'),
  firstFrameImage: text('first_frame_image'),
  lastFrameImage: text('last_frame_image'),
  referenceImages: text('reference_images'),
  videoUrl: text('video_url'),
  ttsAudioUrl: text('tts_audio_url'),
  subtitleUrl: text('subtitle_url'),
  composedVideoUrl: text('composed_video_url'),
  status: varchar('status', { length: 255 }).default('pending'),
  createdAt: varchar('created_at', { length: 32 }).notNull(),
  updatedAt: varchar('updated_at', { length: 32 }).notNull(),
  deletedAt: varchar('deleted_at', { length: 32 }),
})

export const storyboardCharacters = mysqlTable('storyboard_characters', {
  storyboardId: int('storyboard_id').notNull(),
  characterId: int('character_id').notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.storyboardId, table.characterId] }),
}))

export const aiServiceConfigs = mysqlTable('ai_service_configs', {
  id: int('id').primaryKey().autoincrement(),
  serviceType: varchar('service_type', { length: 255 }).notNull(),
  provider: varchar('provider', { length: 255 }),
  name: varchar('name', { length: 255 }).notNull(),
  baseUrl: text('base_url').notNull(),
  apiKey: text('api_key').notNull(),
  model: varchar('model', { length: 255 }),
  endpoint: text('endpoint'),
  queryEndpoint: text('query_endpoint'),
  priority: int('priority').default(0),
  isDefault: boolean('is_default').default(false),
  isActive: boolean('is_active').default(true),
  settings: text('settings'),
  createdAt: varchar('created_at', { length: 32 }).notNull(),
  updatedAt: varchar('updated_at', { length: 32 }).notNull(),
  // 注意: 此表无 deleted_at
})

export const aiServiceProviders = mysqlTable('ai_service_providers', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 255 }).notNull(),
  displayName: varchar('display_name', { length: 255 }),
  serviceType: varchar('service_type', { length: 255 }).notNull(),
  provider: varchar('provider', { length: 255 }).notNull(),
  defaultUrl: text('default_url'),
  presetModels: text('preset_models'),
  description: text('description'),
  isActive: boolean('is_active').default(true),
  createdAt: varchar('created_at', { length: 32 }).notNull(),
  updatedAt: varchar('updated_at', { length: 32 }).notNull(),
})

export const aiVoices = mysqlTable('ai_voices', {
  id: int('id').primaryKey().autoincrement(),
  voiceId: varchar('voice_id', { length: 255 }).notNull().unique(),   // MiniMax voice_id
  voiceName: varchar('voice_name', { length: 255 }).notNull(),         // 中文名
  description: text('description'),                                     // 描述数组 JSON
  language: varchar('language', { length: 255 }),                      // 语言标签
  provider: varchar('provider', { length: 255 }).notNull(),            // minimax
  createdAt: varchar('created_at', { length: 32 }).notNull(),
})

export const agentConfigs = mysqlTable('agent_configs', {
  id: int('id').primaryKey().autoincrement(),
  agentType: varchar('agent_type', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  model: varchar('model', { length: 255 }),
  systemPrompt: text('system_prompt'),
  temperature: double('temperature'),
  maxTokens: int('max_tokens'),
  maxIterations: int('max_iterations'),
  isActive: boolean('is_active').default(true),
  createdAt: varchar('created_at', { length: 32 }).notNull(),
  updatedAt: varchar('updated_at', { length: 32 }).notNull(),
  deletedAt: varchar('deleted_at', { length: 32 }),
})

export const imageGenerations = mysqlTable('image_generations', {
  id: int('id').primaryKey().autoincrement(),
  storyboardId: int('storyboard_id'),
  dramaId: int('drama_id'),
  sceneId: int('scene_id'),
  characterId: int('character_id'),
  propId: int('prop_id'),
  imageType: varchar('image_type', { length: 255 }),
  frameType: varchar('frame_type', { length: 255 }),
  provider: varchar('provider', { length: 255 }),
  prompt: text('prompt'),
  negativePrompt: text('negative_prompt'),
  model: varchar('model', { length: 255 }),
  size: varchar('size', { length: 255 }),
  quality: varchar('quality', { length: 255 }),
  style: varchar('style', { length: 255 }),
  steps: int('steps'),
  cfgScale: double('cfg_scale'),
  seed: int('seed'),
  imageUrl: text('image_url'),
  minioUrl: text('minio_url'),
  localPath: text('local_path'),
  status: varchar('status', { length: 255 }).default('pending'),
  taskId: varchar('task_id', { length: 255 }),
  errorMsg: text('error_msg'),
  width: int('width'),
  height: int('height'),
  referenceImages: text('reference_images'),
  createdAt: varchar('created_at', { length: 32 }).notNull(),
  updatedAt: varchar('updated_at', { length: 32 }).notNull(),
  completedAt: varchar('completed_at', { length: 32 }),
})

export const videoGenerations = mysqlTable('video_generations', {
  id: int('id').primaryKey().autoincrement(),
  storyboardId: int('storyboard_id'),
  dramaId: int('drama_id'),
  provider: varchar('provider', { length: 255 }),
  prompt: text('prompt'),
  model: varchar('model', { length: 255 }),
  imageGenId: int('image_gen_id'),
  referenceMode: varchar('reference_mode', { length: 255 }),
  imageUrl: text('image_url'),
  firstFrameUrl: text('first_frame_url'),
  lastFrameUrl: text('last_frame_url'),
  referenceImageUrls: text('reference_image_urls'),
  duration: int('duration'),
  fps: int('fps'),
  resolution: varchar('resolution', { length: 255 }),
  aspectRatio: varchar('aspect_ratio', { length: 255 }),
  style: varchar('style', { length: 255 }),
  motionLevel: int('motion_level'),
  cameraMotion: varchar('camera_motion', { length: 255 }),
  seed: int('seed'),
  videoUrl: text('video_url'),
  minioUrl: text('minio_url'),
  localPath: text('local_path'),
  status: varchar('status', { length: 255 }).default('pending'),
  taskId: varchar('task_id', { length: 255 }),
  errorMsg: text('error_msg'),
  width: int('width'),
  height: int('height'),
  createdAt: varchar('created_at', { length: 32 }).notNull(),
  updatedAt: varchar('updated_at', { length: 32 }).notNull(),
  completedAt: varchar('completed_at', { length: 32 }),
  deletedAt: varchar('deleted_at', { length: 32 }),
})

export const videoMerges = mysqlTable('video_merges', {
  id: int('id').primaryKey().autoincrement(),
  episodeId: int('episode_id'),
  dramaId: int('drama_id'),
  title: varchar('title', { length: 255 }),
  provider: varchar('provider', { length: 255 }),
  model: varchar('model', { length: 255 }),
  status: varchar('status', { length: 255 }).default('pending'),
  scenes: text('scenes'), // JSON
  mergedUrl: text('merged_url'),
  duration: int('duration'),
  taskId: varchar('task_id', { length: 255 }),
  errorMsg: text('error_msg'),
  createdAt: varchar('created_at', { length: 32 }).notNull(),
  completedAt: varchar('completed_at', { length: 32 }),
  deletedAt: varchar('deleted_at', { length: 32 }),
})

export const props = mysqlTable('props', {
  id: int('id').primaryKey().autoincrement(),
  dramaId: int('drama_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 255 }),
  description: text('description'),
  prompt: text('prompt'),
  imageUrl: text('image_url'),
  referenceImages: text('reference_images'),
  localPath: text('local_path'),
  createdAt: varchar('created_at', { length: 32 }).notNull(),
  updatedAt: varchar('updated_at', { length: 32 }).notNull(),
  deletedAt: varchar('deleted_at', { length: 32 }),
})

export const assets = mysqlTable('assets', {
  id: int('id').primaryKey().autoincrement(),
  dramaId: int('drama_id'),
  episodeId: int('episode_id'),
  storyboardId: int('storyboard_id'),
  storyboardNum: int('storyboard_num'),
  name: varchar('name', { length: 255 }),
  description: text('description'),
  type: varchar('type', { length: 255 }),
  category: varchar('category', { length: 255 }),
  url: text('url'),
  thumbnailUrl: text('thumbnail_url'),
  localPath: text('local_path'),
  fileSize: int('file_size'),
  mimeType: varchar('mime_type', { length: 255 }),
  width: int('width'),
  height: int('height'),
  duration: int('duration'),
  format: varchar('format', { length: 255 }),
  imageGenId: int('image_gen_id'),
  videoGenId: int('video_gen_id'),
  isFavorite: boolean('is_favorite').default(false),
  viewCount: int('view_count').default(0),
  createdAt: varchar('created_at', { length: 32 }).notNull(),
  updatedAt: varchar('updated_at', { length: 32 }).notNull(),
  deletedAt: varchar('deleted_at', { length: 32 }),
})
