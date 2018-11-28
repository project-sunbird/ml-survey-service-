/**
 * Project          : Shikshalokam-Assessment
 * Module           : Configuration
 * Source filename  : index.js
 * Description      : Environment related configuration variables
 * Copyright        : Copyright © 2018
 *                    Written under contract by Above Solutions Pvt. Ltd.
 * Author           : Yogesh Sinoriya <yogesh.sinoriya@above-inc.com>
 */

let db_connect = function(configData) {
  global.database = require("./dbConfig")(
    configData.DB_Config.connection.mongodb
  );
  global.ObjectId = database.ObjectId;
  global.Abstract = require("../generics/abstract");
};

const configuration = {
  root: require("path").normalize(__dirname + "/.."),
  app: {
    name: "sl-assessment-api"
  },
  host: process.env.HOST || "http://localhost",
  port: process.env.PORT || 4201,
  log: process.env.LOG || "debug",
  DB_Config: {
    connection: {
      mongodb: {
        host: process.env.MONGODB_URL || "mongodb://localhost:27017",
        user: "",
        pass: "",
        database: process.env.DB || "sl-assessment",
        options: {
          useNewUrlParser: true
        }
      }
    },
    plugins: {
      timestamps: true,
      elasticSearch: false,
      softDelete: true,
      autoPopulate: false,
      timestamps_fields: {
        createdAt: "createdAt",
        updatedAt: "updatedAt"
      }
    }
  },
  version: "0.0.1",
  URLPrefix: "/api/v1",
  webUrl: "https://dev.shikshalokam.org"
};

db_connect(configuration);

module.exports = configuration;