import models from './models/index.mjs';
import { extractUserMethodAndPath, parseJson, countParameters, accessControlHeaders } from './utils/index.mjs';
import validator from 'validator';

/**
 * @swagger
 *
 * /events/{uuid}:
 *   patch:
 *     tags:
 *     - Events
 *     summary: Updates an existing event - isViewed flag
 *     operationId: Update an event
 *     parameters:
 *       - name: uuid
 *         in: path
 *         description: The unique UUID for this event
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
 *               isViewed:
 *                 type: boolean
 *                 description: Flag indicating whether this event has been viewed or not
 *                 example: true
 *       required: true
 *     responses:
 *       200:
 *         description: successful operation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               description: The newly updated event object
 *               $ref: '#/components/schemas/Event' 
 *       401:
 *         description: unauthorised - invalid Authorisation token
 *       422:
 *         description: unprocessable entity - check error message
 */

//************************************
// PATCH EVENT
//************************************
async function patchEvent(homeId, uuid, event) {

  const jsonBody = parseJson(event.body);

  //Check have at least one parameter to change
  if (countParameters(['isViewed'], jsonBody) < 1) {
    const err = new Error('No parameters provided');        
    err.status = 422;
    throw err;
  }

  //Check specific values
  if (('isViewed' in jsonBody) && !validator.isBoolean(jsonBody['isViewed'] + '')) {
    const err = new Error('isViewed "' + jsonBody['isViewed'] + '" is not a valid boolean flag');
    err.status = 422;
    throw err;
  }

  //Try to find this event
  return await models.Event.findOne({
    attributes: ['id', 'uuid', 'isViewed', 'imageFilename', 'recordingStartTime', 'confidence', 'imageWidth', 'imageHeight', 
      'videoFilename', 'model', 'frameRate', 'confidenceThreshold', 'duration', 'maxPeopleFound', 'maxConfidence', 
      'inferenceTime', 'videoWidth', 'videoHeight'],
    where: { uuid: uuid },
    include: [
      { model: models.Camera, attributes: ['HomeId'], required: true }
    ]
  })
  .then(event => {
    if (event == null) {
      var error = new Error('Event not found ' + uuid);
      error.status = 404;
      throw(error);
    }
    //Check this event from same home as the user making this request
    if (event.Camera.HomeId != homeId) {
      //User is trying to patch a camera from another home
      var error = new Error('Event not found ' + uuid + ' for this home');
      error.status = 404;
      throw(error);      
    }

    //Update any fields
    if ('isViewed' in jsonBody) {
      event.isViewed = jsonBody['isViewed'];
    }
    //Save the changes
    return event.save();
  })
  .then(event => {
    //Return the updated object with the events
    event = event.get({ plain: true });
    event['recordingStartTimestamp'] = event.recordingStartTime.getTime() / 1000;
    delete event.recordingStartTime;
    delete event.id;
    delete event.Camera;
    delete event.updatedAt;
    return event;
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
      case 1:   //like /events/{uuid}
        if (!validator.isUUID(pathParameters[0])) {
          const err = new Error('Invalid UUID ' + pathParameters[0]);
          err.status = 404;
          throw err;          
        }
        ret = await patchEvent(homeId, pathParameters[0], event);
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

