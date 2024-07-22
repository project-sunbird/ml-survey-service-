## Migrations

#### Steps to run the script files

This script is intended as a remedy to push completed surveySubmission records to kafka and it is related to the 6.0.0 branch

### Step 1:

    Navigate to Project Directory 

### Step 2:

Run the script to push completed surveySubmission records to kafka.

    node pushcompletedsubmissions.js id

    note: id here can be submission_id that is _id from surveySubmission collection or solution_id based on which it will query the surveySubmission collection to find the records.

    Multiple IDs support:

    You can also provide multiple IDs by separating them with commas.
    Example: node pushcompletedsubmissions.js id1,id2,id3

#### Validation 

After the script has been executed in the environment, all the successfully pushed messages to kafka, those submission_ids will be stored in "pushedMessages.txt" file.
