# Python script to detect people, create video and upload to AWS S3

The `detect.py` script was renamed to `detectAndUpload.py` and these changes made:
- Refactoring to remove unnecessary configuration options
- Autostart the libcamera streaming
- Detect only people
- Create video files up to 20 seconds long when a person is detected
- Embed metadata about the video in the local filename
- Upload the video file(s) to an AWS S3 bucket
- Save metadata about the detection
- Upload an image as soon as a person is detected to avoid end of video wait time for notifications

## 1. Refactoring to remove unnecessary configuration options
The original script contains a lot of flexibility for different data sources and other configuration choices. For simplicity and to align with this project's use of Raspberry Pi this code was all removed.

## 2. Autostart the libcamera streaming
Before the YOLO script uses LoadStreams() function to load a stream from a url we need to start streaming the RPi camera feed. The libcamera-vid application can deliver the RPi video as a stream. This needs to be launched before YOLO loads the stream.

The function `check_and_launch_libcamera()` checks if the application is already running and, if not, launches it with the relevant command line options.

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
1. Non Max Suppression is used to eliminate redundant bounding boxes in object detection tasks. It retains only the most probable bounding box for each object. In the YOLOv5 implementation, the object(s) of interest can be passed-in to the NMS function. In this case just one: `[0] - representing the person class.
2. Setting the number of classes to 1 does not improve the algorithm speed in any way. The slow step is the inference step where the model looks for matches in the image:
```
pred = model(im, augment = False, visualize = False)
```

## 4. Create video files up to 20 seconds long when a person is detected
By default, the script saves the full video stream if there is an object detected or not. We only want the script to save a video file if an object (person) is detected. We also want up to the first 20 seconds of video. I've also chosen to implement a gap of 60 seconds between videos to prevent too many uploads during Feature Prototyping.

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

## 5. Embed metadata about the video in the local filename
We want to capture certain pieces of metadata about the recording. These are:
- recording_start_time: a timestamp when the recording started
- duration: the video duration in seconds
- max_people_found: the maximum number of people detected in the video
- max_confidence a number representing the algorithm's confidence that the person is present
- inference_time_ms: how long the inference algorithm took to run - this will be useful for optimisation later
- width, height: the dimensions of the video

There is a need to save this metadata along with the video in case the video upload fails and needs to be retried. A simple way to do this is to make the filename hold this data.

The function `rename_local_file()` does this renaming, using a `-` (dash) to separate the metadata elements.

## 6. Upload the video file(s) to an AWS S3 bucket

HERE
## Upload the file to an AWS S3 bucket

install boto3 for easy AWS commands
```
pip install boto3
```

`guardianberry.videos`

S3 Bucket Settings
- Block all public access
- Server-side encryption with Amazon S3 managed keys (SSE-S3)

IAM role for S3 file upload permission to `guardianberry.videos` bucket only
PutObject: Grants permission to add an object to a bucket

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

Store credentials in environment variables per Boto3 [documentation](https://boto3.amazonaws.com/v1/documentation/api/latest/guide/configuration.html)
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_DEFAULT_REGION
Store in /etc/environment for system-wide availability

```
480x640 (no detections), time:1864.3ms 
480x640 1 person, time:1812.6ms Started recording to yolov5/videos/1700370096.mp4
480x640 1 person, time:1786.4ms Continuing recording
[...]
480x640 1 person, time:1783.3ms Continuing recording
480x640 (no detections), time:1839.4ms No more people... stopped recording; yolov5/videos/1700370096.mp4 uploaded to S3; Local file deleted
480x640 (no detections), time:1704.1ms 
```

Auto launch on startup

launch script `launch.sh`
```
#!/bin/bash
source /home/admin/myenv/bin/activate
python /home/admin/myscript.py
```

Make it executable
chmod +x /home/admin/launch.sh

Configure Raspberry Pi to Run the Script at Startup
```
crontab -e
```

```
@reboot /bin/bash /home/admin/launch.sh
```

```
source /home/admin/yolov5/env/bin/activate
python3 /home/admin/yolov5/detectAndUpload.py
```

