import models from './models/index.mjs';
import { extractUserMethodAndPath, accessControlHeaders } from './utils/index.mjs';
import validator from 'validator';

/**
 * @swagger
 *
 * /events/{uuid}:
 *   delete:
 *     tags:
 *     - Events
 *     summary: Delete an event. Note that a user can only delete an event associated with a camera in their home.
 *     operationId: Delete an event
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
 *       204:
 *         description: successful operation
 *       401:
 *         description: unauthorised - invalid Authorisation token
 *       404:
 *         description: event not found
 */

//************************************
// DELETE EVENT
//************************************
async function deleteEvent(homeId, uuid) {

  //See if this event exists - include paranoid: false to include deleted events
  return await models.Event.findOne({
    attributes: ['id', 'deletedAt'],
    where: { uuid: uuid },
    include: [
      { model: models.Camera, attributes: ['HomeId'], required: true }
    ],
    paranoid: false
  })
  .then(function(event) {
    if (event == null) {
      var error = new Error('Event not found: ' + uuid);
      error.status = 404;
      throw(error);
    }
    if (event.Camera.HomeId != homeId) {
      //User is trying to delete an event associated with a camera from another home
      var error = new Error('Event not found ' + uuid + ' for this home');
      error.status = 404;
      throw(error);
    }

    //If event already deleted then return (DELETE is idempotent)
    if (event.deletedAt != null) {
      return Promise.resolve();
    }

    //Delete the event
    return event.destroy();
  })
}

export const handler = async (event) => {

  // console.log("Received event:", JSON.stringify(event, null, 2));

  try {
    const { userId, isAdmin, homeId, method, pathParameters } = await extractUserMethodAndPath(event);

    if (method !== 'DELETE') {
      const err = new Error('Invalid request method');
      err.status = 401;
      throw err;
    }

    switch (pathParameters.length) {
      case 1:   //like /events/{uuid}
        if (!validator.isUUID(pathParameters[0])) {
          const err = new Error('Invalid UUID ' + pathParameters[0]);
          err.status = 404;
          throw err;          
        }
        await deleteEvent(homeId, pathParameters[0]);
        break;

      default:
        const err = new Error('Invalid path parameters');
        err.status = 401;
        throw err;
        break;
    }

    return {
      statusCode: 204,
      headers: accessControlHeaders(),
      body: ''
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

