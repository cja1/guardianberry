import models from './models/index.mjs';
import { extractUserMethodAndPath, parseJson, checkParameters, accessControlHeaders } from './utils/index.mjs';
import validator from 'validator';
import { timeZonesNames } from "@vvo/tzdb";
import { CognitoIdentityProviderClient, ListUsersCommand, AdminCreateUserCommand } from "@aws-sdk/client-cognito-identity-provider";
const cognitoClient = new CognitoIdentityProviderClient({ region: 'eu-west-1' });
import { v4 as uuidv4 } from 'uuid';

//Define a test email address: if this is used then skip creating a Cognito entry and emailing out a temporary password
const TEST_EMAIL = 'test@test.com'

/**
 * @swagger
 * components:
 *   schemas:
 *     UserWithEmailPassword:
 *       type: object
 *       description: User information including the email address and password as well as notifications this user has received. This object is returned when a new user is created.
 *       required: [uuid,name,mobile,sendNotifications,locale,timezone,email,password]
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
 *         email:
 *           type: string
 *           description: The user's email address. This is used by and stored in Cognito and this email address will receive the temporary password from Cognito.
 *           example: bob@example.com
 *         temporaryPassword:
 *           type: string
 *           description: The user's temporary password from Cognito
 *           example: 8851e523-8fd2-4aca-82b5-28ed223e2b06
 *         Notifications:
 *           type: array
 *           description: The notifications this user has received
 *           items:
 *             $ref: '#/components/schemas/Notification' 
 * 
 * /users:
 *   post:
 *     tags:
 *     - Users
 *     summary: Adds a new user to the home associated with the user making the request, unless the user is an admin in which case the user is added to the home identified by the homeUUID value.
 *     operationId: Add new user
 *     security:
 *       - oauth2: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name,email,mobile,sendNotifications,locale,timezone]
 *             properties:
 *               name:
 *                 type: string
 *                 description: The user's name
 *                 example: Bob
 *               email:
 *                 type: string
 *                 description: The user's email address. This is used by and stored in Cognito and this email address will receive the temporary password from Cognito.
 *                 example: bob@example.com
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
 *               description: The newly created User object. Includes the email address and password for Cognito login.
 *               $ref: '#/components/schemas/UserWithEmailPassword' 
 *       401:
 *         description: unauthorised - invalid Authorisation token
 *       422:
 *         description: unprocessable entity - check error message
 */

//************************************
// POST USERS
//************************************
async function postUsers(userId, isAdmin, event) {

  const jsonBody = parseJson(event.body);

  //Check have required body content name, email, mobile, sendNotifications, locale, timezone
  var params = ['name', 'email', 'mobile', 'sendNotifications', 'locale', 'timezone'];
  if (isAdmin) {
    //Also require homeUUID for admin users to identify the home to add the camera to
    params.push('homeUUID');
  }
  checkParameters(params, jsonBody);  //throws 422 error for missing or empty params

  //Check specific parameters:
  if (!validator.isEmail(jsonBody['email'] + '')) {
      const err = new Error('Email "' + jsonBody['email'] + '" is not a valid email address');
      err.status = 422;
      throw err;
  }
  //use strict mode to require + and country code, any country code supported.
  if (!validator.isMobilePhone(jsonBody['mobile'] + '', 'any', { strictMode: true })) {
      const err = new Error('Mobile "' + jsonBody['mobile'] + '" is not a valid mobile phone number');
      err.status = 422;
      throw err;
  }
  if (!validator.isBoolean(jsonBody['sendNotifications'] + '')) {
      const err = new Error('sendNotifications "' + jsonBody['sendNotifications'] + '" is not a valid boolean flag');
      err.status = 422;
      throw err;
  }
  if (!validator.isLocale(jsonBody['locale'] + '')) {
      const err = new Error('locale "' + jsonBody['locale'] + '" is not a valid locale');
      err.status = 422;
      throw err;
  }
  if (!timeZonesNames.includes(jsonBody['timezone'] + '')) {
      const err = new Error('timezone "' + jsonBody['timezone'] + '" is not a valid timezone');
      err.status = 422;
      throw err;
  }

  //if using homeUUID check it is a valid UUID (use + '' to force to string)
  if (isAdmin && !validator.isUUID(jsonBody['homeUUID'] + '')) {
      const err = new Error('homeUUID "' + jsonBody['homeUUID'] + '" is not a valid UUID');
      err.status = 422;
      throw err;
  }

  //Generate a temporary password for this user. Prepend 'A' to force upper case for Cognito password policy
  const temporaryPassword = 'A' + uuidv4();
  var homeId;

  return await Promise.resolve()
  .then(() => {
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
    homeId = home.id;

    //See if this email already exists in AWS Cognito
    const command = new ListUsersCommand({
      UserPoolId: process.env.COGNITO_USER_POOL_ID, 
      Limit: 60
    });
    return cognitoClient.send(command);
  })
  .then(response => {

    var emailExists = false;
    //Step through Cognito users
    response.Users.forEach(user => {
      //Step through the attributes looking for the one with Name: email
      user.Attributes.forEach(attribute => {
        if ((attribute.Name == 'email') && (attribute.Value == jsonBody['email'])) {
          emailExists = true;
        }
      });
    });

    if (emailExists) {
      const err = new Error('Email ' + jsonBody['email'] + ' exists');        
      err.status = 422;
      throw err;      
    }

    //Only create cognito entry if not test email, otherwise use null uuid 00000000-0000-0000-0000-000000000000
    if (jsonBody['email'] == TEST_EMAIL) {
      return { User: { Username: '00000000-0000-0000-0000-000000000000' } };
    }

    //Based on these instructions: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/cognito-identity-provider/command/AdminCreateUserCommand/
    //Create a new user in Cognito
    const command = new AdminCreateUserCommand({
      UserPoolId: process.env.COGNITO_USER_POOL_ID,
      Username: jsonBody['email'],
      DesiredDeliveryMediums: ['EMAIL'],
      TemporaryPassword: temporaryPassword
    });
    return cognitoClient.send(command);
  })
  .then(response => {
    //The Cognito id is stored in response.User.Username
    const cognitoId = response.User.Username;

    //Create the new User object
    return models.User.create({
      name: jsonBody['name'],
      mobile: jsonBody['mobile'],
      sendNotifications: jsonBody['sendNotifications'],
      locale: jsonBody['locale'],
      timezone: jsonBody['timezone'],
      cognitoId: cognitoId,
      HomeId: homeId
    });
  })
  .then(user => {
    //Return the new object
    return { 
      uuid: user.uuid,
      name: user.name,
      mobile: user.mobile,
      sendNotifications: user.sendNotifications,
      locale: user.locale,
      timezone: user.timezone,
      email: jsonBody['email'],
      temporaryPassword: temporaryPassword,
      Notifications: []
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
      case 0:   //like /users
        ret = await postUsers(userId, isAdmin, event);
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

