## Migrations

#### Steps to run the script files

This script is intended to add new roles in userRoles collection and update the roles in solution and program 5,1.0 release.

In order to execute this migration script, we need to first log in to the pod where the service is running and then proceed with the provided instructions.

### sample file - 
https://docs.google.com/spreadsheets/d/1k_OC9hSx-AQMqOc9kmMoGKC40Eb-N_MhTp9300ve7Hg/edit?gid=0#gid=0

### Step 1:

    Navigate to /opt/survey/migrations/newSubRolesCreation/

### Step 2:

Run the script to delete duplicate projects.

    node createNewSubRole.js path/to/your/csvfile.csv

#### Validation 

The script will generate three text files in the directory where the script is run:
`created_new_roles_<UUID>.txt`: Contains details of any new roles created during the script execution.
`updated_solution_records_<UUID>.txt`: Contains details of updated records in the solutions collection.
`updated_program_records_<UUID>.txt`: Contains details of updated records in the programs collection.

 
script execution was successful.