import models from './models/index.mjs';
import { extractUserMethodAndPath, accessControlHeaders } from './utils/index.mjs';

/**
 * @swagger
 *
 * components:
 *   schemas:
 *     Camera:
 *       type: object
 *       description: Camera information with events for the camera
 *       required: [uuid,name]
 *       properties:
 *         uuid:
 *           type: string
 *           description: A unique UUID for this camera
 *           example: 02958d31-409a-4491-9105-479f48b3c5ca
 *         name:
 *           type: string
 *           description: The camera name
 *           example: Hallway camera
 *         rpiSerialNo:
 *           type: string
 *           description: The Raspberry Pi serial number for this camera
 *           example: 10000000abc123ea
 *         Events:
 *           type: array
 *           description: The events this camera has triggered
 *           items:
 *             $ref: '#/components/schemas/Event' 
 * 
 * /cameras:
 *   get:
 *     tags:
 *     - Cameras
 *     summary: Gets a list of cameras for the home associated with the user making the request. The request also returns all the events for each camera
 *     operationId: Get a list of cameras
 *     security:
 *       - oauth2: []
 *     responses:
 *       200:
 *         description: successful operation
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               description: Array of Camera objects
 *               items:
 *                 $ref: '#/components/schemas/Camera' 
 *       401:
 *         description: unauthorised - invalid Authorisation token
 */

//************************************
// GET CAMERAS
//************************************
async function getCameras(userId) {

  //Get all cameras for this home... start by getting the home id
  return await models.Home.findOne({
    attributes: ['id'],
    include: [
      { model: models.User, attributes: ['id'], required: true, where: { id: userId }}
    ]
  })
  .then(home => {
    //Get all cameras and events for this Home
    return models.Camera.findAll({
      attributes: ['uuid', 'name', 'rpiSerialNo'],
      where: { HomeId: home.id },
      include: [
        { model: models.Event, attributes: ['uuid', 'imageFilename', 'recordingStartTime', 'confidence', 'imageWidth', 'imageHeight', 
        'videoFilename', 'model', 'frameRate', 'confidenceThreshold', 'duration', 'maxPeopleFound', 'maxConfidence', 
        'inferenceTime', 'videoWidth', 'videoHeight'], required: false }
      ],
      order: [[ 'name', 'DESC']]
    });
  })
  .then(cameras => {
    //Create output data with event timestamps
    var out = [];
    cameras.forEach(camera => {
      //Convert to POJO
      camera = camera.get({ plain: true });
      camera.Events.forEach((event, j) => {
        camera.Events[j]['recordingStartTimestamp'] = event.recordingStartTime.getTime() / 1000;
        delete camera.Events[j].recordingStartTime;
      });
      out.push(camera)
    });
    return out;
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
      case 0:   //like /cameras
        ret = await getCameras(userId);
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

