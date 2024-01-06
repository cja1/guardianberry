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
    "proxy": "USER_UUID",
  },
  "body": '{"name": "LOCAL TEST - EDITED"}'
};
