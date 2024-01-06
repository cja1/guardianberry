module.exports = {
  "httpMethod": "DELETE",
  "requestContext": {
    "authorizer": {
      "claims": {
        "cognito:username": "USER_ADMIN_UUID"
      }
    }
  },
  "pathParameters": {
    "proxy": "HOME_UUID",
  }
};
