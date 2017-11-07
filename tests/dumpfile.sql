CREATE DATABASE IF NOT EXISTS leoric;

USE leoric;

DROP TABLE IF EXISTS `articles`;
CREATE TABLE `articles` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `gmt_create` datetime NOT NULL,
  `gmt_modified` datetime NOT NULL,
  `gmt_deleted` datetime DEFAULT NULL,
  `title` varchar(1000) NOT NULL,
  `content` text,
  `extra` text,
  `thumb` varchar(1000) DEFAULT NULL,
  `author_id` bigint(20) unsigned DEFAULT NULL,
  PRIMARY KEY (`id`)
);

DROP TABLE IF EXISTS `attachments`;
CREATE TABLE `attachments` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `gmt_create` datetime NOT NULL,
  `gmt_modified` datetime NOT NULL,
  `article_id` bigint(20) unsigned NOT NULL,
  `url` varchar(1000) DEFAULT NULL,
  `gmt_deleted` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
);

DROP TABLE IF EXISTS `books`;
CREATE TABLE `books` (
  `isbn` bigint(20) unsigned NOT NULL,
  `gmt_create` datetime NOT NULL,
  `gmt_modified` datetime NOT NULL,
  `name` varchar(1000) NOT NULL,
  PRIMARY KEY (`isbn`)
);

DROP TABLE IF EXISTS `comments`;
CREATE TABLE `comments` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `gmt_create` datetime NOT NULL,
  `gmt_modified` datetime NOT NULL,
  `gmt_deleted` datetime DEFAULT NULL,
  `content` varchar(2000) NOT NULL,
  `article_id` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`id`)
);

DROP TABLE IF EXISTS `tag_maps`;
CREATE TABLE `tag_maps` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `gmt_create` datetime NOT NULL,
  `gmt_modified` datetime NOT NULL,
  `target_id` bigint(20) unsigned NOT NULL,
  `target_type` bigint(20) unsigned NOT NULL,
  `tag_id` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`id`)
);

DROP TABLE IF EXISTS `tags`;
CREATE TABLE `tags` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `gmt_create` datetime NOT NULL,
  `gmt_modified` datetime NOT NULL,
  `name` varchar(255) NOT NULL,
  `gmt_deleted` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
);

