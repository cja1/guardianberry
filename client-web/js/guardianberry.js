//GuardianBerry utility functions - used across multiple pages

//Define the GuardianBerry API endpoint
const API_ENDPOINT = 'https://djw3nqkltk.execute-api.eu-west-1.amazonaws.com/production';
const COGNITO_REFRESH_TOKEN_EXPIRY = 30 * 24 * 60 * 60; //AWS Cognito: 30 days refresh token expiry

//Configure raw cookies for debugging simplicity
$.cookie.raw = true;

//Call the GuardianBerry /tokens endpoint to get an identity token
function getTokens(code, completionFunction) {
  //If code set, swap this code for an identity token. Else try to refresh the token using the refreshToken stored in the cookie.
  var data;
  if (code != null) {
    data = { code: code };
  }
  else {
    data = { refreshToken: $.cookie('refreshToken') };    
  }

  $.post({ url: API_ENDPOINT + '/tokens', data: JSON.stringify(data) })
  .done(response => {
    //Save idToken to cookie that expires in expiresIn seconds
    $.cookie('idToken', response.idToken, { expires: response.expiresIn, secure: true });
    if (code) {
      //Only set refresh token if initial authorisation code request. Otherwise refreshToken already set.
      $.cookie('refreshToken', response.refreshToken, { expires: COGNITO_REFRESH_TOKEN_EXPIRY, secure: true });
    }
    setupAjax();

    //Call completion function
    if (typeof completionFunction === 'function') {
      completionFunction();
    }
  })
  .fail(err => {
    // console.log(err);
    logout();
  });
}

function setupAjax() {
  //Use ajaxSetup to set the authorisation header and base url for all future requests
  $.ajaxSetup({
    beforeSend: function(xhr, options) {
      xhr.setRequestHeader('Authorization', $.cookie('idToken'));
      options.url = API_ENDPOINT + options.url;
    }
  });
}

function logout(argument) {
  //Remove any cookies
  $.removeCookie('idToken');
  $.removeCookie('refreshToken');

  //Return to index page
  window.location = 'index.html';
}

//On document ready setup common event management - logout button
$(() => {
  //Logout button click
  $('#logout').on('click', () => {
    logout();
  });
});

//Return the user with the user isMe flag set to true
function findUserMe(users) {
  var ret = null;
  users.forEach(user => {
    if (user.isMe) {
      ret = user;
    }
  });
  return ret;
}

//Take a timestamp and return a date time string in the user's locale and timezone
function dateTimeStringForUser(timestamp, user) {
  return dateStringForUser(timestamp, user) + ' ' + timeStringForUser(timestamp, user);
}
//Version with just date - long date format
function dateStringForUser(timestamp, user) {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString(user.locale, { timeZone: user.timezone, weekday: "long", year: "numeric", month: "long", day: "numeric" });
}
//Version with just date - short date format
function dateStringShortForUser(timestamp, user) {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString(user.locale, { timeZone: user.timezone, year: "2-digit", month: "2-digit", day: "2-digit" });
}
//Version with just time
function timeStringForUser(timestamp, user) {
  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString(user.locale, { timeZone: user.timezone, hour12: true });
}

//Return a string like '10 secs ago or '10 hours ago'
function timeAgoForUser(timestamp, user) {
  if (timestamp == null) {
    return 'never';
  }

  const formatter = new Intl.RelativeTimeFormat('en');  //Force to English for now
  const ranges = {
    years: 3600 * 24 * 365,
    months: 3600 * 24 * 30,
    weeks: 3600 * 24 * 7,
    days: 3600 * 24,
    hours: 3600,
    minutes: 60,
    seconds: 1
  };
  const secondsElapsed = (timestamp * 1000 - Date.now()) / 1000;
  for (let key in ranges) {
    if (ranges[key] < Math.abs(secondsElapsed)) {
      const delta = secondsElapsed / ranges[key];
      return formatter.format(Math.round(delta), key);
    }
  }
}

//Create a blank gray image using svg for the desired height and text
function blankImage(height, message) {
  var html = ' \
    <svg class="bd-placeholder-img" width="100%" height="[HEIGHT]" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Blank image" preserveAspectRatio="xMidYMid slice" focusable="false"> \
      <rect width="100%" height="100%" fill="#868e96"></rect> \
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#dee2e6">[MESSAGE]</text> \
    </svg> ';
  html = html.replace('[HEIGHT]', height + ''); //Use + '' to force number to string
  html = html.replace('[MESSAGE]', message);
  return html;
}

//Image sourced from camera object
function imageHtml(camera) {
  return '<img src="' + camera.lastEventImageUrl + '" alt="' + camera.name + '" class="img-fluid">';
}

//Add / remove spinner to a button
//Based on this code: https://stackoverflow.com/questions/54522830/bootstrap-4-loading-spinner-in-button
function btnLoading(elementName, message) {
  $('#' + elementName).attr("data-original-text", $('#' + elementName).text()); // <-use .text() instead of .html()
  $('#' + elementName).prop("disabled", true);
  $('#' + elementName).html('<span class="spinner-border spinner-border-sm align-middle" aria-hidden="true" role="status"></span> ' + message);
}

function btnReset(elementName) {
  $('#' + elementName).prop("disabled", false);
  $('#' + elementName).text($('#' + elementName).attr("data-original-text"));
}

//Show toast
function showToast(title, message, isSuccess) {
  //Background colour
  $('#toast').removeClass('text-bg-success').removeClass('text-bg-danger');
  $('#toast').addClass(isSuccess ? 'text-bg-success' : 'text-bg-danger');

  $('#toastTitle').html(title);
  $('#toastBody').html(message);
  const toast = new bootstrap.Toast(document.getElementById('toast'), { 'autohide': true, 'delay': 5000 });
  toast.show();
}

