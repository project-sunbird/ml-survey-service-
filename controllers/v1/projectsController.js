/**
 * name : projectsController.js
 * author : Saish Borkar
 * created-date : 26-nov-2024
 * Description : Projects controller
 */

// Dependencies
const pollSubmissionsHelper = require(MODULES_BASE_PATH + "/pollSubmissions/helper");


/**
    * PollSubmissions
    * @class
*/
module.exports = class Projects extends Abstract {

    constructor() {
        super(projectsSchema);
    }

    static get name() {
        return "projects";
    }


}
