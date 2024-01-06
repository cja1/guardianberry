module.exports = {
  "httpMethod": "PATCH",
  "requestContext": {
    "authorizer": {
      "claims": {
        "cognito:username": "USER_ADMIN_UUID"
      }
    }
  },
  "pathParameters": {
    "proxy": "HOME_UUID",
  },
  "body": '{"name": "LOCAL TEST - EDITED"}'
};
