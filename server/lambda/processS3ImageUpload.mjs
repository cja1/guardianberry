import models from './models/index.mjs';

import { S3 } from "@aws-sdk/client-s3";
import { SNS } from "@aws-sdk/client-sns";
const s3 = new S3({ region: 'eu-west-1' });
const sns = new SNS({ region: 'eu-west-1' });

//Insert a new Event for this intruder detection and store the metadata
//The Event is associated with the camera referenced by the RPI Serial No.
async function insertEvent(camera, fileKey, metadata) {
	return await models.Event.create({
		recordingStartTime: new Date(metadata.recording_start_time * 1000),
	 	imageFilename: fileKey,
	 	confidence: parseInt(metadata.confidence),
		imageWidth: parseInt(metadata.width),
		imageHeight: parseInt(metadata.height),
		CameraId: camera.id
	});
}

//Send notifications to each User associated with the Home of the Camera with sendNotifications set to true
//Also create a Notification table entry
async function sendNotifications(camera, event, metadata) {
	const recordingStartTime = new Date(metadata.recording_start_time * 1000);

	//Get all users associated with this home
	//Also get their locale (like 'en-US') and timezone (like 'Asia/Singapore') for correct date / time formatting
	await models.User.findAll({
		attributes: ['id', 'mobile', 'locale', 'timezone'],
		where: { HomeId: camera.Home.id, sendNotifications: true }
	})
	.then(users => {
		//Send a notification to each user, correctly formatting the date/time.
		const promises = [];

		users.forEach(user => {
	    const dateTimeString = recordingStartTime.toLocaleString(user.locale, { timeZone: user.timezone });
	    const message = 'INTRUDER ALERT! GuardianBerry detected an intruder in your home at '
	      + dateTimeString + ' with camera: ' + camera.name
	      + '. Please log in to your account to watch the video.';
	      
	    //Publish message to relevant mobile phone number
	    promises.push(sns.publish({ PhoneNumber: user.mobile, Message: message }));

			//Also create a Notification table entry
			promises.push(models.Notification.create({
				message: message,
				UserId: user.id,
				EventId: event.id
			}));
		})
		console.log(users);
		return Promise.all(promises);
	});
}

export const handler = async (event) => {

  console.log("Received event:", JSON.stringify(event, null, 2));

  //Extract the bucket name and file key from the event
  const bucketName = event.Records[0].s3.bucket.name;
  const fileKey = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, " "));

  console.log(`New file uploaded: ${fileKey} to bucket ${bucketName}`);

  try {
    //Fetch the metadata of the file. Use HEAD to avoid downloading the whole file.
    const metadata = await s3.headObject({ Bucket: bucketName, Key: fileKey });
    console.log('Custom metadata:', metadata.Metadata);
    
    //get the rpiSerialNo to find the associated Camera
    const rpiSerialNo = ('rpi_serial_no' in metadata.Metadata) ? metadata.Metadata.rpi_serial_no : '';

    //Get the Camera associated with this rpiSerialNo
    const camera = await models.Camera.findOne({
    	attributes: ['id', 'name'],
    	where: { rpiSerialNo: rpiSerialNo },
    	include: [
    		{ model: models.Home, attributes: ['id'], required: true }
    	]
    });
    if (camera == null) {
    	throw new Error('Camera with rpiSerialNo ' + rpiSerialNo + ' not found');
    }
    console.log('Found camera id', camera.id, 'for rpiSerialNo', rpiSerialNo);
  	const event = await insertEvent(camera, fileKey, metadata.Metadata);

  	//Now send notification to all users that are associated with this Home and have sendNotifications set to true
		await sendNotifications(camera, event, metadata.Metadata);

    return {
      statusCode: 200,
      body: 'New event created'
    };    		
    
  } catch (error) {
      console.error(error);
      return {
          statusCode: 500,
          body: error.toString()
      };
  }
};
