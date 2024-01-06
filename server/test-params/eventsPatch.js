module.exports = {
  "httpMethod": "PATCH",
  "requestContext": {
    "authorizer": {
      "claims": {
        "cognito:username": "USER_TEST_UUID"
      }
    }
  },
  "pathParameters": {
    "proxy": "655c3abd-84cf-43e6-a23b-61e58879d94e",
  },
  "body": '{"isViewed": "true"}'
};
