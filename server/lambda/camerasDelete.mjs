import models from './models/index.mjs';
import { extractUserMethodAndPath, accessControlHeaders } from './utils/index.mjs';
import validator from 'validator';

/**
 * @swagger
 *
 * /cameras/{uuid}:
 *   delete:
 *     tags:
 *     - Cameras
 *     summary: Delete a camera. Note that the user making the request must be associated with the home this camera is associated with
 *     operationId: Delete a camera
 *     parameters:
 *       - name: uuid
 *         in: path
 *         description: The unique UUID for this camera
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
 *         description: camera not found
 */

//************************************
// DELETE CAMERA
//************************************
async function deleteCamera(homeId, uuid) {

  //See if this camera exists - include paranoid: false to include deleted events
  return await models.Camera.findOne({
    attributes: ['id', 'deletedAt', 'HomeId'],
    where: { uuid: uuid },
    paranoid: false
  })
  .then(camera => {
    if (camera == null) {
      var error = new Error('Camera not found ' + uuid);
      error.status = 404;
      throw(error);
    }
    if (camera.HomeId != homeId) {
      //User is trying to delete a camera from another home
      var error = new Error('Camera not found ' + uuid + ' for this home');
      error.status = 404;
      throw(error);
    }

    //If camera already deleted then return (DELETE is idempotent)
    if (camera.deletedAt != null) {
      return Promise.resolve();
    }

    //Delete the camera
    return camera.destroy();
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
      case 1:   //like /camera/{uuid}
        if (!validator.isUUID(pathParameters[0])) {
          const err = new Error('Invalid UUID ' + pathParameters[0]);
          err.status = 404;
          throw err;          
        }
        await deleteCamera(homeId, pathParameters[0]);
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

