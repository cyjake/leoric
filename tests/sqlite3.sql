DROP TABLE IF EXISTS `articles`;
CREATE TABLE `articles` (
  `id` bigint(20) PRIMARY KEY,
  `gmt_create` datetime NOT NULL,
  `gmt_modified` datetime NOT NULL,
  `gmt_deleted` datetime DEFAULT NULL,
  `title` varchar(1000) NOT NULL,
  `content` text,
  `extra` text,
  `thumb` varchar(1000) DEFAULT NULL,
  `author_id` bigint(20) DEFAULT NULL,
  `is_private`tinyint(1) DEFAULT 0
);

DROP TABLE IF EXISTS `attachments`;
CREATE TABLE `attachments` (
  `id` bigint(20) PRIMARY KEY,
  `gmt_create` datetime NOT NULL,
  `gmt_modified` datetime NOT NULL,
  `article_id` bigint(20) NOT NULL,
  `url` varchar(1000) DEFAULT NULL,
  `gmt_deleted` datetime DEFAULT NULL
);

DROP TABLE IF EXISTS `books`;
CREATE TABLE `books` (
  `isbn` bigint(20) PRIMARY KEY,
  `gmt_create` datetime NOT NULL,
  `gmt_modified` datetime NOT NULL,
  `name` varchar(1000) NOT NULL,
  `price` decimal(10, 3) NOT NULL
);

DROP TABLE IF EXISTS `comments`;
CREATE TABLE `comments` (
  `id` bigint(20) PRIMARY KEY,
  `gmt_create` datetime NOT NULL,
  `gmt_modified` datetime NOT NULL,
  `gmt_deleted` datetime DEFAULT NULL,
  `content` varchar(2000) NOT NULL,
  `article_id` bigint(20) NOT NULL
);

DROP TABLE IF EXISTS `tag_maps`;
CREATE TABLE `tag_maps` (
  `id` bigint(20) PRIMARY KEY,
  `gmt_create` datetime NOT NULL,
  `gmt_modified` datetime NOT NULL,
  `target_id` bigint(20) NOT NULL,
  `target_type` bigint(20) NOT NULL,
  `tag_id` bigint(20) NOT NULL
);

DROP TABLE IF EXISTS `tags`;
CREATE TABLE `tags` (
  `id` bigint(20) PRIMARY KEY,
  `gmt_create` datetime NOT NULL,
  `gmt_modified` datetime NOT NULL,
  `name` varchar(255) NOT NULL,
  `type` smallint(8) NOT NULL,
  `gmt_deleted` datetime DEFAULT NULL
);

