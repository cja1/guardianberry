module.exports = {
  "httpMethod": "POST",
  "requestContext": {
    "authorizer": {
      "claims": {
        "cognito:username": "BLANK_COGNITO_UUID"
      }
    }
  },
  "body": '{"name": "LOCAL TEST","rpiSerialNo": "TEST_SERIAL_NO","homeUUID":"HOME_UUID"}'
};
