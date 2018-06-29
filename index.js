const ENV = process.env;
const AWS = require('aws-sdk');
const JiraClient = require('jira-connector');

console.log('Loading sns2jira function');

if (!ENV.JIRA_HOST) throw new Error(`Missing environment variable: JIRA_HOST`);
if (!ENV.JIRA_USERNAME) throw new Error(`Missing environment variable: JIRA_USERNAME`);
if (!ENV.JIRA_PASSWORD) throw new Error(`Missing environment variable: JIRA_PASSWORD`);
if (!ENV.JIRA_PROJECT) throw new Error(`Missing environment variable: JIRA_PROJECT`);

let jira = new JiraClient({
    host: ENV.JIRA_HOST,
    basic_auth: {
        username: ENV.JIRA_USERNAME,
        password: ENV.JIRA_PASSWORD
    }
});


function buildJiraMessage(alarm) {
    return {
        fields: {
            project: {
                key: ENV.JIRA_PROJECT
            },
            summary: alarm.AlarmName,
            description: `${alarm.AlarmDescription} - ${alarm.NewStateValue}\n${alarm.NewStateReason}\nTrigger: {code:javascript}${JSON.stringify(alarm.Trigger, null, 4)}{code}`,
            environment: alarm.Region,
            issuetype: {
                name: "Alert"
            }
        }
    };
}

/**
 *
 * @param {string} msg the message extracted from an Sns event
 */
function parseSNSMessage(msg) {
    console.log(msg);
    return JSON.parse(msg);
}

function processEvent(event, context, callback) {
    console.log('Event:', JSON.stringify(event, null, 2));
    const snsMessage = parseSNSMessage(event.Records[0].Sns.Message);
    const jiraIssue = buildJiraMessage(snsMessage);
    jira.issue.createIssue(jiraIssue, function (err, issue) {
        if (err) {
            console.log(err);
            callback(err);
        } else {
            console.log(JSON.stringify(issue, null, "   "));
            callback(null, `Created issue ${issue.self}`);
        }

    });
}


exports.handler = (event, context, callback) => processEvent(event, context, callback);