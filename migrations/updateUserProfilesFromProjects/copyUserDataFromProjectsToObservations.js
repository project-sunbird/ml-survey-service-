/**
 * name : copyUserDataFromProjectsToObservations.js
 * author : Saish Borkar
 * created-date : 26-nov-2024
 * Description : Migration script for updating userProfile in observation & observationSubmission based on project information
 */

const path = require("path");
const fs = require("fs");
const _ = require("lodash");
const { MongoClient } = require("mongodb");

const rootPath = path.join(__dirname, "../../");
require("dotenv").config({ path: rootPath + "/.env" });

const mongoUrl = process.env.MONGODB_URL;
const dbName = mongoUrl.split("/").pop();
const url = mongoUrl.split(dbName)[0];

(async () => {
  const connection = await MongoClient.connect(url, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  const db = connection.db(dbName);

  try {
    console.log('Migration started...')
    let observationIdsUpdated = [];
    // Get all observations with referenceFrom "project"
    const observationDocuments = await db
      .collection("observations")
      .find({ referenceFrom: "project" })
      .project({ "_id": 1,"project":1})
      .toArray();

    if (!observationDocuments.length) {
      console.log("No observations found to process.");
      connection.close();
      return;
    }

    const chunkedObservations = _.chunk(observationDocuments, 10);
    const totalChunkLength = chunkedObservations.length;
    let iteration = 1;
    for (const chunk of chunkedObservations) {
      console.log(`processing chunk of ${iteration++}/${totalChunkLength}`)
      const projectIds = chunk.map((obs) => obs.project._id);

      // Fetch relevant projects
      const projectRecords = await db
        .collection("projects")
        .find({ _id: { $in: projectIds } })
        .project({"_id":1,"userRoleInformation":1,"userProfile":1})
        .toArray();

      for (const project of projectRecords) {

        const targetObservationIds = chunk
          .filter((obs) => {
            return obs.project._id.equals(project._id);
          })
          .map((obs) => obs._id);

          let setObject = {};

           if (
            project.userRoleInformation &&
            project.userRoleInformation.role &&
            project.userRoleInformation.state
          ) {
            setObject.userRoleInformation = project.userRoleInformation;
          }
          
          if (
            project.userProfile &&
            project.userProfile.id
          ) {
            setObject.userProfile = project.userProfile;
          }
          

          if (Object.keys(setObject).length === 0) {
            continue;
          }

        // Update observations
        const updatedObservations = await db
          .collection("observations")
          .updateMany(
            { _id: { $in: targetObservationIds } },
            {
              $set: setObject
            }
          );

        // Update observationSubmissions
        const updatedObservationSubmissions = await db
          .collection("observationSubmissions")
          .updateMany(
            { observationId: { $in: targetObservationIds } },
            {
              $set: setObject
            }
          );

          observationIdsUpdated.push(...targetObservationIds)

      }
    }

    require('fs').writeFileSync('observationIdsUpdated'+Date.now()+'.json',JSON.stringify(observationIdsUpdated))
    console.log("Migration completed successfully.");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    connection.close();
  }
})();
