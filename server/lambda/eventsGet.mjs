import models from './models/index.mjs';
import { extractUserMethodAndPath, accessControlHeaders, generatePresignedImageUrls, generatePresignedImageAndVideoUrl } from './utils/index.mjs';
import validator from 'validator';

/**
 * @swagger
 *
 * components:
 *   schemas:
 *     Event:
 *       type: object
 *       description: Event information
 *       required: [uuid,isViewed,recordingStartTimestamp,confidence,imageWidth,imageHeight,videoUrl,model,frameRate,confidenceThreshold,duration,maxPeopleFound,maxConfidence,inferenceTime,videoWidth,videoHeight]
 *       properties:
 *         uuid:
 *           type: string
 *           description: A unique UUID for this event
 *           example: 8fbeb436-dd70-474e-8e0a-ddba299edea2
 *         isViewed:
 *           type: boolean
 *           description: Flag indicating whether this event has been viewed or not
 *           example: true
 *         imageUrl:
 *           type: string
 *           description: The url of the image file that is the first captured image of this event (pre-signed url)
 *           example: https://s3.eu-west-1.amazonaws.com/guardianberry.images/97bbeb12-3a52-4026-a450-117380d03c9f.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256
 *         recordingStartTimestamp:
 *           type: integer
 *           description: The unix timestamp in seconds of the event start
 *           example: 1701003729
 *         confidence:
 *           type: integer
 *           description: The confidence score that a person is detected in the initial image, 0-100
 *           example: 72
 *         imageWidth:
 *           type: integer
 *           description: The image width in pixels
 *           example: 1280
 *         imageHeight:
 *           type: integer
 *           description: The image height in pixels
 *           example: 960
 *         videoUrl:
 *           type: string
 *           description: The url of the video file for this event (pre-signed url)
 *           example: https://s3.eu-west-1.amazonaws.com/guardianberry.videos/97bbeb12-3a52-4026-a450-117380d03c9f.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256
 *         model:
 *           type: string
 *           description: The name of the model used for this event detection
 *           example: /home/admin/yolov5/yolov5s.pt
 *         frameRate:
 *           type: integer
 *           description: The video framerate in frames per second
 *           example: 10
 *         confidenceThreshold:
 *           type: float
 *           description: The confidence threshold for this event detection, 0-1
 *           example: 0.25
 *         duration:
 *           type: integer
 *           description: The video length in seconds
 *           example: 20
 *         maxPeopleFound:
 *           type: integer
 *           description: The maximum number of people detected during this event
 *           example: 2
 *         maxConfidence:
 *           type: integer
 *           description: The maximum confidence there was a person detected during any frame of this event, 0-100
 *           example: 92
 *         inferenceTime:
 *           type: integer
 *           description: How long the inference (object detection) took in ms
 *           example: 1500
 *         videoWidth:
 *           type: integer
 *           description: The video width in pixels
 *           example: 1280
 *         videoHeight:
 *           type: integer
 *           description: The video height in pixels
 *           example: 960
 *         Camera:
 *           type: object
 *           description: Camera object with the camera UUID only
 *           required: [uuid]
 *           properties:
 *             uuid:
 *               type: string
 *               description: A unique UUID for this camera
 *               example: 02958d31-409a-4491-9105-479f48b3c5ca
 * 
 *     EventSummary:
 *       type: object
 *       description: Event summary information
 *       required: [uuid,isViewed,imageUrl,recordingStartTimestamp,duration,maxPeopleFound,maxConfidence,Camera]
 *       properties:
 *         uuid:
 *           type: string
 *           description: A unique UUID for this event
 *           example: 8fbeb436-dd70-474e-8e0a-ddba299edea2
 *         isViewed:
 *           type: boolean
 *           description: Flag indicating whether this event has been viewed or not
 *           example: true
 *         imageUrl:
 *           type: string
 *           description: The url of the image file that is the first captured image of this event (pre-signed url)
 *           example: https://s3.eu-west-1.amazonaws.com/guardianberry.images/97bbeb12-3a52-4026-a450-117380d03c9f.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256
 *         recordingStartTimestamp:
 *           type: integer
 *           description: The unix timestanp in seconds of the event start
 *           example: 1701003729
 *         duration:
 *           type: integer
 *           description: The video length in seconds
 *           example: 20
 *         maxPeopleFound:
 *           type: integer
 *           description: The maximum number of people detected during this event
 *           example: 2
 *         maxConfidence:
 *           type: integer
 *           description: The maximum confidence there was a person detected during any frame of this event, 0-100
 *           example: 92
 *         Camera:
 *           type: object
 *           description: Camera object with the camera UUID only
 *           required: [uuid]
 *           properties:
 *             uuid:
 *               type: string
 *               description: A unique UUID for this camera
 *               example: 02958d31-409a-4491-9105-479f48b3c5ca
 *  
 * /events:
 *   get:
 *     tags:
 *     - Events
 *     summary: Gets a list of all the events for the home associated with the user making the request. Note - not all fields returned - only summary. For full set of fields make a GET request for the specific event.
 *     operationId: Get a list of events
 *     security:
 *       - oauth2: []
 *     responses:
 *       200:
 *         description: successful operation
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               description: Array of EventSummary objects
 *               items:
 *                 $ref: '#/components/schemas/EventSummary' 
 *       401:
 *         description: unauthorised - invalid Authorisation token
 */

