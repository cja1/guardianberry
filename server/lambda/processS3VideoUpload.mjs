import models from './models/index.mjs';
import { addMetadataToVideoFile } from './utils/index.mjs';
import { S3 } from "@aws-sdk/client-s3";
const s3 = new S3({ region: 'eu-west-1' });


//Update the existing Event for this intruder detection and store the video metadata
async function updateEvent(event, fileKey, metadata) {
	await event.update({
		videoFilename: fileKey,
		model: metadata.model,
		frameRate: parseInt(metadata.frame_rate),
		confidenceThreshold: parseFloat(metadata.confidence_threshold),
		duration: parseInt(metadata.duration_s),
		maxPeopleFound: parseInt(metadata.max_people_found),
		maxConfidence: parseInt(metadata.max_confidence),
		inferenceTime: parseInt(metadata.inference_time_ms),
		videoWidth: parseInt(metadata.width),
		videoHeight: parseInt(metadata.height)
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
    
    //use the rpiSerialNo to find the associated Camera and recordingStartTime to find the event
    const rpiSerialNo = ('rpi_serial_no' in metadata.Metadata) ? metadata.Metadata.rpi_serial_no : '';
    const recordingStartTime = new Date(metadata.Metadata.recording_start_time * 1000);

    //Get the Event associated with this rpiSerialNo and recordingStartTime
    const event = await models.Event.findOne({
    	where: { recordingStartTime: recordingStartTime },
    	include: [
    		{ model: models.Camera, attributes: ['id'], required: true, where: { rpiSerialNo: rpiSerialNo } }
    	]
    });
    if (event == null) {
    	throw new Error('Event associated with rpiSerialNo ' + rpiSerialNo + ' and recordingStartTime ' + metadata.recording_start_time + ' not found');
    }
    console.log('Found event id', event.id, 'for rpiSerialNo', rpiSerialNo, 'and recordingStartTime', recordingStartTime);

    //Update database event object
  	await updateEvent(event, fileKey, metadata.Metadata);
    console.log('Updated event id', event.id);

    //Save metadata to file using ffmpeg - do it here to avoid putting more processing effort on RPi.
    await addMetadataToVideoFile(metadata, fileKey);
    console.log('Added metadata to video file', fileKey);

    return {
      statusCode: 200,
      body: 'Existing event updated'
    };    		
    
  } catch (error) {
      console.error(error);
      return {
          statusCode: 500,
          body: error.toString()
      };
  }
};
