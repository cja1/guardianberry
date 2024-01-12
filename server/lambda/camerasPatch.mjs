import models from './models/index.mjs';
import { extractUserMethodAndPath, parseJson, countParameters, accessControlHeaders } from './utils/index.mjs';
import validator from 'validator';

/**
 * @swagger
 *
 * /cameras/{uuid}:
 *   patch:
 *     tags:
 *     - Cameras
 *     summary: Updates an existing camera - name and / or rpiSerialNo
 *     operationId: Update a camera
 *     parameters:
 *       - name: uuid
 *         in: path
 *         description: The unique UUID for this camera
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - oauth2: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: []
 *             properties:
 *               name:
 *                 type: string
 *                 description: The camera name
 *                 example: Entrance camera
 *               rpiSerialNo:
 *                 type: string
 *                 description: The Raspberry Pi serial number for this camera
 *                 example: 10000000abc123ea
 *       required: true
 *     responses:
 *       200:
 *         description: successful operation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               description: The newly updated camera object
 *               $ref: '#/components/schemas/Camera' 
 *       401:
 *         description: unauthorised - invalid Authorisation token
 *       422:
 *         description: unprocessable entity - check error message
 */

//************************************
// PATCH CAMERA
//************************************
async function patchCamera(homeId, uuid, event) {

  const jsonBody = parseJson(event.body);

  //Check have at least one parameter to change
  if (countParameters(['name', 'rpiSerialNo'], jsonBody) < 1) {
    const err = new Error('No parameters provided');        
    err.status = 422;
    throw err;
  }

  return await Promise.resolve()
  .then(() => {
    //if rpiSerialNo set then get other cameras using this rpiSerialNo (if any)
    if ('rpiSerialNo' in jsonBody) {
      return models.Camera.findAll({
        attributes: ['uuid'],
        where: { rpiSerialNo: jsonBody['rpiSerialNo'] }
      });
    }
    else {
      return Promise.resolve([]); //empty array for easy array length comparison
    }
  })
  .then(cameras => {
    if ((cameras.length > 0) && (cameras[0].uuid != uuid)) {
      //rpiSerialNo already in use and not by this camera
      const err = new Error('rpiSerialNo "' + jsonBody['rpiSerialNo'] + '" already in use');        
      err.status = 422;
      throw err;
    }

    //Try to find this camera
    return models.Camera.findOne({
      attributes: ['id', 'uuid', 'name', 'rpiSerialNo', 'HomeId'],
      where: { uuid: uuid },
      include: [
        { model: models.Event, attributes: ['uuid', 'imageFilename', 'recordingStartTime', 'confidence', 'imageWidth', 'imageHeight', 
        'videoFilename', 'model', 'frameRate', 'confidenceThreshold', 'duration', 'maxPeopleFound', 'maxConfidence', 
        'inferenceTime', 'videoWidth', 'videoHeight'], required: false }
      ]
    });
  })
  .then(camera => {
    if (camera == null) {
      var error = new Error('Camera not found ' + uuid);
      error.status = 404;
      throw(error);
    }
    //Check this camera from same home as the user making this request
    if (camera.HomeId != homeId) {
      //User is trying to patch a camera from another home
      var error = new Error('Camera not found ' + uuid + ' for this home');
      error.status = 404;
      throw(error);      
    }

    //Update any fields
    if ('name' in jsonBody) {
      camera.name = jsonBody['name'];
    }
    if ('rpiSerialNo' in jsonBody) {
      camera.rpiSerialNo = jsonBody['rpiSerialNo'];
    }
    //Save the changes
    return camera.save();
  })
  .then(camera => {
    //Return the updated object with the events
    camera = camera.get({ plain: true });
    camera.Events.forEach((event, j) => {
      camera.Events[j]['recordingStartTimestamp'] = event.recordingStartTime.getTime() / 1000;
      delete camera.Events[j].recordingStartTime;
    });
    delete camera.id;
    delete camera.HomeId;
    delete camera.updatedAt;
    return camera;
  });
}

export const handler = async (event) => {

  // console.log("Received event:", JSON.stringify(event, null, 2));
  try {
    const { userId, isAdmin, homeId, method, pathParameters } = await extractUserMethodAndPath(event);

    if (method !== 'PATCH') {
      const err = new Error('Invalid request method');
      err.status = 401;
      throw err;
    }

    var ret;
    switch (pathParameters.length) {
      case 1:   //like /cameras/{uuid}
        if (!validator.isUUID(pathParameters[0])) {
          const err = new Error('Invalid UUID ' + pathParameters[0]);
          err.status = 404;
          throw err;          
        }
        ret = await patchCamera(homeId, pathParameters[0], event);
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

