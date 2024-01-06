import models from './models/index.mjs';
import { extractUserMethodAndPath, accessControlHeaders } from './utils/index.mjs';

/**
 * @swagger
 *
 * components:
 *   schemas:
 *     Notification:
 *       type: object
 *       description: Notification sent to a user
 *       required: [uuid,message]
 *       properties:
 *         uuid:
 *           type: string
 *           description: A unique UUID for this notification
 *           example: f6d86e38-567a-436d-92b7-dbef9e5749fb
 *         message:
 *           type: string
 *           description: The notification content
 *           example: Intruder Alert!
 * 
 *     User:
 *       type: object
 *       description: User information including the notifications this user has received
 *       required: [uuid,name,mobile,sendNotifications,locale,timezone]
 *       properties:
 *         uuid:
 *           type: string
 *           description: A unique UUID for this user
 *           example: bf72126e-9c8a-4638-ace8-0b2e1e3e3901
 *         name:
 *           type: string
 *           description: The user's name
 *           example: Bob
 *         mobile:
 *           type: string
 *           description: The user's mobile phone number, including the international country code.
 *           example: '+6512345678'
 *         sendNotifications:
 *           type: boolean
 *           description: Flag indicating whether this user wants to receiver intruder notifications or not
 *           example: true
 *         locale:
 *           type: string
 *           description: The user's locale as a string
 *           example: en-GB
 *         timezone:
 *           type: string
 *           description: The user's timezone as a string
 *           example: America/Los_Angeles
 *         isMe:
 *           type: boolean
 *           description: Flag indicating whether this user is the user making the API request
 *           example: true
 *         Notifications:
 *           type: array
 *           description: The notifications this user has received
 *           items:
 *             $ref: '#/components/schemas/Notification' 
 * 
 * /users:
 *   get:
 *     tags:
 *     - Users
 *     summary: Gets a list of users associated with the home of the user making the request. The request also returns details about all the notifications each user has received.
 *     operationId: Get a list of users
 *     security:
 *       - oauth2: []
 *     responses:
 *       200:
 *         description: successful operation
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               description: Array of Home objects
 *               items:
 *                 $ref: '#/components/schemas/User' 
 *       401:
 *         description: unauthorised - invalid Authorisation token
 */

//************************************
// GET USERS
//************************************
async function getUsers(homeId, userId) {

  //Get all users associated with this home
  return await models.User.findAll({
    attributes: ['id', 'uuid', 'name', 'mobile', 'sendNotifications', 'locale', 'timezone'],
    where: { HomeId: homeId },
    include: [
      { model: models.Notification, attributes:['uuid', 'message', 'createdAt'], required: false, order: [['id', 'DESC']] }
    ],
    order: [['name', 'ASC']]
  })
  .then(users => {
    //Create output data with notification timestamp
    var out = [];
    users.forEach((user, i) => {
      //Convert to POJO
      user = user.get({ plain: true });

      //Add isMe flag
      user['isMe'] = (user.id == userId);
      delete user.id;

      //Create notificationCount and lastNotificationTimestamp
      user.Notifications.forEach((notification, j) => {
        user.Notifications[j]['timestamp'] = user.Notifications[j].createdAt.getTime() / 1000;
        delete user.Notifications[j].createdAt;
      });
      out.push(user)
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
      case 0:   //like /users
        ret = await getUsers(homeId, userId);
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

