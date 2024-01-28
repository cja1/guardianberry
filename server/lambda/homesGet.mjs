import models from './models/index.mjs';
import { extractUserMethodAndPath, accessControlHeaders, generatePresignedImageUrls } from './utils/index.mjs';

/**
 * @swagger
 *
 * components:
 *   schemas:
 *     Home:
 *       type: object
 *       description: Home information
 *       required: [uuid,name,Users,Cameras]
 *       properties:
 *         uuid:
 *           type: string
 *           description: A unique UUID for this home
 *           example: 976e9707-a564-4d7e-97cb-8358c2d3089f
 *         name:
 *           type: string
 *           description: The name of the home
 *           example: 1 The Street
 *         Users:
 *           type: array
 *           description: The users associated with this home
 *           items:
 *             $ref: '#/components/schemas/UserWithNotificationInfo' 
 *         Cameras:
 *           type: array
 *           description: The cameras associated with this home
 *           items:
 *             $ref: '#/components/schemas/CameraWithEventInfo' 
 * 
 *     UserWithNotificationInfo:
 *       type: object
 *       description: User information with notification count and last notification timestamp
 *       required: [uuid,name,mobile,sendNotifications,locale,timezone,notificationCount,lastNotificationTimestamp]
 *       properties:
 *         uuid:
 *           type: string
 *           description: A unique UUID for this user
 *           example: 254b65ac-9766-4007-99f8-f78b6191f2d1
 *         name:
 *           type: string
 *           description: The user's name
 *           example: Bob
 *         mobile:
 *           type: string
 *           description: The user's mobile phone number
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
 *         notificationCount:
 *           type: integer
 *           description: The number of notifications this user has received
 *           example: 15
 *         lastNotificationTimestamp:
 *           type: integer
 *           description: The unix timestanp in seconds of the last notification this user received
 *           example: 1701003729
 *
 *     CameraWithEventInfo:
 *       type: object
 *       description: Camera information with event count and last event timestamp
 *       required: [uuid,name,eventCount,lastEventTimestamp]
 *       properties:
 *         uuid:
 *           type: string
 *           description: A unique UUID for this camera
 *           example: d8e7f6d8-4ea4-49b4-a45a-77f6d48a0d51
 *         name:
 *           type: string
 *           description: The camera name
 *           example: Hallway camera
 *         rpiSerialNo:
 *           type: string
 *           description: The Raspberry Pi serial number for this camera
 *           example: 10000000abc123ea
 *         createdAt:
 *           type: integer
 *           description: The unix timestanp in seconds of the date this camera was added to the system
 *           example: 1701003733
 *         eventCount:
 *           type: integer
 *           description: The number of events this camera has triggered
 *           example: 25
 *         lastEventTimestamp:
 *           type: integer
 *           description: The unix timestanp in seconds of the last event this camera triggered
 *           example: 1701003733
 *         lastEventImageUrl:
 *           type: string
 *           description: The URL for the first detection image of the last event (pre-signed url)
 * 
 * /homes:
 *   get:
 *     tags:
 *     - Homes
 *     summary: Gets the homes associated with the user making the request. Note that because a standard user can only be associated with 1 home that this will return an array with at most one home.<br/><br/>If the user is an administrator then all homes are returned. The request also returns details about all the users, cameras and a count of the events and notifications received.
 *     operationId: Get a list of homes
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
 *                 $ref: '#/components/schemas/Home' 
 *       401:
 *         description: unauthorised - invalid Authorisation token
 */

