const moment = require("moment-timezone");
const FileStream = require(ROOT_PATH + "/generics/fileStream");
module.exports = class ProgramOperations {

    checkUserAuthorization(userDetails) {
        let userRole = gen.utils.getUserRole(userDetails, true);
        if (userRole == "assessors") {
            throw { status: 400, message: "You are not authorized to take this report." };
        }
        return
    }

    /**
      * @apiDefine errorBody
      * @apiError {String} status 4XX,5XX
      * @apiError {String} message Error
      */

    /**
       * @apiDefine successBody
       *  @apiSuccess {String} status 200
       * @apiSuccess {String} result Data
       */


    /**
    * @api {get} /assessment/api/v1/programOperations/listByUser List all the programs which is part of the current user
    * @apiVersion 0.0.1
    * @apiName Fetch Program List By User
    * @apiGroup programOperations
    * @apiUse successBody
    * @apiUse errorBody
    */

    async listByUser(req) {
        return new Promise(async (resolve, reject) => {
            try {

                let userRole = gen.utils.getUserRole(req.userDetails, true);

                let programProject = {
                    externalId: 1,
                    name: 1,
                    description: 1,
                };

                let programDocuments = await database.models.programs.find({ [`components.roles.${userRole}.users`]: req.userDetails.id }, programProject).lean();
                let responseMessage;
                let response;

                if (!programDocuments.length) {

                    responseMessage = "No programs data found for given params.";
                    response = { status: 404, message: responseMessage };

                } else {

                    responseMessage = "Program information list fetched successfully.";
                    response = { message: responseMessage, result: programDocuments };

                }

                return resolve(response);

            } catch (error) {

                return reject({
                    status: 500,
                    message: error,
                    errorObject: error
                });

            }
        });
    }

    /**
  * @api {get} /assessment/api/v1/programOperations/assessorReport 
  * @apiVersion 0.0.1
  * @apiName Fetch Assessor Report
  * @apiGroup programOperations
  * @apiUse successBody
  * @apiUse errorBody
  */

    async assessorReport(req) {
        this.checkUserAuthorization(req.userDetails);
        return new Promise(async (resolve, reject) => {
            try {

                let programDocument = await this.getProgram(req.params._id);

                let assessorDetails;
                let assessorQueryObject = {};

                assessorQueryObject["parentId"] = req.userDetails.id;
                if (req.query.assessorName) assessorQueryObject["name"] = new RegExp(req.query.assessorName, 'i');

                if (req.query.csv && req.query.csv == "true") {
                    const fileName = `assessorReport`;
                    var fileStream = new FileStream(fileName);
                    var input = fileStream.initStream();

                    (async function () {
                        await fileStream.getProcessorPromise();
                        return resolve({
                            isResponseAStream: true,
                            fileNameWithPath: fileStream.fileNameWithPath()
                        });
                    }());
                }

                let limitValue = (!req.query.csv) ? "" : req.pageSize;
                let skipValue = (!req.query.csv) ? "" : (req.pageSize * (req.pageNo - 1));

                assessorDetails = await database.models.schoolAssessors.find(assessorQueryObject, { userId: 1, name: 1, schools: 1 }).limit(limitValue).skip(skipValue).lean().exec();

                let totalCount = database.models.schoolAssessors.countDocuments(assessorQueryObject).exec();
                [assessorDetails, totalCount] = await Promise.all([assessorDetails, totalCount])

                let schoolQueryObject = this.getQueryObject(req.query);

                let filteredSchools;

                let assessorSchoolIds = _.flattenDeep(assessorDetails.map(school => school.schools));

                //get only uniq schoolIds
                if(assessorSchoolIds.length){
                    let uniqAssessorSchoolIds = _.uniq(assessorSchoolIds.map(school => school.toString()));
                    assessorSchoolIds = uniqAssessorSchoolIds.map(school => ObjectId(school));
                }


                if (!_.isEmpty(schoolQueryObject)) {
                    schoolQueryObject._id = { $in: assessorSchoolIds };
                    filteredSchools = await database.models.schools.find(schoolQueryObject, { _id: 1 }).lean();
                }

                let assessorSchoolMap = _.keyBy(assessorDetails, 'userId')
                let submissionDocuments = await database.models.submissions.find({ schoolId: { $in: !_.isEmpty(schoolQueryObject) ? filteredSchools : assessorSchoolIds } }, { status: 1, createdAt: 1, completedDate: 1, schoolId: 1 }).lean();
                let schoolSubmissionMap = _.keyBy(submissionDocuments, 'schoolId');


                function getAverageTimeTaken(submissionData) {
                    let result = submissionData.filter(data => data.status == 'completed');
                    if (result.length) {
                        let dayDifference = []
                        result.forEach(singleResult => {
                            let startedDate = moment(singleResult.createdAt);
                            let completedDate = moment(singleResult.completedDate);
                            dayDifference.push(completedDate.diff(startedDate, 'days'))
                        })
                        return dayDifference.reduce((a, b) => a + b, 0) / dayDifference.length;
                    } else {
                        return 'N/A'
                    }
                }

                function getSubmissionByAssessor(assessorId) {
                    let assessorSchools = assessorSchoolMap[assessorId].schools;
                    let schoolSubmissions = [];
                    assessorSchools.forEach(schoolId => {
                        schoolSubmissions.push(schoolSubmissionMap[schoolId.toString()])
                    });
                    return _.compact(schoolSubmissions);
                }

                let assessorsReports = [];
                assessorDetails.forEach(async (assessor, index) => {
                    let schoolsByAssessor = getSubmissionByAssessor(assessor.userId);
                    let schoolData = _.countBy(schoolsByAssessor, 'status')
                    let schoolAssigned = schoolsByAssessor.length;
                    let assessorResult = {
                        name: assessor.name || "",
                        schoolsAssigned: schoolAssigned || 0,
                        schoolsCompleted: schoolData.completed || 0,
                        schoolsCompletedPercent:  parseFloat(((schoolData.completed / schoolAssigned) * 100).toFixed(2)) || 0,
                        averageTimeTaken: getAverageTimeTaken(schoolsByAssessor)
                    }
                    assessorsReports.push(assessorResult)
                    if (req.query.csv && req.query.csv == "true") {
                        input.push(assessorResult)

                        if (input.readableBuffer && input.readableBuffer.length) {
                            while (input.readableBuffer.length > 20000) {
                                await this.sleep(2000)
                            }
                        }

                    }
                })
                if (req.query.csv && req.query.csv == "true") {
                    input.push(null);
                } else {
                    let result = await this.constructResultObject('programOperationAssessorReports', assessorsReports, totalCount, req.userDetails, programDocument.name);
                    return resolve({ result: result })
                }

            } catch (error) {
                return reject({
                    status: error.status || 500,
                    message: error.message || "Oops! Something went wrong!",
                    errorObject: error
                });
            }
        })
    }

    /**
    * @api {get} /assessment/api/v1/programOperations/schoolReport 
    * @apiVersion 0.0.1
    * @apiName Fetch School Report
    * @apiGroup programOperations
    * @apiUse successBody
    * @apiUse errorBody
    */

    async schoolReport(req) {
        this.checkUserAuthorization(req.userDetails);
        return new Promise(async (resolve, reject) => {
            try {
                let programExternalId = req.params._id;

                let isCSV = req.query.csv;
                let schoolDocuments = await this.getSchools(req, (isCSV && isCSV == "false"));

                if(!schoolDocuments || !schoolDocuments.length)
                    return resolve({ result: [] })

                let schoolObjects = schoolDocuments.result;
                let totalCount = schoolDocuments.totalCount;

                if (!schoolObjects.length) {
                    return resolve({ result: [] })
                }

                let submissionQueryObject = {};
                let schoolObjectIds = schoolObjects.map(school => school.id)
                submissionQueryObject.schoolId = { $in: schoolObjectIds };
                submissionQueryObject.programExternalId = programExternalId;

                if (isCSV && isCSV == "true") {

                    const fileName = `schoolReport`;
                    var fileStream = new FileStream(fileName);
                    var input = fileStream.initStream();

                    (async function () {
                        await fileStream.getProcessorPromise();
                        return resolve({
                            isResponseAStream: true,
                            fileNameWithPath: fileStream.fileNameWithPath()
                        });
                    }());
                }

                let submissionDocuments = await database.models.submissions.find(submissionQueryObject, { status: 1, "schoolInformation.name": 1, createdAt: 1, completedDate: 1, 'evidencesStatus.isSubmitted': 1, schoolExternalId: 1 }).lean();

                submissionDocuments = _.keyBy(submissionDocuments, 'schoolExternalId')

                let result = {};

                let schoolStatusObject = {
                    inprogress: 'In Progress',
                    completed: 'Complete',
                    blocked: 'Blocked',
                    started: 'Started'
                }

                function getAssessmentCompletionPercentage(evidencesStatus) {
                    let isSubmittedArray = evidencesStatus.filter(singleEvidencesStatus => singleEvidencesStatus.isSubmitted == true);
                    return parseFloat(((isSubmittedArray.length / evidencesStatus.length) * 100).toFixed(2));
                }

                result.schoolsReport = [];
                schoolObjects.forEach(async (singleSchoolDocument) => {
                    let submissionDetails = submissionDocuments[singleSchoolDocument.externalId];
                    let resultObject = {};
                    resultObject.status = submissionDetails ? (schoolStatusObject[submissionDetails.status] || submissionDetails.status) : "";
                    resultObject.name = singleSchoolDocument.name || "";
                    resultObject.daysElapsed = submissionDetails ? moment().diff(moment(submissionDetails.createdAt), 'days') : "";
                    resultObject.assessmentCompletionPercent = submissionDetails ? getAssessmentCompletionPercentage(submissionDetails.evidencesStatus) : "";

                    if (isCSV == "true") {
                        input.push(resultObject)

                        if (input.readableBuffer && input.readableBuffer.length) {
                            while (input.readableBuffer.length > 20000) {
                                await this.sleep(2000)
                            }
                        }
                    } else {
                        result.schoolsReport.push(resultObject)
                    }

                })

                if (isCSV == "true") {
                    input.push(null)
                } else {
                    let programDocument = await this.getProgram(req.params._id);
                    result = await this.constructResultObject('programOperationSchoolReports', result.schoolsReport, totalCount, req.userDetails, programDocument.name)
                    return resolve({ result: result })
                }

            } catch (error) {

                return reject({
                    status: error.status || 500,
                    message: error.message || "Oops! Something went wrong!",
                    errorObject: error
                });

            }
        })
    }

    constructResultObject(graphName, value, totalCount, userDetails, programName) {
        return new Promise(async (resolve, reject) => {
            let summary = [
                {
                    "label": "Name of the Manager",
                    "value": (userDetails.firstName + " " + userDetails.lastName).trim()
                },
                {
                    "label": "Name of the Program",
                    "value": programName
                },
                {
                    "label": "Date of report generation",
                    "value": moment().format('DD-MM-YYYY')
                }
            ]
            let reportOptions = await database.models.reportOptions.findOne({ name: graphName }).lean();
            let headers = reportOptions.results.sections[0].tabularData.headers.map(header => header.name)
            let data = value.map(singleValue => {
                let resultObject = {}
                headers.forEach(singleHeader => {
                    resultObject[singleHeader] = singleValue[singleHeader];
                })
                return resultObject;
            })
            reportOptions.results.sections[0].data = data;
            reportOptions.results.sections[0].totalCount = totalCount;
            reportOptions.results.summary = summary;
            reportOptions.results.title = `Program Operations Report for ${programName}`;
            return resolve(reportOptions.results);
        })

    }

    /**
    * @api {get} /assessment/api/v1/programOperations/schoolSummary 
    * @apiVersion 0.0.1
    * @apiName Fetch School Summary
    * @apiGroup programOperations
    * @apiUse successBody
    * @apiUse errorBody
    */

    async schoolSummary(req) {
        this.checkUserAuthorization(req.userDetails);
        return new Promise(async (resolve, reject) => {
            try {

                let schoolObjects = await this.getSchools(req, false);

                let userRole = gen.utils.getUserRole(req.userDetails, true);

                if (!schoolObjects || !schoolObjects.result || !schoolObjects.result.length)
                    return resolve({ result: [] })

                let schoolDocuments = schoolObjects.result;

                let schoolIds = schoolDocuments.map(school => school.id);

                let managerName = (req.userDetails.firstName + " " + req.userDetails.lastName).trim();
                
                let schoolsCompletedCount = database.models.submissions.countDocuments({ schoolId: { $in: schoolIds },status:'completed' }).lean().exec();

                let schoolsInprogressCount = database.models.submissions.countDocuments({ schoolId: { $in: schoolIds },status:'inprogress' }).lean().exec();

                [schoolsCompletedCount,schoolsInprogressCount] = await Promise.all([schoolsCompletedCount,schoolsInprogressCount]);

                let programDocument = await this.getProgram(req.params._id);

                let roles = {
                    assessors: "Assessors",
                    leadAssessors: "Lead Assessors",
                    projectManagers: "Project Managers",
                    programManagers: "Program Managers"
                };

                let averageTimeTaken = (schoolDocuments.length / schoolsCompletedCount);

                let result = [
                    {
                        label: "createdDate",
                        value: moment().format('DD-MM-YYYY'),
                    },
                    {
                        label: "managerName",
                        value: managerName
                    },
                    {
                        label: "role",
                        value: roles[userRole] || "",
                    },
                    {
                        label: "programName",
                        value: programDocument.name,
                    },
                    {
                        label: "schoolsAssigned",
                        value: schoolDocuments.length,
                    },
                    {
                        label: "schoolsCompleted",
                        value: schoolsCompletedCount || 0,
                    },
                    {
                        label: "schoolsInporgress",
                        value: schoolsInprogressCount || 0,
                    },
                    {
                        label: "averageTimeTaken",
                        value: averageTimeTaken ? (parseFloat(averageTimeTaken.toFixed(2)) || 0) : 0,
                    },
                    {
                        label: "userName",
                        value: req.userDetails.userName || "",
                    },
                    {
                        label: "email",
                        value: req.userDetails.email || "",
                    }
                ]

                return resolve({
                    message: 'School details fetched successfully.',
                    result: result
                })

            } catch (error) {

                return reject({
                    status: error.status || 500,
                    message: error.message || "Oops! Something went wrong!",
                    errorObject: error
                });

            }
        })
    }

    /**
    * @api {get} /assessment/api/v1/programOperations/reportFilters 
    * @apiVersion 0.0.1
    * @apiName Fetch Filters(Drop down contents) for Reports
    * @apiGroup programOperations
    * @apiUse successBody
    * @apiUse errorBody
    */

    async reportFilters(req) {
        this.checkUserAuthorization(req.userDetails);
        return new Promise(async (resolve, reject) => {
            try {

                let programDocument = await this.getProgram(req.params._id);

                let schoolTypes = await database.models.schools.distinct('schoolTypes', { _id: { $in: programDocument.components[0].schools } }).lean().exec();
                let administrationTypes = await database.models.schools.distinct('administration', { _id: { $in: programDocument.components[0].schools } }).lean().exec();
                let types = await Promise.all([schoolTypes, administrationTypes]);

                schoolTypes = _.compact(types[0]);
                administrationTypes = _.compact(types[1]);

                schoolTypes = schoolTypes.map(schoolType => {
                    return {
                        label: schoolType,
                        value: schoolType
                    }
                })

                administrationTypes = administrationTypes.map(administrationType => {
                    return {
                        label: administrationType,
                        value: administrationType
                    }
                })

                let result = [
                    {
                        field: "fromDate",
                        label: "start date",
                        value: "",
                        visible: false,//there is no date calculation right now
                        editable: true,
                        input: "date",
                        validation: {
                            required: false
                        },
                        min: new Date(0),
                        max: new Date()
                    },
                    {
                        field: "toDate",
                        label: "end date",
                        value: "",
                        visible: false,//there is no date calculation right now
                        editable: true,
                        input: "date",
                        validation: {
                            required: false
                        },
                        min: new Date(0),
                        max: new Date()
                    },
                    {
                        field: "schoolTypes",
                        label: "school type",
                        value: "",
                        visible: true,
                        editable: true,
                        input: "select",
                        options: schoolTypes,
                        validation: {
                            required: false
                        },
                        autocomplete: false,
                        min: "",
                        max: ""
                    },
                    {
                        field: "area",
                        label: "school area",
                        value: "",
                        visible: true,
                        editable: true,
                        input: "text",
                        validation: {
                            required: false
                        },
                        autocomplete: false,
                        min: "",
                        max: ""
                    },
                    {
                        field: "administration",
                        label: "school administration",
                        value: "",
                        visible: true,
                        editable: true,
                        input: "select",
                        showRemarks: true,
                        options: administrationTypes,
                        validation: {
                            required: false
                        },
                        autocomplete: false,
                        min: "",
                        max: ""
                    },
                    {
                        field: "externalId",
                        label: "school Id",
                        value: "",
                        visible: true,
                        editable: true,
                        input: "text",
                        validation: {
                            required: false
                        },
                        autocomplete: true,
                        url: `https://${process.env.SHIKSHALOKAM_BASE_HOST}${process.env.APPLICATION_BASE_URL}api/v1/programOperations/searchSchool/`,
                        min: "",
                        max: ""
                    }
                ];
                return resolve({
                    message: 'Reports filter fetched successfully.',
                    result: result
                })

            } catch (error) {
                return reject({
                    status: error.status || 500,
                    message: error.message || "Oops! Something went wrong!",
                    errorObject: error
                });
            }
        })
    }

    /**
    * @api {get} /assessment/api/v1/programOperations/searchSchool 
    * @apiVersion 0.0.1
    * @apiName Fetch Filters(Autocomplete contents) for Reports
    * @apiGroup programOperations
    * @apiUse successBody
    * @apiUse errorBody
    */

    //searchSchool is for program operation search school autocomplete
    async searchSchool(req) {
        this.checkUserAuthorization(req.userDetails);
        return new Promise(async (resolve, reject) => {
            try {

                let programDocument = await this.getProgram(req.params._id);

                if (!req.query.id) {
                    throw { status: 400, message: 'School id required.' }
                }

                let schoolIdAndName = await database.models.schools.find(
                    {
                        _id: { $in: programDocument.components[0].schools },
                        externalId: new RegExp(req.query.id, 'i')
                    },
                    {
                        externalId: 1, name: 1
                    }
                ).limit(5).lean();//autocomplete needs only 5 dataset

                return resolve({
                    status: 200,
                    result: schoolIdAndName
                })

            } catch (error) {
                return reject({
                    status: error.status || 500,
                    message: error.message || "Oops! Something went wrong!",
                    errorObject: error
                });
            }
        })
    }

    //sub function to get schools based on program and current user role
    async getSchools(req, pagination = false) {
        return new Promise(async (resolve, reject) => {
            try {

                let programDocument = await this.getProgram(req.params._id);

                let queryObject = [
                    { $project: { userId: 1, parentId: 1, name: 1, schools: 1, programId: 1, updatedAt: 1 } },
                    { $match: { userId: req.userDetails.id, programId: programDocument._id } },
                    {
                        $graphLookup: {
                            from: 'schoolAssessors',
                            startWith: '$userId',
                            connectFromField: 'userId',
                            connectToField: 'parentId',
                            maxDepth: 20,
                            as: 'children'
                        }
                    },
                    {
                        $project: { schools: 1, "children.schools": 1 }
                    }
                ];

                let schoolsAssessorDocuments = await database.models.schoolAssessors.aggregate(queryObject);

                if (!schoolsAssessorDocuments.length) {
                    return resolve([]);
                }

                let schoolIds = [];

                schoolsAssessorDocuments[0].schools.forEach(school => {
                    schoolIds.push(school.toString());
                })

                schoolsAssessorDocuments[0].children.forEach(child => {
                    child.schools.forEach(school => {
                        schoolIds.push(school.toString());
                    })
                })

                let schoolObjectIds = _.uniq(schoolIds).map(schoolId => ObjectId(schoolId));

                let schoolQueryObject = {};
                schoolQueryObject._id = { $in: schoolObjectIds };

                _.merge(schoolQueryObject, this.getQueryObject(req.query))
                let totalCount = database.models.schools.countDocuments(schoolQueryObject).exec();
                let filteredSchoolDocument;

                if (!req.query.csv || req.query.csv=="false") {
                    filteredSchoolDocument = database.models.schools.find(schoolQueryObject, { _id: 1, name: 1, externalId: 1 }).limit(req.pageSize).skip(req.pageSize * (req.pageNo - 1)).lean().exec();
                } else {
                    filteredSchoolDocument = database.models.schools.find(schoolQueryObject, { _id: 1, name: 1, externalId: 1 }).lean().exec();
                }

                [filteredSchoolDocument, totalCount] = await Promise.all([filteredSchoolDocument, totalCount])

                let schoolDocumentFilteredObject = filteredSchoolDocument.map(school => {
                    return {
                        id: school._id,
                        name: school.name,
                        externalId: school.externalId
                    }
                });

                return resolve({ result: schoolDocumentFilteredObject, totalCount: totalCount });

            } catch (error) {
                return reject({
                    status: error.status || 500,
                    message: error.message || "Oops! Something went wrong!",
                    errorObject: error
                });
            }
        })
    }

    async getProgram(programExternalId) {
        return new Promise(async (resolve, reject) => {
            try {

                if (!programExternalId)
                    throw { status: 400, message: 'Program id required.' }

                let programDocument = await database.models.programs.findOne({ externalId: programExternalId }, {
                    _id: 1, name: 1, "components.schools": 1
                }).lean();

                if (!programDocument) {
                    throw { status: 400, message: 'Program not found for given params.' }
                }

                return resolve(programDocument);

            } catch (error) {
                return reject({
                    status: error.status || 500,
                    message: error.message || "Oops! Something went wrong!",
                    errorObject: error
                });
            }

        })
    }

    async sleep(ms) {
        return new Promise((resolve) => {
            setTimeout(resolve, ms)
        })
    }

    getQueryObject(requestQuery) {
        let queryObject = {}
        let queries = Object.keys(requestQuery);
        let filteredQueries = _.pullAll(queries, ['csv']);

        filteredQueries.forEach(query => {
            if (query == "area") {
                queryObject["$or"] = [{ zoneId: new RegExp(requestQuery.area, 'i') }, { districtName: new RegExp(requestQuery.area, 'i') }];
            } else if (query == "schoolName") {
                queryObject["name"] = new RegExp(requestQuery.schoolName, 'i')
            } else {
                if (requestQuery[query]) queryObject[query] = requestQuery[query];
            }
        })
        return queryObject;
    }
};