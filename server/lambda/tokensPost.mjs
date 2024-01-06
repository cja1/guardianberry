import models from './models/index.mjs';
import { extractMethodAndPath, parseJson, accessControlHeaders } from './utils/index.mjs';
import querystring from 'querystring';

//Define the AWS Cognito OAuth2 token parameters  
const REDIRECT_URI = 'https://compsci.s3.eu-west-1.amazonaws.com/CM3070/client-web/dashboard.html';
const CLIENT_ID = 'siq15pbq01rdbdlcsv473kn0k';
const COGNITO_TOKEN_URL = 'https://guardianberry.auth.eu-west-1.amazoncognito.com/oauth2/token';

/**
 * @swagger
 * 
 * components:
 *   schemas:
 *     Token:
 *       type: object
 *       description: OAuth2 ID and refresh token
 *       required: [idToken,expiresIn]
 *       properties:
 *         idToken:
 *           type: string
 *           description: Number of active cameras in the system
 *           example: eyJraWQiOiJ1K2JOWTc0bU9uVW43SEoydnVl
 *         refreshToken:
 *           type: string
 *           description: Number of active users in the system
 *           example: eyJjdHkiOiJKV1QiLCJlbmMiOiJBMjU2R0NNIiwiYWxnI
 *         expiresIn:
 *           type: integer
 *           description: Number of seconds until the tokens expire
 *           example: 3600
 *
 * /tokens:
 *   post:
 *     tags:
 *     - Tokens
 *     summary: Requests OAuth2 ID and refresh token. Clients - such as a browser - use this endpoint to exchange the code from the OAuth login step with the Token endpoint. Clients can also use this endpoint to refresh tokens by passing-in the refreshToken.
 *     operationId: Request new tokens
 *     security:
 *       - NONE: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               code:
 *                 type: string
 *                 description: OAuth authorisation code from login
 *                 example: 69e60558-37a0-40bf-ae35-73032fee61b8
 *               refreshToken:
 *                 type: string
 *                 description: Refresh token
 *                 example: eyJjdHkiOiJKV1QiLCJlbmMiOiJBMjU2R0NNIiwiYWxnI
 *       required: true
 *     responses:
 *       200:
 *         description: successful operation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               description: The newly created tokens
 *               $ref: '#/components/schemas/Token' 
 *       401:
 *         description: unauthorised - invalid OAuth2 authorisation code
 *       422:
 *         description: unprocessable entity - check error message
 */

//************************************
// POST TOKENS
//************************************
async function postTokens(event) {

  const jsonBody = parseJson(event.body);

  //Check have required body content: code or refreshToken
  if (!('code' in jsonBody) && !('refreshToken' in jsonBody)) {
    const err = new Error('Parameters "code" and "refreshToken" missing. One must be provided.');
    err.status = 422;
    throw err;
  }    

  //Construct the body
  var postData = {
    client_id: CLIENT_ID,
    client_secret: process.env.CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
  };
  if ('code' in jsonBody) {
    postData['grant_type'] = 'authorization_code';
    postData['code'] = jsonBody.code;
  }
  else {
    postData['grant_type'] = 'refresh_token';
    postData['refresh_token'] = jsonBody.refreshToken;
  }
  const body = querystring.stringify(postData);

  return await fetch(COGNITO_TOKEN_URL, {
    method: "POST",
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Content-Length': body.length
    },
    body: body
  })
  .then(response => {
    if (!response.ok) {
      // create error object and reject if not a 2xx response code
      console.log(response.responseText);
      const err = new Error('Invalid authorisation. Please check and try again.');
      err.status = 401;
      throw err;
    }
    return response.json();
  })
  .then(obj => {
    //Note: obj also contains access_token but not needed for browser client API requests so ignore
    if ('code' in jsonBody) {
      //Return the id_token and refresh_token, plus the expiresIn value
      return { idToken: obj.id_token, refreshToken: obj.refresh_token, expiresIn: obj.expires_in };
    }
    //For refresh, just idToken
    return { idToken: obj.id_token, expiresIn: obj.expires_in };
  });
}

export const handler = async (event) => {

  // console.log("Received event:", JSON.stringify(event, null, 2));
  try {
    const { method, pathParameters } = extractMethodAndPath(event);

    if (method !== 'POST') {
      const err = new Error('Invalid request method');
      err.status = 401;
      throw err;
    }

    var ret;
    switch (pathParameters.length) {
      case 0:   //like /tokens
        ret = await postTokens(event);
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

