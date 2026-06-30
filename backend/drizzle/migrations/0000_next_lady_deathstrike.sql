CREATE TABLE `agent_configs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agent_type` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`model` varchar(255),
	`system_prompt` text,
	`temperature` double,
	`max_tokens` int,
	`max_iterations` int,
	`is_active` boolean DEFAULT true,
	`created_at` varchar(32) NOT NULL,
	`updated_at` varchar(32) NOT NULL,
	`deleted_at` varchar(32),
	CONSTRAINT `agent_configs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_service_configs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`service_type` varchar(255) NOT NULL,
	`provider` varchar(255),
	`name` varchar(255) NOT NULL,
	`base_url` text NOT NULL,
	`api_key` text NOT NULL,
	`model` varchar(255),
	`endpoint` text,
	`query_endpoint` text,
	`priority` int DEFAULT 0,
	`is_default` boolean DEFAULT false,
	`is_active` boolean DEFAULT true,
	`settings` text,
	`created_at` varchar(32) NOT NULL,
	`updated_at` varchar(32) NOT NULL,
	CONSTRAINT `ai_service_configs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_service_providers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`display_name` varchar(255),
	`service_type` varchar(255) NOT NULL,
	`provider` varchar(255) NOT NULL,
	`default_url` text,
	`preset_models` text,
	`description` text,
	`is_active` boolean DEFAULT true,
	`created_at` varchar(32) NOT NULL,
	`updated_at` varchar(32) NOT NULL,
	CONSTRAINT `ai_service_providers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_voices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`voice_id` varchar(255) NOT NULL,
	`voice_name` varchar(255) NOT NULL,
	`description` text,
	`language` varchar(255),
	`provider` varchar(255) NOT NULL,
	`created_at` varchar(32) NOT NULL,
	CONSTRAINT `ai_voices_id` PRIMARY KEY(`id`),
	CONSTRAINT `ai_voices_voice_id_unique` UNIQUE(`voice_id`)
);
--> statement-breakpoint
CREATE TABLE `assets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`drama_id` int,
	`episode_id` int,
	`storyboard_id` int,
	`storyboard_num` int,
	`name` varchar(255),
	`description` text,
	`type` varchar(255),
	`category` varchar(255),
	`url` text,
	`thumbnail_url` text,
	`local_path` text,
	`file_size` int,
	`mime_type` varchar(255),
	`width` int,
	`height` int,
	`duration` int,
	`format` varchar(255),
	`image_gen_id` int,
	`video_gen_id` int,
	`is_favorite` boolean DEFAULT false,
	`view_count` int DEFAULT 0,
	`created_at` varchar(32) NOT NULL,
	`updated_at` varchar(32) NOT NULL,
	`deleted_at` varchar(32),
	CONSTRAINT `assets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `characters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`drama_id` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`role` varchar(255),
	`description` text,
	`appearance` text,
	`personality` text,
	`voice_style` varchar(255),
	`image_url` text,
	`reference_images` text,
	`seed_value` varchar(255),
	`sort_order` int,
	`local_path` text,
	`voice_sample_url` text,
	`voice_provider` varchar(255),
	`created_at` varchar(32) NOT NULL,
	`updated_at` varchar(32) NOT NULL,
	`deleted_at` varchar(32),
	CONSTRAINT `characters_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dramas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`genre` varchar(255),
	`style` varchar(255) DEFAULT 'realistic',
	`total_episodes` int DEFAULT 1,
	`total_duration` int DEFAULT 0,
	`status` varchar(255) NOT NULL DEFAULT 'draft',
	`thumbnail` text,
	`tags` text,
	`metadata` text,
	`created_at` varchar(32) NOT NULL,
	`updated_at` varchar(32) NOT NULL,
	`deleted_at` varchar(32),
	CONSTRAINT `dramas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `episode_characters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`episode_id` int NOT NULL,
	`character_id` int NOT NULL,
	`created_at` varchar(32) NOT NULL,
	CONSTRAINT `episode_characters_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `episode_scenes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`episode_id` int NOT NULL,
	`scene_id` int NOT NULL,
	`created_at` varchar(32) NOT NULL,
	CONSTRAINT `episode_scenes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `episodes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`drama_id` int NOT NULL,
	`episode_number` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` text,
	`script_content` text,
	`description` text,
	`duration` int DEFAULT 0,
	`status` varchar(255) DEFAULT 'draft',
	`video_url` text,
	`thumbnail` text,
	`image_config_id` int,
	`video_config_id` int,
	`audio_config_id` int,
	`created_at` varchar(32) NOT NULL,
	`updated_at` varchar(32) NOT NULL,
	`deleted_at` varchar(32),
	CONSTRAINT `episodes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `image_generations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storyboard_id` int,
	`drama_id` int,
	`scene_id` int,
	`character_id` int,
	`prop_id` int,
	`image_type` varchar(255),
	`frame_type` varchar(255),
	`provider` varchar(255),
	`prompt` text,
	`negative_prompt` text,
	`model` varchar(255),
	`size` varchar(255),
	`quality` varchar(255),
	`style` varchar(255),
	`steps` int,
	`cfg_scale` double,
	`seed` int,
	`image_url` text,
	`minio_url` text,
	`local_path` text,
	`status` varchar(255) DEFAULT 'pending',
	`task_id` varchar(255),
	`error_msg` text,
	`width` int,
	`height` int,
	`reference_images` text,
	`created_at` varchar(32) NOT NULL,
	`updated_at` varchar(32) NOT NULL,
	`completed_at` varchar(32),
	CONSTRAINT `image_generations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `props` (
	`id` int AUTO_INCREMENT NOT NULL,
	`drama_id` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`type` varchar(255),
	`description` text,
	`prompt` text,
	`image_url` text,
	`reference_images` text,
	`local_path` text,
	`created_at` varchar(32) NOT NULL,
	`updated_at` varchar(32) NOT NULL,
	`deleted_at` varchar(32),
	CONSTRAINT `props_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scenes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`drama_id` int NOT NULL,
	`episode_id` int,
	`location` text NOT NULL,
	`time` varchar(255) NOT NULL,
	`prompt` text NOT NULL,
	`storyboard_count` int DEFAULT 1,
	`image_url` text,
	`status` varchar(255) DEFAULT 'pending',
	`local_path` text,
	`created_at` varchar(32) NOT NULL,
	`updated_at` varchar(32) NOT NULL,
	`deleted_at` varchar(32),
	CONSTRAINT `scenes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `storyboard_characters` (
	`storyboard_id` int NOT NULL,
	`character_id` int NOT NULL,
	CONSTRAINT `storyboard_characters_storyboard_id_character_id_pk` PRIMARY KEY(`storyboard_id`,`character_id`)
);
--> statement-breakpoint
CREATE TABLE `storyboards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`episode_id` int NOT NULL,
	`scene_id` int,
	`storyboard_number` int NOT NULL,
	`title` varchar(255),
	`location` text,
	`time` varchar(255),
	`shot_type` varchar(255),
	`angle` varchar(255),
	`movement` varchar(255),
	`action` text,
	`result` text,
	`atmosphere` text,
	`image_prompt` text,
	`video_prompt` text,
	`bgm_prompt` text,
	`sound_effect` text,
	`dialogue` text,
	`description` text,
	`duration` int DEFAULT 0,
	`composed_image` text,
	`first_frame_image` text,
	`last_frame_image` text,
	`reference_images` text,
	`video_url` text,
	`tts_audio_url` text,
	`subtitle_url` text,
	`composed_video_url` text,
	`status` varchar(255) DEFAULT 'pending',
	`created_at` varchar(32) NOT NULL,
	`updated_at` varchar(32) NOT NULL,
	`deleted_at` varchar(32),
	CONSTRAINT `storyboards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `video_generations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storyboard_id` int,
	`drama_id` int,
	`provider` varchar(255),
	`prompt` text,
	`model` varchar(255),
	`image_gen_id` int,
	`reference_mode` varchar(255),
	`image_url` text,
	`first_frame_url` text,
	`last_frame_url` text,
	`reference_image_urls` text,
	`duration` int,
	`fps` int,
	`resolution` varchar(255),
	`aspect_ratio` varchar(255),
	`style` varchar(255),
	`motion_level` int,
	`camera_motion` varchar(255),
	`seed` int,
	`video_url` text,
	`minio_url` text,
	`local_path` text,
	`status` varchar(255) DEFAULT 'pending',
	`task_id` varchar(255),
	`error_msg` text,
	`width` int,
	`height` int,
	`created_at` varchar(32) NOT NULL,
	`updated_at` varchar(32) NOT NULL,
	`completed_at` varchar(32),
	`deleted_at` varchar(32),
	CONSTRAINT `video_generations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `video_merges` (
	`id` int AUTO_INCREMENT NOT NULL,
	`episode_id` int,
	`drama_id` int,
	`title` varchar(255),
	`provider` varchar(255),
	`model` varchar(255),
	`status` varchar(255) DEFAULT 'pending',
	`scenes` text,
	`merged_url` text,
	`duration` int,
	`task_id` varchar(255),
	`error_msg` text,
	`created_at` varchar(32) NOT NULL,
	`completed_at` varchar(32),
	`deleted_at` varchar(32),
	CONSTRAINT `video_merges_id` PRIMARY KEY(`id`)
);
