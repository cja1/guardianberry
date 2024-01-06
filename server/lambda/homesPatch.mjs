import models from './models/index.mjs';
import { extractUserMethodAndPath, parseJson, countParameters, accessControlHeaders } from './utils/index.mjs';
import validator from 'validator';

/**
 * @swagger
 *
 * /homes/{uuid}:
 *   patch:
 *     tags:
 *     - Homes
 *     summary: Updates an existing home - name
 *     operationId: Update a home
 *     parameters:
 *       - name: uuid
 *         in: path
 *         description: The unique UUID for this home
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
 *                 description: The home name
 *                 example: 1 AnyTown
 *       required: true
 *     responses:
 *       200:
 *         description: successful operation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               description: The newly updated home object
 *               $ref: '#/components/schemas/Home' 
 *       401:
 *         description: unauthorised - invalid Authorisation token
 *       422:
 *         description: unprocessable entity - check error message
 */

//************************************
// PATCH HOME
//************************************
async function patchHome(homeId, isAdmin, uuid, event) {

  const jsonBody = parseJson(event.body);

  //Check have at least one parameter to change
  if (countParameters(['name'], jsonBody) < 1) {
    const err = new Error('No parameters provided');        
    err.status = 422;
    throw err;
  }

  //Try to find this home
  return await models.Home.findOne({
    attributes: ['id', 'uuid', 'name'],
    where: { uuid: uuid },
    include: [
      { model: models.User, attributes: ['uuid', 'name', 'mobile', 'sendNotifications', 'locale', 'timezone'], required: false, include: [
        { model: models.Notification, attributes:['createdAt'], required: false, order: [['id', 'DESC']] }
      ]},
      { model: models.Camera, attributes: ['uuid', 'name', 'rpiSerialNo'], required: false, include: [
        { model: models.Event, attributes: ['createdAt'], required: false, order: [['id', 'DESC']] }
      ]}
    ]
  })
  .then(home => {
    if (home == null) {
      var error = new Error('Home not found ' + uuid);
      error.status = 404;
      throw(error);
    }
    //Check this home is same home as the one associated with the user making this request, unless admin user
    if ((home.id != homeId) && !isAdmin) {
      //User is trying to patch a home that is not associated with them, and they are not an admin user
      var error = new Error('Home not found ' + uuid + ' for this user');
      error.status = 404;
      throw(error);      
    }

    //Update any fields
    if ('name' in jsonBody) {
      home.name = jsonBody['name'];
    }
    //Save the changes
    return home.save();
  })
  .then(home => {
    //Return the updated object with the home
    home = home.get({ plain: true });

    //Create notificationCount and lastNotificationTimestamp
    home.Users.forEach((user, j) => {
      home.Users[j]['notificationCount'] = ('Notifications' in user) ? user.Notifications.length : 0;
      home.Users[j]['lastNotificationTimestamp'] = (('Notifications' in user) && (user.Notifications.length > 0)) ? user.Notifications[0].createdAt.getTime() / 1000 : null;
      delete home.Users[j].Notifications;
    });
    //Create eventCount and lastEventTimestamp
    home.Cameras.forEach((camera, j) => {
      home.Cameras[j]['eventCount'] = ('Events' in camera) ? camera.Events.length : 0;
      home.Cameras[j]['lastEventTimestamp'] = (('Events' in camera) && (camera.Events.length > 0)) ? camera.Events[0].createdAt.getTime() / 1000 : null;
      delete home.Cameras[j].Events;        
    });

    delete home.id;
    delete home.updatedAt;
    return home;
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
      case 1:   //like /homes/{uuid}
        if (!validator.isUUID(pathParameters[0])) {
          const err = new Error('Invalid UUID ' + pathParameters[0]);
          err.status = 404;
          throw err;          
        }
        ret = await patchHome(homeId, isAdmin, pathParameters[0], event);
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

