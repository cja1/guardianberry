//************************************
// GuardianBerry utility functions
//************************************

import models from '../models/index.mjs';
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { S3, S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { readFileSync, createWriteStream, statSync } from "fs"
import axios from 'axios';

import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
ffmpeg.setFfmpegPath(ffmpegPath.path);

const S3_BUCKET_IMAGES = 'guardianberry.images';
const S3_BUCKET_VIDEOS = 'guardianberry.videos';

const PRESIGNED_URL_EXPIRY = 60 * 60; //seconds

//Return static access control headers for CORS support
export function accessControlHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Requested-With'
  };
}

//Standard code to use the cognito id to lookup the user id, user isAdmin flag, home id in the Users table, get the method and path parameters
export async function extractUserMethodAndPath(event) {
  if (event?.requestContext?.authorizer?.claims['cognito:username'] === undefined) {
    const err = new Error('Unauthorised');
    err.status = 401;
    throw err;
  }
  const cognitoId = event.requestContext.authorizer.claims['cognito:username'];
  return await models.User.findOne({ 
    where: { cognitoId: cognitoId }
  })
  .then(user => {
    if (user == null) {
      const err = new Error('User with cognito id ' + cognitoId + ' not found');
      err.status = 401;
      throw err;
    }
    const method = event.httpMethod || 'undefined';       //like GET or POST
    const pathParameters = (event.pathParameters == null || !event.pathParameters.proxy) ? [] : event.pathParameters.proxy.split('/');
    return { userId: user.id, isAdmin: user.isAdmin, homeId: user.HomeId, method: method, pathParameters: pathParameters };
  });
}

//Version of the above function with no authorisation, so no database lookup for a valid user based on cognito id
export function extractMethodAndPath(event) {
  const method = event.httpMethod || 'undefined';       //like GET or POST
  const pathParameters = (event.pathParameters == null || !event.pathParameters.proxy) ? [] : event.pathParameters.proxy.split('/');
  return { method: method, pathParameters: pathParameters };
}

//Just extract the cognito id - used for user DELETE endpoint only
export function extractCognitoId(event) {
  if (event?.requestContext?.authorizer?.claims['cognito:username'] !== undefined) {
    return event.requestContext.authorizer.claims['cognito:username'];
  }
  return null;
}

//Safe parse JSON - used for event body parsing
export function parseJson(str) {
  if (str == null) {
    return {};
  }
  try {
    const json = JSON.parse(str)
    return json;
  } catch (e) {
    return {};
  }
}

//Check parameters exist in json object and are not blank
//Note - force to string using +'' before using trim()
export function checkParameters(params, jsonObj) {
  params.forEach(param => {
    if (!(param in jsonObj)) {
      const err = new Error('Parameter "' + param + '" missing');
      err.status = 422;
      throw err;
    }
    if ((jsonObj[param] + '').trim().length == 0) {
      const err = new Error('Parameter "' + param + '" empty');
      err.status = 422;
      throw err;
    }
  });
}

//Count parameters that exist in json object and are not blank
//Note - force to string using +'' before using trim()
export function countParameters(params, jsonObj) {
  var count = 0;
  params.forEach(param => {
    if ((param in jsonObj) && ((jsonObj[param] + '').trim().length > 0)) {
      count += 1;
    }
  });
  return count;
}

//Pre-signed URL helper functions
async function generatePresignedUrl(bucket, key) {
  const client = new S3Client();
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return await getSignedUrl(client, command, { expiresIn: PRESIGNED_URL_EXPIRY })
  .then(url => {
    //Need to return the key as well as the url so we can figure out which url is associated with which key
    //for when processing multiple keys / urls. Use it like a hash with the key.
    //Need to use [key] as opposed to key to use the variable key as opposed to the string 'key'
    //Computed Property Names: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Object_initializer#computed_property_names
    return { [key]: url };
  });
}

//Process multiple keys
async function generatePresignedUrls(bucket, keys) {
  var promises = [];
  keys.forEach(key => {
    promises.push(generatePresignedUrl(bucket, key));
  });
  return await Promise.all(promises)
  .then(arr => {
    //Flatten the array. Currently like [{ key1: url1 }, { key2: url2 }]. Want { key1: url1, key2: url2 }.
    var out = {};
    arr.forEach(item => {         //item like { key1: url1 }
      Object.assign(out, item);   //Assign adds item objects to out
    });
    return out;
  })
}

//Two functions that return just the presigned url
export async function generatePresignedImageUrl(key) {
  return await generatePresignedUrl(S3_BUCKET_IMAGES, key)
  .then(response => {
    return response[key];
  });
}
export async function generatePresignedVideoUrl(key) {
  return await generatePresignedUrl(S3_BUCKET_VIDEOS, key)
  .then(response => {
    return response[key];
  });
}

//Two functions that return an array of { key: ..., url: ... } objects
export async function generatePresignedImageUrls(keys) {
  return await generatePresignedUrls(S3_BUCKET_IMAGES, keys);
}
export async function generatePresignedVideoUrls(keys) {
  return await generatePresignedUrls(S3_BUCKET_VIDEOS, keys);
}
//Export one image url and one video url
export async function generatePresignedImageAndVideoUrl(imageKey, videoKey) {
  var imageUrl;
  return await generatePresignedUrl(S3_BUCKET_IMAGES, imageKey)
  .then(response => {
    imageUrl = response[imageKey];
    return generatePresignedUrl(S3_BUCKET_VIDEOS, videoKey);
  })
  .then(response => {
    const videoUrl = response[videoKey];
    return [imageUrl, videoUrl];
  });
}

export async function addMetadataToVideoFile(metadata, videoKey) {
  const localPath = '/tmp/' + videoKey;
  const localPathWithMetadata = '/tmp/edited-' + videoKey;

  //Get presigned URL first
  const url = await generatePresignedVideoUrl(videoKey);

  //Download to local file
  const response = await axios.get(url, { responseType: 'stream' });
  const writer = createWriteStream(localPath);
  response.data.pipe(writer);
  await new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });

  //Check file size is non-zero
  const stats = statSync(localPath);
  if (stats.size == 0) {
    //Skip file
    return;
  }

  // //Get metadata
  // const s3 = new S3({ region: 'eu-west-1' });
  // const metadata = await s3.headObject({ Bucket: S3_BUCKET_VIDEOS, Key: videoKey });

  //Create array with metadata
  var options = [];
  for (var key in metadata.Metadata) {
    if (key == 'recording_start_time') {  //skip time as we use the upload time rather than being reliant on Raspberry Pi time
      continue;
    }
    options.push(key + ': ' + metadata.Metadata[key]);
  }
  const title = options.join(', ');
  // console.log(title);

  //Save metadata to title in new local file
 await new Promise((resolve, reject) => {
   ffmpeg(localPath)
    .outputOptions('-metadata', 'title="' + title + '"')
    .save(localPathWithMetadata)
    .on('end', () => {
      // console.log('wrote file with metadata', localPathWithMetadata);
      resolve();
    })
    .on('error', (err) => {
      console.error('Error processing file', err);
      reject(err);
    });
  });

  //Save back to S3
  const data = readFileSync(localPathWithMetadata);
  const client = new S3Client();
  await client.send(new PutObjectCommand({ 
    Bucket: S3_BUCKET_VIDEOS,
    Key: videoKey,
    Body: data,
    Metadata: metadata.Metadata
  }));

}
