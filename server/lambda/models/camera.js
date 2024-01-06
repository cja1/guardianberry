"use strict";

module.exports = function(sequelize, DataTypes) {
  var Camera = sequelize.define("Camera", {
    uuid: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4
    },
    name: {
      type: DataTypes.STRING,
    },
    rpiSerialNo: {
      type: DataTypes.STRING,
    }
  }, {
    paranoid: true
  });

  //Class Method
  Camera.associate = function (models) {
    Camera.hasMany(models.Event);
    Camera.belongsTo(models.Home);
  };

  return Camera;
};
