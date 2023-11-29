# Configuring AWS services to send an SMS notification

These instructions cover these steps:
- Setting up an SNS Topic and subscribing a mobile endpoint to the Topic for SMS messages
- Creating a Lambda function to process S3 file upload events and publish a notification to SNS
- Triggering the Lambda function on S3 file upload

## 1. Setting up an SNS Topic and subscribing a mobile endpoint to the Topic for SMS messages

### Setting up an SNS Topic
The AWS Simple Notification Service uses the concept of Topics. These are a way to create a communications channel with a group subscribers around a common theme.

I decided to associate a Topic as a single Home. Then everyone interested in security notifications about the Home - for example people living there - could subscribe to the Topic. This architecture would also allow for multiple Raspberry devices to be associated with a single Home.

Based on this I decided to name Topics as `guardianBerry_<homeId>` where `homeId` was the unique identifier for a Home. I created the first topic named `guardianBerry_1` - shown in the image below.
![SNS Topic setup](images/snsTopicCreation.png)

Notes:
1. The type is set to Standard as opposed to FIFO as only Standard SNS Topics support SMS messages.
2. Encryption is enabled which means that messages that are waiting to be sent are encrypted ('_encryption at rest_').

### Creating a Mobile Endpoint and subscribing to the Topic

The next step was to subscribe a mobile endpoint to the `guardianBerry_1` Topic. This is easy to do in the AWS console, requiring selecting the Topic and then entering the mobile number, as shown below:

![SNS Mobile Endpoint](images/snsSubscriptionCreation.png)


### Sending a test message

The final step was to publish a message to the Topic and check it was received correctly on the mobile. This again is easy to do using the AWS console. The test message received is shown below.

![Test SMS Message](images/smsTestMessage.jpeg)


## 2. Creating a Lambda function to process S3 file upload events and publish a notification to SNS

AWS Lambda functions are serverless functions that are fully managed by AWS - with no need to setup and maintain servers and scale up and down servers based on demand. All of this is taken care of by AWS.

There are several languages available for writing Lambda functions including Node, Python and Java. Based on my experience I chose to use Node as the programming language.

I created a new Lambda function called `guardianBerryPublishToSNS1` together with a new IAM role with permission to run Lambda functions, get the metadata from S3 objects and publish SNS messages. The lambda create function screen is shown below:
![Create Lambda function](images/lambdaCreate.png)

A subset of the new IAM role for the lambda function is shown below. This restricts S3 access to the `guardianberry.images` bucket and restricts SNS Topic publishing to topics that begin with `guardianBerry_`:

```
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject"
            ],
            "Resource": "arn:aws:s3:::guardianberry.images/*"
        },
        {
            "Effect": "Allow",
            "Action": "sns:Publish",
            "Resource": "arn:aws:sns:eu-west-1:705936070782:guardianBerry_*"
        }
    ]
}
```

## 3. Triggering the Lambda function on S3 file upload
The final step is to setup a trigger from the S3 `PutObject` event on the `guardianberry.images` bucket to the `guardianBerryPublishToSNS1` lambda function.

This is easy to do through the AWS console and is shown in the image below:

![Lambda trigger setup](images/lambdaTrigger.png)

Once this is all put together, the creation of a new file in the guardianberry.images folder triggers an SMS to the author's mobile phone number. Example SMS:

![SMS intruder alert example](images/smsIntruderAlert.jpeg)

## Additional Notes
### Increasing AWS SMS Send Limits
- After sending and receiving around 10-15 SMSs as part of system testing the SMSs stopped arriving. I checked the Lambda function and whether the SNS Topic posting was resulting in an error - but this was not the case
- I enabled logging of SMS delivery status into CloudWatch. From this I was able to see that the SMS send was resulting in a `No quota left for account` error. CloudWatch log below.
```
{
    "notification": {
        "messageId": "8c1de487-da4b-5c67-9d2a-b95f017e32b3",
        "timestamp": "2023-11-23 04:45:41.264"
    },
    "delivery": {
        "destination": "+65xxxxxxxx",
        "smsType": "Transactional",
        "providerResponse": "No quota left for account",
        "dwellTimeMs": 118
    },
    "status": "FAILURE"
}
```
- I raised a case with AWS to increase the monthly SMS send limit, and after this was processed the SMSs were once again successfully sent and received.
 
### Sending Correct Date / Time
- The Feature Prototype highlighted a problem that will need to be addressed in the next phase of development: the date and time needs to be relvative to each user's timezone.
- This will require the system to capture each user's timezone, then use this to correctly format the date / time for each user.
- This also means that a single SNS Topic for the home with one common message will not work, as we want to support users from the same Home but living in different timezones (for example, a holiday home).
- I did consider removing the date / time part of the notification, but this seems to be a useful feature to keep.