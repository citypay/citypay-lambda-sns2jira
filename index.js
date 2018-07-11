const ENV = process.env;
const AWS = require('aws-sdk');
const REGION = 'eu-west-1';
if (!AWS.config.region) {
    AWS.config.update({
        region: REGION
    });
}

const JiraClient = require('jira-connector');
const cwl = new AWS.CloudWatchLogs();
const EventLogsLimit = 20;
const EventLogWindowMillis = 5 * 60000; // 5mins

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
            summary: `CloudWatch Alarm: ${alarm.AlarmName}`,
            description: `h3. ${alarm.NewStateValue} ${alarm.AlarmDescription || ""}\n${alarm.StateChangeTime}\n${alarm.NewStateReason}\nh3. Trigger: {code:javascript}${JSON.stringify(alarm.Trigger, null, 4)}{code}\n`,
            environment: alarm.Region,
            issuetype: {
                name: "Alert"
            }
        }
    };
}

/**
 * Function obtains the filter pattern for a metric filter and searches for related event logs to add to the JIRA
 *
 * @param params params for a describeMetricFilters such as { metricNamespace: "", metricName: ""),
 *  see https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/CloudWatchLogs.html#describeMetricFilters-property
 * @param callback a function (err, data) where data is a json object of the events returned in the search
 * @param alarmDateTime a date and time to search, of no value is provided the current runtime date and time is used
 */
function obtainLogsForAlarm(params, callback, alarmDateTime) {

    console.log(`addLogsForAlarm: ${JSON.stringify(params)}`);
    cwl.describeMetricFilters(params, (e, describeResult) => {

        console.log(`Describe Result: ${JSON.stringify(describeResult)}`);

        if (e) {
            callback(e);
        } else if (describeResult.metricFilters && describeResult.metricFilters.length < 1) {
            callback(null, []);
        } else if (describeResult.metricFilters && describeResult.metricFilters.length > 1) {
            callback(`Expecting single metric filter, received: ${describeResult.metricFilters.length} filter`);
        } else {

            let adt = alarmDateTime || new Date().getTime();
            // console.log(`adt: ${adt}`);
            let filter = describeResult.metricFilters[0];
            let filterParams = {
                logGroupName: filter.logGroupName,
                startTime: adt - EventLogWindowMillis,
                endTime: adt,
                filterPattern: filter.filterPattern,
                limit: EventLogsLimit
            };

            // console.log(`Using filter ${filter.filterPattern}`);
            // console.log("Filter Params: " + JSON.stringify(filterParams, null, "  "));

            cwl.filterLogEvents(filterParams, (err, data) => {
                if (data) {
                    callback(null, data.events, filterParams);
                } else if (err) {
                    callback(err);
                } else {
                    callback(null, [], filterParams);
                }
            })
        }
    });
}

function renderEvent(e) {
    if (e) {
        let dt = new Date(e.timestamp);
        let src = "";
        let name = "";
        let msg = e.message;
        if (msg.startsWith("{")) {
            let json = JSON.parse(msg);
            msg = `_${json.errorCode || ""}_ ${json.errorMessage || ""}`;
            src = json.eventSource;
            name = json.eventName;
        }
        return `| ${e.userIdentity.userName} | ${src} | ${name} | ${dt.toISOString()} | ${msg} |`;
    } else return "";
}

/**
 *
 * @param {Array} events
 */
function appendToJiraDesription(events) {
    let rows = events.map(e => renderEvent(e)).join("\n");
    return `|| User || Event Source || Event Name || Event Time || Error Message ||\n${rows}`;
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
    const params = {
        metricNamespace: snsMessage.Trigger.Namespace,
        metricName: snsMessage.Trigger.MetricName
    };
    const dt = new Date(snsMessage.StateChangeTime).getTime();

    console.log(JSON.stringify(params));

    function createJira(suffix) {
        const jiraIssue = buildJiraMessage(snsMessage);
        jiraIssue.fields.description = jiraIssue.fields.description + suffix;
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

    obtainLogsForAlarm(params, (err, logs, filterParams) => {
        if (err) {
            console.log(err);
            createJira(`h3. Associated Logs\nUnable to locate logs: {quote}${err}{quote}`);
        } else {
            let table = appendToJiraDesription(logs);
            let logLink = "";
            if (filterParams) {
                logLink = `https://${REGION}.console.aws.amazon.com/cloudwatch/home?region=${REGION}#logEventViewer:group=${filterParams.logGroupName};filter=${encodeURIComponent(filterParams.filterPattern)};start=${new Date(filterParams.startTime).toISOString()};end=${new Date(filterParams.endTime).toISOString()}`;
            }
            createJira(`h3. Associated Logs\n${table}\n[CloudWatch Logs|${logLink}]`);
        }
    }, dt);


}


exports.handler = (event, context, callback) => processEvent(event, context, callback);