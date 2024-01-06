/*
GuardianBerry database structure
*/

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for Homes
-- ----------------------------
DROP TABLE IF EXISTS `Homes`;
CREATE TABLE `Homes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uuid` char(36) COLLATE utf8_bin DEFAULT NULL,
  `name` varchar(255) COLLATE utf8_bin DEFAULT NULL,

  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `deletedAt` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8 COLLATE=utf8_bin;

-- ----------------------------
-- Table structure for Cameras
-- ----------------------------
DROP TABLE IF EXISTS `Cameras`;
CREATE TABLE `Cameras` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uuid` char(36) COLLATE utf8_bin DEFAULT NULL,
  `name` varchar(255) COLLATE utf8_bin DEFAULT NULL,
  `rpiSerialNo` varchar(20) COLLATE utf8_bin DEFAULT NULL,

  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `deletedAt` datetime DEFAULT NULL,
  
  `HomeId` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8 COLLATE=utf8_bin;

-- ----------------------------
-- Table structure for Events
-- ----------------------------
DROP TABLE IF EXISTS `Events`;
CREATE TABLE `Events` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uuid` char(36) COLLATE utf8_bin DEFAULT NULL,

  -- Image file metadata
  `imageFilename` varchar(255) COLLATE utf8_bin DEFAULT NULL,
  `recordingStartTime` datetime DEFAULT NULL,
  `confidence` int(11) DEFAULT NULL,
  `imageWidth` int(11) DEFAULT NULL,
  `imageHeight` int(11) DEFAULT NULL,

  -- Video file metadata
  `videoFilename` varchar(255) COLLATE utf8_bin DEFAULT NULL,
  `model` varchar(255) COLLATE utf8_bin DEFAULT NULL,
  `frameRate` int(11) DEFAULT NULL,
  `confidenceThreshold` float DEFAULT NULL,
  `duration` int(11) DEFAULT NULL,
  `maxPeopleFound` int(11) DEFAULT NULL,
  `maxConfidence` int(11) DEFAULT NULL,
  `inferenceTime` int(11) DEFAULT NULL,
  `videoWidth` int(11) DEFAULT NULL,
  `videoHeight` int(11) DEFAULT NULL,

  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `deletedAt` datetime DEFAULT NULL,

  `CameraId` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8 COLLATE=utf8_bin;

-- ----------------------------
-- Table structure for Users
-- ----------------------------
DROP TABLE IF EXISTS `Users`;
CREATE TABLE `Users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uuid` char(36) COLLATE utf8_bin DEFAULT NULL,
  `name` varchar(255) COLLATE utf8_bin DEFAULT NULL,
  `mobile` varchar(20) COLLATE utf8_bin DEFAULT NULL,
  `sendNotifications` tinyint(1) DEFAULT '0',
  `locale` varchar(20) COLLATE utf8_bin DEFAULT NULL,
  `timezone` varchar(255) COLLATE utf8_bin DEFAULT NULL,

  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `deletedAt` datetime DEFAULT NULL,

  `HomeId` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8 COLLATE=utf8_bin;

-- ----------------------------
-- Table structure for Notifications
-- ----------------------------
DROP TABLE IF EXISTS `Notifications`;
CREATE TABLE `Notifications` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uuid` char(36) COLLATE utf8_bin DEFAULT NULL,
  `message` varchar(255) COLLATE utf8_bin DEFAULT NULL,

  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `deletedAt` datetime DEFAULT NULL,

  `UserId` int(11) DEFAULT NULL,
  `EventId` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8 COLLATE=utf8_bin;

SET FOREIGN_KEY_CHECKS = 1;
