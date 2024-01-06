module.exports = {
  "httpMethod": "POST",
  "requestContext": {
    "authorizer": {
      "claims": {
        "cognito:username": "USER_ADMIN_UUID"
      }
    }
  },
  "body": '{"name": "LOCAL TEST"}'
};
