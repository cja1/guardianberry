import models from './models/index.mjs';
import { extractUserMethodAndPath, extractCognitoId, accessControlHeaders } from './utils/index.mjs';
import validator from 'validator';
import { CognitoIdentityProviderClient, ListUsersCommand, AdminDeleteUserCommand } from "@aws-sdk/client-cognito-identity-provider";
const cognitoClient = new CognitoIdentityProviderClient({ region: 'eu-west-1' });

/**
 * @swagger
 *
 * /users/{uuid}:
 *   delete:
 *     tags:
 *     - Users
 *     summary: Delete a user. Note - can't delete self, and can't delete a user associated with another home.
 *     operationId: Delete a user
 *     parameters:
 *       - name: uuid
 *         in: path
 *         description: The unique UUID for this user
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
 *         description: user not found
 *       409:
 *         description: conflict - can not delete self
 */

//************************************
// DELETE USER
//************************************
async function deleteUser(userId, isAdmin, homeId, cognitoId, uuid) {

  var user;

  //See if this user exists - include paranoid: false to include deleted users
  return await models.User.findOne({
    attributes: ['id', 'cognitoId', 'deletedAt', 'HomeId'],
    where: { uuid: uuid },
    paranoid: false
  })
  .then(thisUser => {
    user = thisUser;  //need to hold on to this

    if (user == null) {
      var error = new Error('User not found: ' + uuid);
      error.status = 404;
      throw(error);
    }
    if (user.id == userId) {
      //Can't delete self
      var error = new Error('Can not delete self');
      error.status = 409;
      throw(error);      
    }
    if ((user.HomeId != homeId) && !isAdmin) {
      //User is trying to delete a user from another home and they are not an admin
      var error = new Error('User not found ' + uuid + ' for this home');
      error.status = 404;
      throw(error);
    }

    //If user already deleted then return (DELETE is idempotent)
    if (user.deletedAt != null) {
      return Promise.resolve(null);
    }

    //See if this user exists in AWS Cognito
    const command = new ListUsersCommand({
      UserPoolId: process.env.COGNITO_USER_POOL_ID, 
      Limit: 60
    });
    return cognitoClient.send(command);
  })
  .then(response => {

    if (response == null) { //user already deleted
      return Promise.resolve(null);
    }

    var userExists = false;
    //Step through Cognito users
    response.Users.forEach(user => {
      //Step through the attributes looking for the one with Name: sub
      user.Attributes.forEach(attribute => {
        if ((attribute.Name == 'sub') && (attribute.Value == cognitoId)) {
          userExists = true;
        }
      });
    });

    if (!userExists) {
      return Promise.resolve(null);
    }

    //Delete from Cognito
    const command = new AdminDeleteUserCommand({
      UserPoolId: process.env.COGNITO_USER_POOL_ID,
      Username: user.cognitoId
    });
    return cognitoClient.send(command);
  })
  .then(response => {
    if (user.deletedAt == null) {
      //Need to delete
      return user.destroy();
    }
  })
}

export const handler = async (event) => {

  // console.log("Received event:", JSON.stringify(event, null, 2));

  try {
    const { userId, isAdmin, homeId, method, pathParameters } = await extractUserMethodAndPath(event);
    const cognitoId = extractCognitoId(event);

    if (method !== 'DELETE') {
      const err = new Error('Invalid request method');
      err.status = 401;
      throw err;
    }

    switch (pathParameters.length) {
      case 1:   //like /users/{uuid}
        if (!validator.isUUID(pathParameters[0])) {
          const err = new Error('Invalid UUID ' + pathParameters[0]);
          err.status = 404;
          throw err;          
        }
        await deleteUser(userId, isAdmin, homeId, cognitoId, pathParameters[0]);
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

