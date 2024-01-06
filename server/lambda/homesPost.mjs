import models from './models/index.mjs';
import { extractUserMethodAndPath, parseJson, checkParameters, accessControlHeaders } from './utils/index.mjs';

/**
 * @swagger
 *
 * /homes:
 *   post:
 *     tags:
 *     - Homes
 *     summary: Adds a new home. This can only be requested by an admin user.
 *     operationId: Add new home
 *     security:
 *       - oauth2: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 description: The name of the home
 *                 example: 123 Any Place
 *       required: true
 *     responses:
 *       200:
 *         description: successful operation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               description: The newly created Home object
 *               $ref: '#/components/schemas/Home' 
 *       401:
 *         description: unauthorised - invalid Authorisation token
 *       422:
 *         description: unprocessable entity - check error message
 */

//************************************
// POST HOMES
//************************************
async function postHomes(isAdmin, event) {

  const jsonBody = parseJson(event.body);

  //Check have required body content: name
  const params = ['name'];
  checkParameters(params, jsonBody);  //throws 422 error for missing or empty params

  //Check admin user
  if (!isAdmin) {
    const err = new Error('New homes can only be created by administrators');
    err.status = 401;
    throw err;    
  }

  //Create the new Home object
  return await models.Home.create({
    name: jsonBody['name']
  })
  .then(home => {
    //Return the new object
    return { 
      uuid: home.uuid,
      name: home.name,
      Users: [],
      Cameras: []
    };
  });
}

export const handler = async (event) => {

  // console.log("Received event:", JSON.stringify(event, null, 2));
  try {
    const { userId, isAdmin, homeId, method, pathParameters } = await extractUserMethodAndPath(event);

    if (method !== 'POST') {
      const err = new Error('Invalid request method');
      err.status = 401;
      throw err;
    }

    var ret;
    switch (pathParameters.length) {
      case 0:   //like /homes
        ret = await postHomes(isAdmin, event);
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

