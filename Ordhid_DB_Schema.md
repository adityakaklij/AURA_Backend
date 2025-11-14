Exisitng database schema for the current databse

``` sql
CREATE TABLE `point_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`profile_id` integer NOT NULL,
	`rule_key` text NOT NULL,
	`delta` integer NOT NULL,
	`source_id` text NOT NULL,
	`evidence` text,
	`created_at` text NOT NULL,
	CONSTRAINT `fk_point_events_profile_id_profiles_id_fk` FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`)
);
CREATE TABLE `point_rules` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`key` text NOT NULL,
	`points` integer NOT NULL,
	`cooldown_seconds` integer DEFAULT 0 NOT NULL,
	`max_times` integer,
	`active` integer DEFAULT true NOT NULL,
	`metadata` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
CREATE TABLE `profiles` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`wallet_address` text,
	`farcaster_fid` integer,
	`ens_name` text,
	`base_name` text,
	`display_name` text NOT NULL,
	`avatar_url` text,
	`referral_code` text NOT NULL,
	`referred_by` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `fk_profiles_referred_by_profiles_id_fk` FOREIGN KEY (`referred_by`) REFERENCES `profiles`(`id`)
);
CREATE TABLE `referrals` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`referrer_id` integer NOT NULL,
	`referee_id` integer NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `fk_referrals_referee_id_profiles_id_fk` FOREIGN KEY (`referee_id`) REFERENCES `profiles`(`id`),
	CONSTRAINT `fk_referrals_referrer_id_profiles_id_fk` FOREIGN KEY (`referrer_id`) REFERENCES `profiles`(`id`)
);
CREATE TABLE `scores` (
	`profile_id` integer PRIMARY KEY,
	`total_points` integer DEFAULT 0 NOT NULL,
	CONSTRAINT `fk_scores_profile_id_profiles_id_fk` FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`)
);
CREATE TABLE `waitlist_positions` (
	`profile_id` integer PRIMARY KEY,
	`position` integer NOT NULL,
	CONSTRAINT `fk_waitlist_positions_profile_id_profiles_id_fk` FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`)
);
CREATE UNIQUE INDEX `idx_point_events_rule_source` ON `point_events` (`rule_key`,`source_id`);
CREATE UNIQUE INDEX `point_rules_key_unique` ON `point_rules` (`key`);
CREATE UNIQUE INDEX `profiles_referral_code_unique` ON `profiles` (`referral_code`);
CREATE UNIQUE INDEX `profiles_farcaster_fid_unique` ON `profiles` (`farcaster_fid`);
CREATE UNIQUE INDEX `profiles_wallet_address_unique` ON `profiles` (`wallet_address`);
CREATE INDEX `idx_scores_total_points` ON `scores` (`total_points`);
```