//************************************
// GET HOMES
//************************************
async function getHomes(homeId, userId) {

  //Get the homes, including the Users, Notifications, Cameras and Events associated with it
  //if !isAdmin then just home for this user (ie home associated with homeId). If admin then all homes.
  var out = [];

  const start = +new Date();
  var intermediate = +new Date();

  return await models.Home.findAll({
    attributes: ['uuid', 'name'],
    include: [
      { model: models.User, attributes: ['id', 'uuid', 'name', 'mobile', 'sendNotifications', 'locale', 'timezone'], required: false, include: [
        { model: models.Notification, attributes:['createdAt'], required: false }
      ]},
      { model: models.Camera, attributes: ['uuid', 'name', 'rpiSerialNo', 'createdAt'], required: false, include: [
        { model: models.Event, attributes: ['createdAt', 'imageFilename'], required: false }
      ]}
    ],
    order: [
      ['name', 'ASC'],
      [ models.sequelize.col('Users.Notifications.createdAt'), 'DESC' ],
      [ models.sequelize.col('Cameras.Events.createdAt'), 'DESC' ]
    ]
  })
  .then(homes => {
    console.log('findAll', (+new Date()) - intermediate);
    intermediate = +new Date();
    //Create output data with counts of events and notifications plus last event date and last notification date
    var imageFilenames = [];

    homes.forEach(home => {
      //Convert to POJO
      home = home.get({ plain: true });
      //Create isMe flag, notificationCount and lastNotificationTimestamp
      home.Users.forEach((user, j) => {
        home.Users[j]['isMe'] = (user.id == userId);
        delete home.Users[j].id;
        home.Users[j]['notificationCount'] = ('Notifications' in user) ? user.Notifications.length : 0;
        home.Users[j]['lastNotificationTimestamp'] = (('Notifications' in user) && (user.Notifications.length > 0)) ? user.Notifications[0].createdAt.getTime() / 1000 : null;
        delete home.Users[j].Notifications;
      });
      //Create eventCount, lastEventTimestamp, lastEventImageUrl
      home.Cameras.forEach((camera, j) => {
        home.Cameras[j]['createdAt'] = camera.createdAt.getTime() / 1000;
        home.Cameras[j]['eventCount'] = ('Events' in camera) ? camera.Events.length : 0;
        home.Cameras[j]['lastEventTimestamp'] = (('Events' in camera) && (camera.Events.length > 0)) ? camera.Events[0].createdAt.getTime() / 1000 : null;

        //Pre-signed URL for image
        if (('Events' in camera) && (camera.Events.length > 0)) {
          const imageFilename = camera.Events[0].imageFilename;
          imageFilenames.push(imageFilename);
          //Store the imageFilename temporarily. We will replace this once we have the presigned url.
          home.Cameras[j]['lastEventImageUrl'] = imageFilename;
        }
        else {
          home.Cameras[j]['lastEventImageUrl'] = null;          
        }
        delete home.Cameras[j].Events;
      });
      out.push(home);
    });
    return generatePresignedImageUrls(imageFilenames)
  })
  .then(presignedUrls => {
    console.log('presignedUrls', (+new Date()) - intermediate);
    intermediate = +new Date();

    //Now replace any lastEventImageUrl that are non-null with the presigned URL
    out.forEach((home, i) => {
      home.Cameras.forEach((camera, j) => {
        if (camera.lastEventImageUrl != null) {
          const imageFilename = camera.lastEventImageUrl;
          // console.log(camera.lastEventImageUrl, presignedUrls[imageFilename]);
          out[i].Cameras[j].lastEventImageUrl = presignedUrls[imageFilename];
        }
      })
    });

    //Sort cameras by eventCount descending so cameras with most events appear first
    out.forEach((home, i) => {
      out[i].Cameras = home.Cameras.sort((a, b) => b.eventCount - a.eventCount);
    });

    console.log('sorting', (+new Date()) - intermediate);
    console.log('total', (+new Date()) - start);
    return out;
  });
}

