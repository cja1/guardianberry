"use strict";

module.exports = function(sequelize, DataTypes) {
  var Notification = sequelize.define("Notification", {
    uuid: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4
    },
    message: {
      type: DataTypes.STRING,
    }
  }, {
    paranoid: true
  });

  //Class Method
  Notification.associate = function (models) {
    Notification.belongsTo(models.User);
    Notification.belongsTo(models.Event);
  };

  return Notification;
};
