# CityPay SNS Lambda to JIRA

Processes Cloudwatch Alarms and creates a JIRA ticket. The process only supports basic authentication
into JIRA.

The application assumes that an *Alert* JIRA type has been setup. 

The project uses `repack-zip` to generate a Lambda zip file for uploading. To create execute
```bash
npm run build-aws-resource 
```

The generated zip file can be directly uploaded to a Lambda function. 

To configure the function, set the following properties in Lambda

| ENV Variable | Description |
| -------------| ----------- |
| JIRA_HOST | The hostname of the JIRA server to connect to |
| JIRA_USERNAME | The username to authenticate to the JIRA server |
| JIRA_PASSWORD | The password to authenticate to the JIRA server  |
| JIRA_PROJECT | The project in which a ticket is to be generated |

To test the function, configure a test SNS event using the following example alarm 

```json
{
  "Records": [
    {
      "EventSource": "aws:sns",
      "EventVersion": "1.0",
      "EventSubscriptionArn": "arn:aws:sns:eu-west-1:000000000000:cloudwatch-alarms:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      "Sns": {
        "Type": "Notification",
        "MessageId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        "TopicArn": "arn:aws:sns:eu-west-1:000000000000:cloudwatch-alarms",
        "Subject": "ALARM: \"Example alarm name\" in EU - Ireland",
        "Message": "{\"AlarmName\":\"Example alarm name\",\"AlarmDescription\":\"Example alarm description.\",\"AWSAccountId\":\"000000000000\",\"NewStateValue\":\"ALARM\",\"NewStateReason\":\"Threshold Crossed: 1 datapoint (10.0) was greater than or equal to the threshold (1.0).\",\"StateChangeTime\":\"2017-01-12T16:30:42.236+0000\",\"Region\":\"EU - Ireland\",\"OldStateValue\":\"OK\",\"Trigger\":{\"MetricName\":\"DeliveryErrors\",\"Namespace\":\"ExampleNamespace\",\"Statistic\":\"SUM\",\"Unit\":null,\"Dimensions\":[],\"Period\":300,\"EvaluationPeriods\":1,\"ComparisonOperator\":\"GreaterThanOrEqualToThreshold\",\"Threshold\":1.0}}",
        "Timestamp": "2017-01-12T16:30:42.318Z",
        "SignatureVersion": "1",
        "Signature": "Cg==",
        "SigningCertUrl": "https://sns.eu-west-1.amazonaws.com/SimpleNotificationService-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.pem",
        "UnsubscribeUrl": "https://sns.eu-west-1.amazonaws.com/?Action=Unsubscribe&SubscriptionArn=arn:aws:sns:eu-west-1:000000000000:cloudwatch-alarms:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        "MessageAttributes": {}
      }
    }
  ]
}
```