//************************************
// GET HOME
//************************************
async function getHome(homeId, userId) {

  //Get the home, including the Users, Notifications, Cameras and Events associated with it
  const start = +new Date();
  var intermediate = +new Date();
  var home;

  //Just events in the last 90 days
  const daysAgo = new Date(new Date().setDate(new Date().getDate() - 90));

  return await models.Home.findOne({
    attributes: ['uuid', 'name'],
    where: { id: homeId },
    include: [
      { model: models.Camera, attributes: ['uuid', 'name', 'rpiSerialNo', 'createdAt'], required: false, include: [
        { model: models.Event, attributes: ['recordingStartTime', 'imageFilename'], required: false,
          where: {
            videoFilename: { [models.Sequelize.Op.ne]: null },
            recordingStartTime: { [models.Sequelize.Op.gt]: daysAgo, [models.Sequelize.Op.lt]: new Date() }
          }
        }
      ]}
    ],
    order: [
      ['name', 'ASC'],
      [ models.sequelize.col('Cameras.Events.recordingStartTime'), 'DESC' ]
    ]
  })
  .then(thisHome => {
    console.log('findOne', (+new Date()) - intermediate);
    intermediate = +new Date();
    //Create output data with counts of events and notifications plus last event date and last notification date
    var imageFilenames = [];

    //Convert to POJO
    home = thisHome.get({ plain: true });

    //Create eventCount, lastEventTimestamp, lastEventImageUrl
    home.Cameras.forEach((camera, j) => {
      home.Cameras[j]['createdAt'] = camera.createdAt.getTime() / 1000;
      home.Cameras[j]['eventCount'] = ('Events' in camera) ? camera.Events.length : 0;
      home.Cameras[j]['lastEventTimestamp'] = (('Events' in camera) && (camera.Events.length > 0)) ? camera.Events[0].recordingStartTime.getTime() / 1000 : null;

      //Pre-signed URL for image
      if (('Events' in camera) && (camera.Events.length > 0)) {
        const imageFilename = camera.Events[0].imageFilename;
        imageFilenames.push(imageFilename);
        //Store the imageFilename temporarily. We will replace this once we have the presigned url.
        home.Cameras[j]['lastEventImageUrl'] = imageFilename;
      }
      else {
        home.Cameras[j]['lastEventImageUrl'] = null;          
      }
      delete home.Cameras[j].Events;
    });
    return generatePresignedImageUrls(imageFilenames)
  })
  .then(presignedUrls => {
    console.log('presignedUrls', (+new Date()) - intermediate);
    intermediate = +new Date();

    //Now replace any lastEventImageUrl that are non-null with the presigned URL
    home.Cameras.forEach((camera, j) => {
      if (camera.lastEventImageUrl != null) {
        const imageFilename = camera.lastEventImageUrl;
        // console.log(camera.lastEventImageUrl, presignedUrls[imageFilename]);
        home.Cameras[j].lastEventImageUrl = presignedUrls[imageFilename];
      }
    });

    //Sort cameras by eventCount descending so cameras with most events appear first
    home.Cameras = home.Cameras.sort((a, b) => b.eventCount - a.eventCount);

    console.log('sorting cameras', (+new Date()) - intermediate);
    intermediate = +new Date();

    //Get users for home
    return models.User.findAll({
      attributes: ['id', 'uuid', 'name', 'mobile', 'sendNotifications', 'locale', 'timezone'],
      where: { HomeId: homeId },
      include: [{ model: models.Notification, attributes:['createdAt'], required: false }],
      order: [
        [ models.sequelize.col('Notifications.createdAt'), 'DESC' ]
      ]
    });
  })
  .then(users => {
    // Create isMe flag, notificationCount and lastNotificationTimestamp
    var usersOut = [];
    users.forEach((user, j) => {
      user = user.get({ plain: true });
      user['isMe'] = (user.id == userId);
      delete user.id;
      user['notificationCount'] = ('Notifications' in user) ? user.Notifications.length : 0;
      user['lastNotificationTimestamp'] = (('Notifications' in user) && (user.Notifications.length > 0)) ? user.Notifications[0].createdAt.getTime() / 1000 : null;
      delete user.Notifications;
      usersOut.push(user);
    });
    home['Users'] = usersOut;

    console.log('findAll users', (+new Date()) - intermediate);
    intermediate = +new Date();
    console.log('total', (+new Date()) - start);
    return home;
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
      case 0:   //like /homes
        if (isAdmin) {
          ret = await getHomes(homeId, userId);
        }
        else {
          ret = await getHome(homeId, userId);
          ret = [ret];  //Return as array
        }
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

