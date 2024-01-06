"use strict";

module.exports = function(sequelize, DataTypes) {
  var Home = sequelize.define("Home", {
    uuid: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4
    },
    name: {
      type: DataTypes.STRING,
    }
  }, {
    paranoid: true
  });

  //Class Method
  Home.associate = function (models) {
    Home.hasMany(models.User);
    Home.hasMany(models.Camera);
  };

  return Home;
};
