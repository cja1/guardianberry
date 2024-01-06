module.exports = {
  "httpMethod": "POST",
  "requestContext": {
    "authorizer": {
      "claims": {
        "cognito:username": "USER_ADMIN_UUID"
      }
    }
  },
  "body": '{"name": "LOCAL TEST","email": "test@test.com","timezone": "Asia/Singapore","mobile": "+6582345678","sendNotifications": "0","locale": "en","homeUUID":"HOME_UUID"}'
};
