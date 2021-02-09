DROP TABLE IF EXISTS `articles`;
CREATE TABLE `articles` (
  `id` bigint(20) AUTO_INCREMENT PRIMARY KEY,
  `gmt_create` timestamp(3) NULL,
  `gmt_modified` timestamp(3) NULL,
  `gmt_deleted` timestamp(3) NULL,
  `title` varchar(1000) NOT NULL,
  `content` text,
  `extra` text,
  `thumb` varchar(1000) DEFAULT NULL,
  `author_id` bigint(20) DEFAULT NULL,
  `is_private` tinyint(1) DEFAULT 0
);

DROP TABLE IF EXISTS `attachments`;
CREATE TABLE `attachments` (
  `id` bigint(20) AUTO_INCREMENT PRIMARY KEY,
  `gmt_create` timestamp(3) NULL,
  `gmt_modified` timestamp(3) NULL,
  `article_id` bigint(20) NOT NULL,
  `url` varchar(1000) DEFAULT NULL,
  `gmt_deleted` timestamp(3) NULL
);

DROP TABLE IF EXISTS `books`;
CREATE TABLE `books` (
  `isbn` bigint(20) AUTO_INCREMENT PRIMARY KEY,
  `gmt_create` timestamp(3) NULL,
  `gmt_modified` timestamp(3) NULL,
  `name` varchar(1000) NOT NULL,
  `price` decimal(10, 3) NOT NULL,
  `gmt_deleted` timestamp(3) NULL
);

DROP TABLE IF EXISTS `comments`;
CREATE TABLE `comments` (
  `id` bigint(20) AUTO_INCREMENT PRIMARY KEY,
  `gmt_create` timestamp(3) NULL,
  `gmt_modified` timestamp(3) NULL,
  `gmt_deleted` timestamp(3) NULL,
  `content` varchar(2000) NOT NULL,
  `article_id` bigint(20) NOT NULL
);

DROP TABLE IF EXISTS `tag_maps`;
CREATE TABLE `tag_maps` (
  `id` bigint(20) AUTO_INCREMENT PRIMARY KEY,
  `gmt_create` timestamp(3) NULL,
  `gmt_modified` timestamp(3) NULL,
  `target_id` bigint(20) NOT NULL,
  `target_type` bigint(20) NOT NULL,
  `tag_id` bigint(20) NOT NULL
);

DROP TABLE IF EXISTS `tags`;
CREATE TABLE `tags` (
  `id` bigint(20) AUTO_INCREMENT PRIMARY KEY,
  `gmt_create` timestamp(3) NULL,
  `gmt_modified` timestamp(3) NULL,
  `name` varchar(255) NOT NULL,
  `type` smallint(8) NOT NULL,
  `gmt_deleted` timestamp(3) NULL
);

DROP TABLE IF EXISTS `likes`;
CREATE TABLE `likes` (
  `id` bigint(20) AUTO_INCREMENT PRIMARY KEY,
  `gmt_create` timestamp(3) NULL,
  `article_id` bigint(20) NOT NULL,
  `user_id` bigint(20) NOT NULL,
  `gmt_deleted` timestamp(3) NULL
);

DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` bigint(20) AUTO_INCREMENT PRIMARY KEY,
  `gmt_create` timestamp(3) NULL,
  `email` varchar(256) NOT NULL UNIQUE,
  `nickname` varchar(256) NOT NULL,
  `meta` text,
  `status` int NOT NULL,
  `fingerprint` text,
  `desc` text,
  `level` decimal(10, 3) NOT NULL DEFAULT 1
);
