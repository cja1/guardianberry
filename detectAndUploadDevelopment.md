# YOLO Script to Detect and Upload videos (Feature Prototype)

These are the steps to configure YOLOv5 to:
- Detect only people
- Only write out video files when a person is detected
- Only write the first 20 seconds of video
- Leave a minimum gap of 60 seconds between videos written out
- Create a unique name for the video
- Once a video has been written out upload the file to an AWS S3 bucket
- Save metadata about the detection

Note: Create a copy of the `detect.py` script named `detectAndUpload.py`.

## 1. Detect only people
We can display the total classes that YOLOv5 can detect by looking at the `coco128.yaml` file:
```
cat ~/yolov5/data/coco128.yaml
```
This shows that there are 80 classes that YOLOv5 can detect. Class 0 is 'person'.

Configure `detectAndUpload.py` to only detect class 0. We could use the `--classes` parameter, but since we will use this configuration going forward, instead set the default for the classes to 0:
```
parser.add_argument('--classes', nargs='+', type=int, default=0, ...)
```

## 2. Only write out video files when a person is detected
By default, the script saves the full video stream if there is an object detected or not. We only want the script to save a video file if an object (person) is detected.


HERE: figure this out. Need to get to a different dir and naming convention; limit to 20 seconds max video; solve framerate (too slow);

```
scp admin@192.168.50.222:~/yolov5/runs/detect/exp15/127.0.0.mp4 .
```
HERE!


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
480x640 (no detections)time:1864.3ms 
480x640 1 person, time:1812.6ms Started recording to yolov5/videos/1700370096.mp4
480x640 1 person, time:1786.4ms Continuing recording
480x640 1 person, time:1764.2ms Continuing recording
480x640 1 person, time:1791.1ms Continuing recording
480x640 1 person, time:1783.5ms Continuing recording
480x640 1 person, time:1783.3ms Continuing recording
480x640 (no detections)time:1839.4ms No more people... stopped recording; yolov5/videos/1700370096.mp4 uploaded to S3; Local file deleted
480x640 (no detections)time:1704.1ms 
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