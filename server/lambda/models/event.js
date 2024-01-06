"use strict";

module.exports = function(sequelize, DataTypes) {
  var Event = sequelize.define("Event", {
    uuid: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4
    },
    isViewed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },

    //Image file metadata
    imageFilename: {
      type: DataTypes.STRING
    },
    recordingStartTime: {
      type: DataTypes.DATE      
    },
    confidence: {
      type: DataTypes.INTEGER
    },
    imageWidth: {
      type: DataTypes.INTEGER
    },
    imageHeight: {
      type: DataTypes.INTEGER
    },

    //Video file metadata
    videoFilename: {
      type: DataTypes.STRING
    },
    model: {
      type: DataTypes.STRING
    },
    frameRate: {
      type: DataTypes.INTEGER      
    },
    confidenceThreshold: {
      type: DataTypes.FLOAT
    },
    duration: {
      type: DataTypes.INTEGER
    },
    maxPeopleFound: {
      type: DataTypes.INTEGER
    },
    maxConfidence: {
      type: DataTypes.INTEGER
    },
    inferenceTime: {
      type: DataTypes.INTEGER
    },
    videoWidth: {
      type: DataTypes.INTEGER
    },
    videoHeight: {
      type: DataTypes.INTEGER
    }
  }, {
    paranoid: true
  });

  //Class Method
  Event.associate = function (models) {
    Event.belongsTo(models.Camera);
    Event.hasMany(models.Notification);
  };
  
  return Event;
};