//************************************
// GET EVENTS
//************************************
async function getEvents(homeId) {

  var out = [];

  //Get all events for this Home (associated via Camera)
  return await models.Event.findAll({
    attributes: ['uuid', 'isViewed', 'imageFilename', 'recordingStartTime', 'duration', 'maxPeopleFound', 'maxConfidence'],
    include: [
      { model: models.Camera, attributes: ['uuid'], required: true, where: { HomeId: homeId }}
    ],
    order: [[ 'id', 'DESC']]
  })
  .then(events => {
    //Create output data with timestamps and array of image filenamers for creating pre-signed urls
    var imageFilenames = [];

    events.forEach(event => {
      //Convert to POJO
      event = event.get({ plain: true });
      event['recordingStartTimestamp'] = event.recordingStartTime.getTime() / 1000;
      imageFilenames.push(event.imageFilename);
      delete event.recordingStartTime;
      out.push(event)
    });
    //Generate pre-signed URLS
    return generatePresignedImageUrls(imageFilenames)
  })
  .then(presignedUrls => {
    //Now replace imageFilenames with the presigned URL
    out.forEach((event, i) => {
      out[i]['imageUrl'] = presignedUrls[event.imageFilename];
      delete out[i].imageFilename;
    });

    return out;
  });
}

/**
 * @swagger
 *
 * /events/{uuid}:
 *   get:
 *     tags:
 *     - Events
 *     summary: Gets a single event with all fields for the event.
 *     operationId: Get one event
 *     parameters:
 *       - name: uuid
 *         in: path
 *         description: The unique UUID for this event
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - oauth2: []
 *     responses:
 *       200:
 *         description: successful operation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               description: Event object
 *               $ref: '#/components/schemas/Event' 
 *       401:
 *         description: unauthorised - invalid Authorisation token
 *       404:
 *         description: event not found
 */

//************************************
// GET EVENT
//************************************
async function getEvent(homeId, uuid) {

  var event;

  return await models.Event.findOne({
    attributes: ['uuid', 'isViewed', 'imageFilename', 'recordingStartTime', 'confidence', 'imageWidth', 'imageHeight', 'videoFilename', 'model', 'frameRate', 'confidenceThreshold', 'duration', 'maxPeopleFound', 'maxConfidence', 'inferenceTime', 'videoWidth', 'videoHeight'],
    where: { uuid: uuid },
    include: [
      { model: models.Camera, attributes: ['uuid'], required: true, where: { HomeId: homeId }}
    ],
    order: [[ 'id', 'DESC']]
  })
  .then(thisEvent => {
    //Convert to POJO
    event = thisEvent.get({ plain: true });
    event['recordingStartTimestamp'] = event.recordingStartTime.getTime() / 1000;
    delete event.recordingStartTime;

    //Generate pre-signed image and video URL
    return generatePresignedImageAndVideoUrl(event.imageFilename, event.videoFilename);
  })
  .then(presignedUrls => {
    //Now set imageUrl and videoUrl to the presigned URLs and delete image and videoFilename
    event['imageUrl'] = presignedUrls[0];
    delete event.imageFilename;
    event['videoUrl'] = presignedUrls[1];
    delete event.videoFilename;
    return event;
  });
}

export const handler = async (event) => {

  // console.log("Received event:", JSON.stringify(event, null, 2));

  try {
    const { userId, isAdmin, homeId, method, pathParameters } = await extractUserMethodAndPath(event);

    if (method !== 'GET') {
      const err = new Error('Invalid request method');
      err.status = 401;
      throw err;
    }

    var ret;
    switch (pathParameters.length) {
      case 0:   //like /events
        ret = await getEvents(homeId);
        break;

      case 1:   //like /events/{uuid}
        if (!validator.isUUID(pathParameters[0])) {
          const err = new Error('Invalid UUID ' + pathParameters[0]);
          err.status = 404;
          throw err;
        }
        ret = await getEvent(homeId, pathParameters[0]);
        break;

      default:
        const err = new Error('Invalid path parameters');
        err.status = 401;
        throw err;
        break;
    }

    return {
      statusCode: 200,
      headers: accessControlHeaders(),
      body: JSON.stringify(ret)
    };

  } catch (err) {
    console.error(err);
    return {
      statusCode: err.status,
      headers: accessControlHeaders(),
      body: err.toString()
    };
  }
};

