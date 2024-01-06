import { readdirSync } from "fs";
import path from "path";
import { basename, dirname } from "path";
import { Sequelize, DataTypes } from "sequelize";
import { fileURLToPath } from "url";

const config    = { "host": process.env.host, "dialect": "mysql", "logging": false };
var sequelize = new Sequelize(process.env.database, process.env.username, process.env.password, config);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const db = {};

const files = readdirSync(__dirname).filter(
  (file) =>
    file.indexOf(".") !== 0 &&
    file !== basename(__filename) &&
    file.slice(-3) === ".js"
);

for (const file of files) {
  const model = await import(__dirname + '/' + file);
  const namedModel = await model.default(sequelize, DataTypes);
  db[namedModel.name] = namedModel;
}

Object.keys(db).forEach((modelName) => {
  if (modelName) {
    if (db[modelName].associate) {
      db[modelName].associate(db);
    }
  }
});
db.sequelize = sequelize;
db.Sequelize = Sequelize;

export default db
