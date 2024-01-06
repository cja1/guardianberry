import models from './models/index.mjs';
import { extractMethodAndPath, accessControlHeaders } from './utils/index.mjs';

/**
 * @swagger
 *
 * components:
 *   schemas:
 *     Stats:
 *       type: object
 *       description: System usage stats
 *       required: [homeCount,cameraCount,userCount,eventCount,notificationCount]
 *       properties:
 *         homeCount:
 *           type: integer
 *           description: Number of active homes in the system
 *           example: 5
 *         cameraCount:
 *           type: integer
 *           description: Number of active cameras in the system
 *           example: 10
 *         userCount:
 *           type: integer
 *           description: Number of active users in the system
 *           example: 5
 *         eventCount:
 *           type: integer
 *           description: Number of events triggered by cameras
 *           example: 100
 *         notificationCount:
 *           type: integer
 *           description: Number of notifications sent
 *           example: 120
 * 
 * /stats:
 *   get:
 *     tags:
 *     - Stats
 *     summary: Gets the statistics about the GuardianBerry system- how many homes, cameras, users, events and notifications are in the system.<br/><br/>This endpoint does not require authorisation. It is intended for marketing the GuardianBerry system and is used to provide stats on the publicly available GuardianBerry website.
 *     operationId: Get system stats
 *     security:
 *       - NONE: []
 *     responses:
 *       200:
 *         description: successful operation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               description: The Stats object
 *               $ref: '#/components/schemas/Stats' 
 */

//************************************
// GET STATS
//************************************
async function getStats() {

  var out = {};

  return await models.Home.count()
  .then(count => {
    out['homeCount'] = count;
    return models.Camera.count();
  })
  .then(count => {
    out['cameraCount'] = count;
    return models.User.count();
  })
  .then(count => {
    out['userCount'] = count;
    return models.Event.count();
  })
  .then(count => {
    out['eventCount'] = count;
    return models.Notification.count();
  })
  .then(count => {
    out['notificationCount'] = count;
    return out;
  })
}

export const handler = async (event) => {

  // console.log("Received event:", JSON.stringify(event, null, 2));

  try {
    const { method, pathParameters } = extractMethodAndPath(event);

    if (method !== 'GET') {
      const err = new Error('Invalid request method');
      err.status = 401;
      throw err;
    }

    var ret;
    switch (pathParameters.length) {
      case 0:   //like /stats
        ret = await getStats();
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

