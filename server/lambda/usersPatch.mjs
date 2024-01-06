import models from './models/index.mjs';
import { extractUserMethodAndPath, parseJson, countParameters, accessControlHeaders } from './utils/index.mjs';
import validator from 'validator';
import { timeZonesNames } from "@vvo/tzdb";

/**
 * @swagger
 *
 * /users/{uuid}:
 *   patch:
 *     tags:
 *     - Users
 *     summary: Updates an existing user - name, mobile, sendNotifications, locale, timezone. Note that only the user making the request can update their details.
 *     operationId: Update a user
 *     parameters:
 *       - name: uuid
 *         in: path
 *         description: The unique UUID for this user
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
 *                 description: The users name
 *                 example: Annie
 *               mobile:
 *                 type: string
 *                 description: The user's mobile phone number, including the international country code.
 *                 example: '+6512345678'
 *               sendNotifications:
 *                 type: boolean
 *                 description: Flag indicating whether this user wants to receiver intruder notifications or not
 *                 example: true
 *               locale:
 *                 type: string
 *                 description: The user's locale as a string
 *                 example: en-GB
 *               timezone:
 *                 type: string
 *                 description: The user's timezone as a string
 *                 example: America/Los_Angeles
 *       required: true
 *     responses:
 *       200:
 *         description: successful operation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               description: The newly updated user object
 *               $ref: '#/components/schemas/User' 
 *       401:
 *         description: unauthorised - invalid Authorisation token
 *       422:
 *         description: unprocessable entity - check error message
 */

//************************************
// PATCH USER
//************************************
async function patchUser(userId, uuid, event) {

  const jsonBody = parseJson(event.body);

  //Check have at least one parameter to change
  if (countParameters(['name', 'mobile', 'sendNotifications', 'locale', 'timezone'], jsonBody) < 1) {
    const err = new Error('No parameters provided');        
    err.status = 422;
    throw err;
  }

  //Check individual values
  if (('email' in jsonBody) && !validator.isEmail(jsonBody['email'] + '')) {
    const err = new Error('Email "' + jsonBody['email'] + '" is not a valid email address');
    err.status = 422;
    throw err;
  }
  //use strict mode to require + and country code, any country code supported.
  if (('mobile' in jsonBody) && !validator.isMobilePhone(jsonBody['mobile'] + '', 'any', { strictMode: true })) {
    const err = new Error('Mobile "' + jsonBody['mobile'] + '" is not a valid mobile phone number');
    err.status = 422;
    throw err;
  }
  if (('sendNotifications' in jsonBody) && !validator.isBoolean(jsonBody['sendNotifications'] + '')) {
    const err = new Error('sendNotifications "' + jsonBody['sendNotifications'] + '" is not a valid boolean flag');
    err.status = 422;
    throw err;
  }
  if (('locale' in jsonBody) && !validator.isLocale(jsonBody['locale'] + '')) {
    const err = new Error('locale "' + jsonBody['locale'] + '" is not a valid locale');
    err.status = 422;
    throw err;
  }
  if (('timezone' in jsonBody) && !timeZonesNames.includes(jsonBody['timezone'] + '')) {
    const err = new Error('timezone "' + jsonBody['timezone'] + '" is not a valid timezone');
    err.status = 422;
    throw err;
  }

  //Try to find this camera
  return await models.User.findOne({
    attributes: ['id', 'uuid', 'name', 'mobile', 'sendNotifications', 'locale', 'timezone'],
    where: { uuid: uuid },
    include: [
      { model: models.Notification, attributes:['uuid', 'message', 'createdAt'], required: false, order: [['id', 'DESC']] }
    ]
  })
  .then(user => {
    if (user == null) {
      var error = new Error('User not found ' + uuid);
      error.status = 404;
      throw(error);
    }
    //Check this user is the same as the requesting user
    if (user.id != userId) {
      //User is trying to patch a another user
      var error = new Error('User not found ' + uuid + ' for this user');
      error.status = 404;
      throw(error);      
    }

    //Update any fields
    if ('name' in jsonBody) {
      user.name = jsonBody['name'];
    }
    if ('mobile' in jsonBody) {
      user.mobile = jsonBody['mobile'];
    }
    if ('sendNotifications' in jsonBody) {
      user.sendNotifications = jsonBody['sendNotifications'];
    }
    if ('locale' in jsonBody) {
      user.locale = jsonBody['locale'];
    }
    if ('timezone' in jsonBody) {
      user.timezone = jsonBody['timezone'];
    }
    //Save the changes
    return user.save();
  })
  .then(user => {
    //Return the updated object with the user notifications
    user = user.get({ plain: true });
    user.Notifications.forEach((notification, j) => {
      user.Notifications[j]['timestamp'] = user.Notifications[j].createdAt.getTime() / 1000;
      delete user.Notifications[j].createdAt;
    });
    delete user.id;
    delete user.updatedAt;
    return user;
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
      case 1:   //like /users/{uuid}
        if (!validator.isUUID(pathParameters[0])) {
          const err = new Error('Invalid UUID ' + pathParameters[0]);
          err.status = 404;
          throw err;          
        }
        ret = await patchUser(userId, pathParameters[0], event);
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

