/**
 * name : pushcompletedsubmissions.js
 * author : Saish Borkar
 * created-date : 18-JULY-2024
 * Description : Migration script to push completed survey submissions to kafka
 */
const mongoose = require('mongoose');
const path = require("path");
let rootPath = path.join(__dirname, '../../')
require('dotenv').config({ path: rootPath+'/.env' })
require("../../config/globalVariable")();

let _ = require("lodash");
let mongoUrl = process.env.MONGODB_URL;

let dbName = mongoUrl.split("/").pop();
let url = mongoUrl.split(dbName)[0];
var MongoClient = require('mongodb').MongoClient;
var ObjectId = require('mongodb').ObjectID;
const args = process.argv.slice(2);
const surveySubmissionsHelper = require(MODULES_BASE_PATH + "/surveySubmissions/helper");
const fs = require('fs');
const utils = require('../../generics/helpers/utils')

let IDString = args[0];

console.log('IDString:',IDString)

if(!IDString || IDString.length <= 0){
  throw new Error('No Ids is passed in the terminal.');
}

let IDArray = IDString.split(',').map(id => id.trim()).filter(id => id.length > 0);;

console.log('processing...',IDArray);

if(IDArray.length <= 0){
  throw new Error('No Id/Ids found');
}

IDArray.forEach((id)=>{
  if(!mongoose.Types.ObjectId.isValid(id)){
    throw new Error(id+' is not a valid mongoID');
  }
})

let successArray = [];
(async () => {

    let connection = await MongoClient.connect(url, { useNewUrlParser: true, useUnifiedTopology: true });
    let db = connection.db(dbName);

    try {
        // if it is a solution id
      let firstRecordSet = await db
        .collection("surveySubmissions")
        .find({solutionId:{$in:IDArray.map(id=>ObjectId(id))},status:"completed"})
        .toArray(); 

      let secondRecordSet = await db
        .collection("surveySubmissions")
        .find({_id:{$in:IDArray.map(id=>ObjectId(id))},status:"completed"})
        .toArray(); 

    if(firstRecordSet && firstRecordSet.length > 0)
    {
        surveySubmissionsRecords = firstRecordSet;
    }else if(secondRecordSet && secondRecordSet.length >0)
    {
        surveySubmissionsRecords = secondRecordSet;
    }else {
        throw new Error("No record found.")  
    }
      
    let chunkOfsurveySubmissionsRecords = _.chunk(surveySubmissionsRecords, 10);

    for (let i = 0; i < chunkOfsurveySubmissionsRecords.length; i++) {
      let currentBatch = chunkOfsurveySubmissionsRecords[i];

      for (let j = 0; j < currentBatch.length; j++) {
        try {
          let pushAction =
            await surveySubmissionsHelper.pushCompletedSurveySubmissionForReporting(
              currentBatch[j]._id
            );

          console.log(pushAction, "pushAction");

          if (pushAction.status == "success") {
            successArray.push(currentBatch[j]._id);
          }
        } catch (err) {
          console.log(err, "Error caught");
        }
      }
    }
    
    fs.writeFile('./pushedMessages'+utils.generateUUId()+'.txt', JSON.stringify(successArray), (err) => {
        if (err) throw err;
            console.log('The file has been saved!')
    })
      console.log("completed");
      connection.close();
    }
    catch (error) {
        console.log(error)
    }
})().catch(err => console.error(err));
