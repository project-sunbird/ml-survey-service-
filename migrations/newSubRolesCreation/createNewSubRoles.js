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
      // Loop through CSV data to check for role update or create
      for (let i = 0; i < extractedCsvData.length; i++) {
        if (
          extractedCsvData[i].OldRolesCode !== extractedCsvData[i].NewRolesCode
        ) {
          let newRolesCode = extractedCsvData[i].NewRolesCode;

          let roleToUpdate = await db
            .collection("userRoles")
            .find({ code: newRolesCode })
            .toArray();
          if (!(roleToUpdate.length > 0)) {
            let roleData = {
              code: newRolesCode,
              entityTypes: extractedCsvData[i].EntityType,
              title: extractedCsvData[i].Tittle,
            };
            newRolesToCreate.push(roleData);
          }
        }
      }

    // Create new roles in the database
      let roleCreationResponse = await UserRolesHelper.bulkCreate(newRolesToCreate);
      let updatedSolutions = [];
      let updatedPrograms = [];

    // If roles were successfully created, proceed with updating solutions and programs
      if (roleCreationResponse[0].status === "Success") {
        for (let i = 0; i < roleCreationResponse.length; i++) {
          let newUserRoleCode = roleCreationResponse[i].code;
          for (let j = 0; j < extractedCsvData.length; j++) {
            if (extractedCsvData[j].NewRolesCode === newUserRoleCode) {
              let roleUpdateinScope = extractedCsvData[j];

             // Retrieve the role's ID and code for update
              let roleToUpdate = await db
                .collection("userRoles")
                .findOne(
                  { code: newUserRoleCode },
                  { projection: { _id: 1, code: 1 } }
                );
              if (roleToUpdate) {
                let matchQuery = {
                  "scope.roles.code": roleUpdateinScope.OldRolesCode,
                };

                let updatedRole = {
                  $addToSet: { "scope.roles": roleToUpdate },
                };
                let projection = {
                  projection: { _id: 1, externalId: 1, name: 1 },
                };

                // Update roles in program and solutions collection
                await db
                  .collection("solutions")
                  .updateMany(matchQuery, updatedRole);

                await db
                  .collection("programs")
                  .updateMany(matchQuery, updatedRole);
                
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
          }
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
      console.log("Script execution completed");
      process.exit(1);
    }
  } catch (error) {
    console.log(error);
  }
})().catch((err) => console.log("error", err));
