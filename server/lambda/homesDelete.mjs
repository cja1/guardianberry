import models from './models/index.mjs';
import { extractUserMethodAndPath, accessControlHeaders } from './utils/index.mjs';
import validator from 'validator';

/**
 * @swagger
 *
 * /homes/{uuid}:
 *   delete:
 *     tags:
 *     - Homes
 *     summary: Delete a home. This can only be perfomed by a user with isAdmin flag set.
 *     operationId: Delete a home
 *     parameters:
 *       - name: uuid
 *         in: path
 *         description: The unique UUID for this home
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
 *         description: home not found
 */

//************************************
// DELETE HOME
//************************************
async function deleteHome(isAdmin, uuid) {

  //See if this home exists - include paranoid: false to include deleted homes
  //Note: ignore the home associated with the admin user. Use the uuid passed-in instead.
  return await models.Home.findOne({
    attributes: ['id', 'deletedAt'],
    where: { uuid: uuid },
    paranoid: false
  })
  .then(home => {
    //First check is admin user
    if (!isAdmin) {
      var error = new Error('User not authorised to perform this request');
      error.status = 401;
      throw(error);      
    }
    if (home == null) {
      var error = new Error('Home not found: ' + uuid);
      error.status = 404;
      throw(error);
    }

    //If home already deleted then return (DELETE is idempotent)
    if (home.deletedAt != null) {
      return Promise.resolve();
    }

    //Delete the home
    return home.destroy();
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
      case 1:   //like /homes/{uuid}
        if (!validator.isUUID(pathParameters[0])) {
          const err = new Error('Invalid UUID ' + pathParameters[0]);
          err.status = 404;
          throw err;          
        }
        await deleteHome(isAdmin, pathParameters[0]);
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

