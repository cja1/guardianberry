module.exports = {
  "httpMethod": "PATCH",
  "requestContext": {
    "authorizer": {
      "claims": {
        "cognito:username": "BLANK_COGNITO_UUID"
      }
    }
  },
  "pathParameters": {
    "proxy": "CAMERA_UUID",
  },
  "body": '{"name": "LOCAL TEST - EDITED"}'
};
