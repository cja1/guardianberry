module.exports = {
  "httpMethod": "DELETE",
  "requestContext": {
    "authorizer": {
      "claims": {
        "cognito:username": "BLANK_COGNITO_UUID"
      }
    }
  },
  "pathParameters": {
    "proxy": "CAMERA_UUID",
  }
};
