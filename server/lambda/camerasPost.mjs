import models from './models/index.mjs';
import { extractUserMethodAndPath, parseJson, checkParameters, accessControlHeaders } from './utils/index.mjs';
import validator from 'validator';

/**
 * @swagger
 *
 * /cameras:
 *   post:
 *     tags:
 *     - Cameras
 *     summary: Adds a new camera to the home associated with the user making the request, unless the user is an admin in which case the camera is added to the home identified by the homeUUID value.
 *     operationId: Add new camera
 *     security:
 *       - oauth2: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name,rpiSerialNo]
 *             properties:
 *               name:
 *                 type: string
 *                 description: The camera name
 *                 example: Entrance camera
 *               rpiSerialNo:
 *                 type: string
 *                 description: The Raspberry Pi serial number for this camera
 *                 example: 10000000abc123ea
 *               homeUUID:
 *                 type: string
 *                 description: The UUID of the home this camera should be added to. Only required if this is an Admin user otherwise ignored.
 *                 example: 7e50e402-8bc7-42e5-80c2-728276ab83db
 *       required: true
 *     responses:
 *       200:
 *         description: successful operation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               description: The newly created camera object
 *               $ref: '#/components/schemas/Camera' 
 *       401:
 *         description: unauthorised - invalid Authorisation token
 *       422:
 *         description: unprocessable entity - check error message
 */

//************************************
// POST CAMERAS
//************************************
async function postCameras(userId, isAdmin, event) {

  const jsonBody = parseJson(event.body);

  //Check have required body content: name and rpiSerialNo
  var params = ['name', 'rpiSerialNo'];
  if (isAdmin) {
    //Also require homeUUID for admin users to identify the home to add the camera to
    params.push('homeUUID');
  }
  checkParameters(params, jsonBody);  //throws 422 error for missing or empty params

  //if using homeUUID check it is a valid UUID (use + '' to force to string)
  if (isAdmin && !validator.isUUID(jsonBody['homeUUID'] + '')) {
      const err = new Error('homeUUID "' + jsonBody['homeUUID'] + '" is not a valid UUID');
      err.status = 422;
      throw err;    
  }

  //See if this rpiSerialNo already in use
  return await models.Camera.findOne({
    attributes: ['id'],
    where: { rpiSerialNo: jsonBody['rpiSerialNo'] }
  })
  .then(camera => {
    if (camera != null) {
      //rpuSerialNo already in use
      const err = new Error('rpiSerialNo "' + jsonBody['rpiSerialNo'] + '" already in use');        
      err.status = 422;
      throw err;
    }
    //Get the home associated with the homeUUID if admin user or home for the current user if not admin user
    if (isAdmin) {
      return models.Home.findOne({
        attributes: ['id'],
        where: { uuid: jsonBody['homeUUID'] }
      });
    }
    else {
      return models.Home.findOne({
        attributes: ['id'],
        include: [
          { model: models.User, attributes: ['id'], required: true, where: { id: userId }}
        ]
      });      
    }
  })
  .then(home => {
    if (home == null) {
      const err = new Error('Home not found');        
      err.status = 422;
      throw err;
    }
    //Create the new Camera object
    return models.Camera.create({
      name: jsonBody['name'],
      rpiSerialNo: jsonBody['rpiSerialNo'],
      HomeId: home.id
    });
  })
  .then(camera => {
    //Return the new object
    return { 
      uuid: camera.uuid,
      name: camera.name,
      rpiSerialNo: camera.rpiSerialNo,
      Events: []
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
      case 0:   //like /cameras
        ret = await postCameras(userId, isAdmin, event);
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

