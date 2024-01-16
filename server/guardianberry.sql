/*
GuardianBerry database structure
Created by Charles Allen for UOL CM3070 Final Project
*/

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for Homes
-- ----------------------------
DROP TABLE IF EXISTS `Homes`;
CREATE TABLE `Homes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `uuid` char(36) COLLATE utf8mb3_bin DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb3_bin DEFAULT NULL,

  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `deletedAt` datetime DEFAULT NULL,

  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_bin;

-- ----------------------------
-- Table structure for Cameras
-- ----------------------------
DROP TABLE IF EXISTS `Cameras`;
CREATE TABLE `Cameras` (
  `id` int NOT NULL AUTO_INCREMENT,
  `uuid` char(36) COLLATE utf8mb3_bin DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb3_bin DEFAULT NULL,
  `rpiSerialNo` varchar(20) COLLATE utf8mb3_bin DEFAULT NULL,

  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `deletedAt` datetime DEFAULT NULL,

  `HomeId` int DEFAULT NULL,

  PRIMARY KEY (`id`),
  KEY `HomeId` (`HomeId`) USING BTREE,
  KEY `uuid` (`uuid`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_bin;

-- ----------------------------
-- Table structure for Events
-- ----------------------------
DROP TABLE IF EXISTS `Events`;
CREATE TABLE `Events` (
  `id` int NOT NULL AUTO_INCREMENT,
  `uuid` char(36) COLLATE utf8mb3_bin DEFAULT NULL,
  `isViewed` tinyint(1) DEFAULT '0',

  --  Image file metadata
  `imageFilename` varchar(255) COLLATE utf8mb3_bin DEFAULT NULL,
  `recordingStartTime` datetime DEFAULT NULL,
  `confidence` int DEFAULT NULL,
  `imageWidth` int DEFAULT NULL,
  `imageHeight` int DEFAULT NULL,

  --  Video file metadata
  `videoFilename` varchar(255) COLLATE utf8mb3_bin DEFAULT NULL,
  `model` varchar(255) COLLATE utf8mb3_bin DEFAULT NULL,
  `frameRate` int DEFAULT NULL,
  `confidenceThreshold` float DEFAULT NULL,
  `duration` int DEFAULT NULL,
  `maxPeopleFound` int DEFAULT NULL,
  `maxConfidence` int DEFAULT NULL,
  `inferenceTime` int DEFAULT NULL,
  `videoWidth` int DEFAULT NULL,
  `videoHeight` int DEFAULT NULL,

  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `deletedAt` datetime DEFAULT NULL,

  `CameraId` int DEFAULT NULL,

  PRIMARY KEY (`id`),
  KEY `CameraId` (`CameraId`) USING BTREE,
  KEY `uuid` (`uuid`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_bin;

-- ----------------------------
-- Table structure for Users
-- ----------------------------
DROP TABLE IF EXISTS `Users`;
CREATE TABLE `Users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `uuid` char(36) COLLATE utf8mb3_bin DEFAULT NULL,
  `cognitoId` varchar(255) COLLATE utf8mb3_bin DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb3_bin DEFAULT NULL,
  `isAdmin` tinyint(1) DEFAULT '0',
  `mobile` varchar(20) COLLATE utf8mb3_bin DEFAULT NULL,
  `sendNotifications` tinyint(1) DEFAULT '0',
  `locale` varchar(20) COLLATE utf8mb3_bin DEFAULT NULL,
  `timezone` varchar(255) COLLATE utf8mb3_bin DEFAULT NULL,

  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `deletedAt` datetime DEFAULT NULL,

  `HomeId` int DEFAULT NULL,

  PRIMARY KEY (`id`),
  KEY `HomeId` (`HomeId`) USING BTREE,
  KEY `uuid` (`uuid`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_bin;

-- ----------------------------
-- Table structure for Notifications
-- ----------------------------
DROP TABLE IF EXISTS `Notifications`;
CREATE TABLE `Notifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `uuid` char(36) COLLATE utf8mb3_bin DEFAULT NULL,
  `message` varchar(255) COLLATE utf8mb3_bin DEFAULT NULL,

  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `deletedAt` datetime DEFAULT NULL,

  `UserId` int DEFAULT NULL,
  `EventId` int DEFAULT NULL,

  PRIMARY KEY (`id`),
  KEY `UserId` (`UserId`) USING BTREE,
  KEY `EventId` (`EventId`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_bin;


SET FOREIGN_KEY_CHECKS = 1;
