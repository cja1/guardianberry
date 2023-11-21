# Python script to detect people, create video and upload to AWS S3

The `detect.py` script was renamed to `detectAndUpload.py` and these steps taken:
- Refactoring to remove unnecessary configuration options
- Autostart the libcamera streaming
- Detect only people
- Create video files up to 20 seconds long when a person is detected
- Embed metadata about the video in the local filename
- Set up an AWS S3 bucket and IAM permissions
- Upload the video file(s) to an AWS S3 bucket
- Upload an image of then first detection frame
- Autoload the script on RPi startup

## 1. Refactoring to remove unnecessary configuration options
The original script contains a lot of flexibility for different data sources and other configuration choices. For simplicity and to align with this project's use of Raspberry Pi this code was all removed.

## 2. Autostart the libcamera streaming
The YOLO script uses LoadStreams() function to load a video stream from a url. Before calling this we need to start streaming the RPi camera feed. The libcamera-vid application can deliver the RPi video as a stream. This needs to be launched before YOLO loads the stream.

The function `check_and_launch_libcamera()` checks if the application is already running by calling the `psutil.process_iter()` function. If libcamera is not running, it launches the application using the `subprocess.Popen()` command with the relevant command line options.

```
def check_and_launch_libcamera():
    # Check if the libcamera-vid is running
    for process in psutil.process_iter(['pid', 'name']):
        if 'libcamera-vid' in process.info['name']:
            return

    # Launch libcamera-vid to stream
    try:
        subprocess.Popen(('libcamera-vid -n -t 0 --width 640 --height 480 --framerate ' + str(frame_rate) + ' --inline --listen -o ' + stream_url).split())
    except Exception as e:
```

## 3. Detect only people
We can display the total classes that YOLOv5 can detect by looking at the `coco128.yaml` file:
```
cat ~/yolov5/data/coco128.yaml
```
This shows that there are 80 classes that YOLOv5 can detect. Class 0 is 'person'.

Configuring `detectAndUpload.py` to only detect class `0` is trivial: we pass in `[0]` as the classes parameter to the Non Max Suppression function call:
```
pred = non_max_suppression(pred, conf_thres, iou_thres, [0], False, max_det = 1000)
```
Notes:
1. Non Max Suppression is used to eliminate redundant bounding boxes in object detection tasks. It retains only the most probable bounding box for each object. In the YOLOv5 implementation, the object(s) of interest can be passed-in to the NMS function as an array of ints. In this case just one: `[0]` - representing the person class.
2. Setting the number of classes to 1 does not improve the algorithm speed in any way. The slow step is the inference step where the model looks for matches in the image. This step happens before the NMS step.

## 4. Create video files up to 20 seconds long when a person is detected
By default, the script saves the full video stream regardless of whether there is an object detected or not.

We only want the script to save a video file if an object (person) is detected. We also want up to the first 20 seconds of video. I've also chosen to implement a gap of 60 seconds between videos to prevent too many uploads during Feature Prototyping.

This is implemented using these constants defined at the top of the file:
```
max_recording_duration = 20 # seconds
min_gap_between_video_start = 60 # seconds
```
In addition, these variables are used to manage the video recording state:
```
is_recording = False
recording_start_time = 0
```
The presence of a detected person is identified using this line:
```
if len(det):
    # Manage recording state here
```
The logic is fairly simple. In pseudo-code:
```
if a person is detected:
    if not recording and min_gap_between_video_start is met:
        start recording
    else if recording:
        if max_recording_duration has passed:
            stop recording
else:
    if recording:
        stop recording
```

## 5. Embed metadata about the video in the local filename
We want to capture certain pieces of metadata about the recording. These are:
- recording_start_time: a timestamp when the recording started
- duration: the video duration in seconds
- max_people_found: the maximum number of people detected in the video
- max_confidence a number representing the algorithm's confidence that the person is present
- inference_time_ms: how long the inference algorithm took to run - this will be useful for optimisation later
- width, height: the dimensions of the video

There is a need to save this metadata locally along with the video in case the video upload fails and needs to be re-tried. A simple way to do this is to make the filename hold this metadata.

The function `rename_local_file()` does this renaming, using a `-` (dash) to separate the metadata elements.

Note: because the first part of the filename is the recording start time as a timestamp, the file names will always be unique as no two videos can start at the same time.

