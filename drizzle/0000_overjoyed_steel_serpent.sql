CREATE TABLE `approval_records` (
	`id` text PRIMARY KEY NOT NULL,
	`draft_id` text NOT NULL,
	`user_id` text NOT NULL,
	`revision` integer NOT NULL,
	`source_version` text NOT NULL,
	`content_hash` text NOT NULL,
	`record` text NOT NULL,
	`approved_at` text NOT NULL,
	FOREIGN KEY (`draft_id`) REFERENCES `dispatch_drafts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `dispatch_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`revision` integer NOT NULL,
	`source_version` text NOT NULL,
	`content` text NOT NULL,
	`content_hash` text NOT NULL,
	`approval` text,
	`generation` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `export_records` (
	`id` text PRIMARY KEY NOT NULL,
	`draft_id` text NOT NULL,
	`user_id` text NOT NULL,
	`revision` integer NOT NULL,
	`source_version` text NOT NULL,
	`content_hash` text NOT NULL,
	`package_hash` text NOT NULL,
	`metadata` text NOT NULL,
	`exported_at` text NOT NULL,
	FOREIGN KEY (`draft_id`) REFERENCES `dispatch_drafts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `generation_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`source_version` text NOT NULL,
	`session_id` text NOT NULL,
	`editorial_hash` text NOT NULL,
	`metadata` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `request_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`calls` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `source_snapshots` (
	`version` text PRIMARY KEY NOT NULL,
	`snapshot` text NOT NULL,
	`fetched_at` text NOT NULL,
	`source_url` text NOT NULL,
	`mode` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `source_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`current_version` text NOT NULL,
	FOREIGN KEY (`current_version`) REFERENCES `source_snapshots`(`version`) ON UPDATE no action ON DELETE no action
);
