const path = require("path");
let rootPath = path.join(__dirname, "../../");
require("dotenv").config({ path: rootPath + "/.env" });
const { validate: uuidValidate, v4: uuidV4 } = require("uuid");
global.MODULES_BASE_PATH = rootPath + "/module";
const UserRolesHelper = require(MODULES_BASE_PATH + "/userRoles/helper");
let _ = require("lodash");
let mongoUrl = process.env.MONGODB_URL;
let dbName = mongoUrl.split("/").pop();
let url = mongoUrl.split(dbName)[0];
var MongoClient = require("mongodb").MongoClient;
const csv = require("csvtojson");
const filePath = process.argv[2];
var fs = require("fs");
//config and routes
require("../../config");
require("../../config/globalVariable")();

function generateUUId() {
  return uuidV4();
}
(async () => {
  if (!filePath) {
    console.error("Please provide a file path");
    process.exit(1);
  }
  let connection = await MongoClient.connect(url, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  let db = connection.db(dbName);
  try {
    // Convert CSV file to JSON
    const extractedCsvData = await csv().fromFile(filePath);
    if (extractedCsvData.length > 0) {
      let newRolesToCreate = [];
      // Loop through CSV data to check for new roles to create
      for (let i = 0; i < extractedCsvData.length; i++) {
        if (extractedCsvData[i].newRoleCode) {
          let newRoleCode = extractedCsvData[i].newRoleCode;
          let roleToUpdate = await db
            .collection("userRoles")
            .find({ code: newRoleCode })
            .toArray();

          if (!(roleToUpdate.length > 0)) {
            let roleData = {
              code: newRoleCode,
              entityTypes: extractedCsvData[i].mandatoryEntityTypes,
              title: extractedCsvData[i].title,
            };
            // Check if the role is already in the newRolesToCreate array
            let roleExists = newRolesToCreate.some(
              (role) => role.code === newRoleCode
            );
            if (!roleExists) {
              newRolesToCreate.push(roleData);
            }
          }
        }
      }

      // Create new roles in the database
      let roleCreationResponse = await UserRolesHelper.bulkCreate(
        newRolesToCreate
      );

      // Loop through CSV data to check for old roles to update mandatoryFields
      let oldRolesToUpdate = [];

      for (let i = 0; i < extractedCsvData.length; i++) {
        if (
          extractedCsvData[i].oldRoleCode &&
          extractedCsvData[i].oldRoleCode.length > 0 &&
          extractedCsvData[i].newRoleCode.length > 0
        ) {
          let oldRoleCode = extractedCsvData[i].oldRoleCode;

          let roleToUpdate = await db
            .collection("userRoles")
            .find({ code: oldRoleCode })
            .toArray();
          //Check role is already exits in db or not
          if (roleToUpdate.length > 0) {
            let mandatoryEntityTypes =
              extractedCsvData[i].mandatoryEntityTypes.split(",");
            let updatedDocument;
            for (let entityType of mandatoryEntityTypes) {
              // Check if the entityType is already exits in the userRoles document
              const existingDocument = await db
                .collection("userRoles")
                .findOne({
                  code: oldRoleCode,
                  "entityTypes.entityType": entityType,
                });
              // if not then add the entityType to the userRoles document
              if (!existingDocument && entityType.length > 0) {
                //Getting entityTypeId to update
                const getTheEntityTypeId = await db
                  .collection("entityTypes")
                  .findOne(
                    { name: entityType },
                    {
                      projection: { _id: 1, name: 1 },
                    }
                  );
                // updating the new mandatoryEntityTypes in userRoles documents
                updatedDocument = await db
                  .collection("userRoles")
                  .findOneAndUpdate(
                    { code: oldRoleCode },
                    {
                      $addToSet: {
                        entityTypes: {
                          entityType: entityType,
                          entityTypeId: getTheEntityTypeId._id,
                        },
                      },
                    },
                    {
                      returnDocument: "after",
                      projection: {
                        _id: 1,
                        code: 1,
                        title: 1,
                        entityTypes: 1,
                      },
                    }
                  );
              }
            }
            if (updatedDocument && updatedDocument.value) {
              oldRolesToUpdate.push(updatedDocument.value);
            }
          }
        }
      }

      let updatedSolutions = [];
      let updatedPrograms = [];

      // updating solutions and programs

      for (let j = 0; j < extractedCsvData.length; j++) {
        let roleUpdateinScope = extractedCsvData[j];

        if (
          extractedCsvData[j].oldRoleCode.length > 0 &&
          extractedCsvData[j].newRoleCode.length > 0
        ) {
          // Retrieve the role's ID and code for update
          let roleToUpdate = await db
            .collection("userRoles")
            .findOne(
              { code: roleUpdateinScope.newRoleCode },
              { projection: { _id: 1, code: 1 } }
            );

          let matchQuery = {
            "scope.roles.code": roleUpdateinScope.oldRoleCode,
          };

          let updatedRole = {
            $addToSet: { "scope.roles": roleToUpdate },
          };
          let projection = {
            projection: { _id: 1, externalId: 1, name: 1 },
          };
          // Update roles in program and solutions collection
          await db.collection("solutions").updateMany(matchQuery, updatedRole);

          await db.collection("programs").updateMany(matchQuery, updatedRole);

          // Retrieve the updated solutions and programs

          let updatedSolutionsData = await db
            .collection("solutions")
            .find(matchQuery, projection)
            .toArray();
          let UpdatedProgramData = await db
            .collection("programs")
            .find(matchQuery, projection)
            .toArray();

          updatedSolutions.push(updatedSolutionsData);
          updatedPrograms.push(UpdatedProgramData);
        }
      }
      fs.writeFileSync(
        "updated_solution_records" + generateUUId() + ".txt",
        JSON.stringify(updatedSolutions)
      );
      fs.writeFileSync(
        "updated_programs_records" + generateUUId() + ".txt",
        JSON.stringify(updatedPrograms)
      );
      fs.writeFileSync(
        "created_new_Roles" + generateUUId() + ".txt",
        JSON.stringify(roleCreationResponse)
      );
      fs.writeFileSync(
        "Updated_old_Roles" + generateUUId() + ".txt",
        JSON.stringify(oldRolesToUpdate)
      );
      console.log("Script execution completed");
      process.exit(1);
    }
  } catch (error) {
    console.log(error);
  }
})().catch((err) => console.log("error", err));
