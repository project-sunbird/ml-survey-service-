/**
 * name : projectsController.js
 * author : Saish Borkar
 * created-date : 26-nov-2024
 * Description : Projects controller
 */



/**
    * Projects
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