## 6. Set up an AWS S3 bucket and IAM permissions

We need to create an S3 bucket for the videos. I chose `guardianberry.videos` for this. For the S3 Bucket Settings which determine who can access the files in the bucket and the file encryption I chose:
- Block all public access
- Server-side encryption with Amazon S3 managed keys (SSE-S3)

This means that none of the files are publicly accessible and all files are automatically encrypted by AWS. This is important to meet the project _#1 Must Have_ requirement of **'Security: Can't be hacked'**

We also need to create an Identity and Access Management (IAM) role to allow for S3 file uploads from the RPi.

I created a profile which only grants `PutObject` permission to the `guardianberry.videos` bucket only. The profile JSON definition is shown below.

```
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "VisualEditor0",
            "Effect": "Allow",
            "Action": "s3:PutObject",
            "Resource": "arn:aws:s3:::guardianberry.videos/*"
        }
    ]
}
```

For the Feature Prototype I created an IAM User which adopted this Profile. The User credentials are stored in an environment variables per Boto3 [documentation](https://boto3.amazonaws.com/v1/documentation/api/latest/guide/configuration.html). I created these environment variables stored in `/etc/environment`:
```
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_DEFAULT_REGION
```

Note: I am likely to re-visit the approach to User credentials later in the project to further enhance security.

## 7. Upload the video file(s) to an AWS S3 bucket

A video upload may fail - for example due to a network failure. To handle this case the files are saved locally embedding the metadata as described above.

After a recording finishes, _all_ local videos are uploaded - including ones that have previously failed.

I installed the python `boto3` library for easy AWS commands
```
pip install boto3
```

The function that handles this is `upload_videos_to_aws()` and this function gets all the videos in the `yolov5/videos` directory and steps through each one, extracting the metadata and using the `boto3` `upload_file()` command to send the file to AWS S3 along with the metadata. In addition to the metadata described above, there are 4 additional pieces of metedata sent:
- **rpi_serial_no**: we need a way to uniquely identify each RPi that connects to the system. It turns out that each RPi has a serial number. I wrote a function called `get_rpi_serial_number()` that extracts this by reading the `/proc/cpuinfo` file and searching for the `Serial...` line.
- **model**: I decided to pass the model used because I envisage a later stage of the project will try alternative models and I will want to be able to compare their performance.
- **frame_rate**: The frame rate used in the Feature Prototype is `1` FPS. This is rather slow and I expect I will want to change this setting in future iterations.
- **confidence_threshold**: The model confidence threshold is initially set to `0.255`. I expect to vary this parameter too in future iterations.

The files are stored in the S3 bucket with a random name - I use a [Universally Unique Identifier](https://en.wikipedia.org/wiki/Universally_unique_identifier) - so there is no information about the videos embedded in the filenames. This is in the unlikely event of someone seeing the S3 bucket directory listing. In this case no personal information is visible.

## 8. Upload an image of then first detection frame

I quickly realised that the above approach has an important constraint: if the video is uploaded at the _end_ of 20 seconds of recording then it is not possible to send a user notification until after this has happened.

One of the Non-Functional Requirements I set was **Responsive** defined as: the system identifies intruders and sends alerts quickly. Target metric: users receive intruder alerts within **5 seconds** of the intrusion.

It is impossible to meet this NFR if the video arrives 20 seconds after the intruder is first detected.

To address this, I added an image upload as soon as a person is detected. The logic is similar to the video uploading: a local file is saved with metadata (function `save_image()`), then this image file plus any older files are uploaded to an S3 bucket (function `upload_images_to_aws()`).

I created a new S3 bucket for these images called `guardianberry.images` with the same permissions. I also edited the IAM profile to allow `PutObject` permission to this bucket.

## 9. Autoload the script on RPi startup

I wanted the `detectAndUpload.py` script to automatically load when the RPi started. To do this I created a simple launch script `launch.sh` that set the right python environment then launched the script:
```
#!/bin/bash
source /home/admin/yolov5/env/bin/activate
python3 /home/admin/yolov5/detectAndUpload.py
```

I made this script executable using `chmod +x /home/admin/launch.sh`

Then I configure the Raspberry Pi to run the script at startup using `Crontab`:
```
crontab -e
```
I added this line to make RPi call the launch.sh script on reboot:
```
@reboot /bin/bash /home/admin/launch.sh
```
