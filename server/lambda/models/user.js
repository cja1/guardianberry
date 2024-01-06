"use strict";

module.exports = function(sequelize, DataTypes) {
  var User = sequelize.define("User", {
    uuid: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4
    },
    cognitoId: {
      type: DataTypes.STRING,
    },
    name: {
      type: DataTypes.STRING,
    },
    isAdmin: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    mobile: {
      type: DataTypes.STRING,
    },
    sendNotifications: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    locale: {
      type: DataTypes.STRING,
    },
    timezone: {
      type: DataTypes.STRING,
    }
  }, {
    paranoid: true
  });

  //Class Method
  User.associate = function (models) {
    User.belongsTo(models.Home);
    User.hasMany(models.Notification)
  };

  return User;
};
