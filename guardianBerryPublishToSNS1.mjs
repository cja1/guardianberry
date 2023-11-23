import { S3 } from "@aws-sdk/client-s3";
import { SNS } from "@aws-sdk/client-sns";
const s3 = new S3({ region: 'eu-west-1' });
const sns = new SNS({ region: 'eu-west-1' });

export const handler = async (event) => {

  //console.log("Received event:", JSON.stringify(event, null, 2));

  //Extract the bucket name and file key from the event
  const bucketName = event.Records[0].s3.bucket.name;
  const fileKey = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, " "));

  console.log(`New image uploaded: ${fileKey} in bucket ${bucketName}`);

  try {
    //Fetch the metadata of the image file. Use HEAD to avoid downloading the whole file.
    const metadata = await s3.headObject({ Bucket: bucketName, Key: fileKey });
    console.log('Custom metadata:', metadata.Metadata);
    
    const rpiSerialNo = metadata.Metadata.rpi_serial_no;
    const recordingStartTime = metadata.Metadata.recording_start_time;
    const date = new Date(recordingStartTime * 1000); //timestamp in ms

    //Note: in the full version we need to lookup the rpiSerialNo and get the associated Home and the SNS Topic ARN
    //For this prototype we use the static SNS Topic ARN for guardianBerry_1
    //Note also: date.toLocaleString() will use the timezone of the AWS server, not the user's timezone
    const topicArn = 'arn:aws:sns:eu-west-1:705936070782:guardianBerry_1';
    const message = 'INTRUDER ALERT! GuardianBerry detected an intruder in your home at '
      + date.toLocaleString() + " camera id: " + rpiSerialNo +'. Please login to your account to see the video.';
      
    //Publish message to topic ARN
    const data = await sns.publish({ TopicArn: topicArn, Message: message });
    console.log('SNS published:', data);
    
    return {
      statusCode: 200,
      body: JSON.stringify('SNS notification sent')
    };
    
  } catch (error) {
      console.error("Error:", error);
      return {
          statusCode: 500,
          body: JSON.stringify('Error')
      };
  }
};
