# YOLOv5 🚀 by Ultralytics, AGPL-3.0 license
# Detect and upload - script mofified and extended by Charles Allen for UOL Compsci Project CM3070
# v2 script - to change detection and video capture logic to support slow person detection speed.

import os
import sys
from pathlib import Path

import torch

import time         #for timestamps
import psutil       #for seeing if lib camera running
import subprocess   #for launching lib camera
import boto3        #for AWS S3 file uploading
import uuid         #for generating a random filename
import datetime     #for current date
import pytz         #for timezone adjustments

FILE = Path(__file__).resolve()
ROOT = FILE.parents[0]  # YOLOv5 root directory
ROOT = Path(os.path.relpath(ROOT, Path.cwd()))  # relative

from ultralytics.utils.plotting import Annotator, colors

from models.common import DetectMultiBackend
from utils.dataloaders import LoadStreams
from utils.general import (LOGGER, Profile, check_img_size, check_requirements, cv2, non_max_suppression, scale_boxes)
from utils.torch_utils import select_device, smart_inference_mode

#Constants for the inference
imgsz = [640] * 2     # inference size (height, width)
conf_thres = 0.255    # confidence threshold
iou_thres = 0.45      # NMS IOU threshold
stream_url = 'tcp://127.0.0.1:8888' #Run lib camera on the localhost port 8888
frame_rate = 20       #Run the streaming at this frame rate. Also used to save the MP4 at the correct fps.

#Constants for the recording settings
max_recording_duration = 20 # seconds
min_gap_between_video_start = 60 # seconds. 1 hour too long for production system, but use this for development
recording_hours = [7, 22] # Only record between these hours - for development system

videos_directory = str(ROOT / 'videos')             #local directory on Raspberry Pi
s3_videos_bucket_name = 'guardianberry.videos'      #AWS S3 bucket name for videos
images_directory = str(ROOT / 'images')             #local directory on Raspberry Pi
s3_images_bucket_name = 'guardianberry.images'      #AWS S3 bucket name for images - the first image captured with a person
s3 = boto3.client('s3')                             #Boto3 client for uploading files to S3

#Constants for the detection algorithm
weights = ROOT / 'yolov5n.pt'       # Nano model path
data = ROOT / 'data/coco128.yaml'   # dataset path

@smart_inference_mode()
def run():

    global imgsz

    # Load model
    device = select_device('')
    model = DetectMultiBackend(weights, device = device, dnn = False, data = data, fp16 = False)
    names = model.names
    imgsz = check_img_size(imgsz, s = model.stride)

    #Webcam - load stream
    dataset = LoadStreams(stream_url, img_size = imgsz, stride = model.stride, auto = model.pt, vid_stride = 1)

    #Make directories if they don't exists
    if not os.path.exists(images_directory):
        os.mkdir(images_directory)
    if not os.path.exists(videos_directory):
        os.mkdir(videos_directory)


    vid_writer = None
    save_path_and_file = None
    is_recording = False
    recording_start_time = 0
    people_found = 0
    confidence = 0
    inference_time_ms = None
    frame_count = 0
    bg_frame = None
    last_frame = None

    # Run inference
    model.warmup(imgsz = (1, 3, *imgsz))  # warmup
    dt = Profile()
    for path, im, im0s, vid_cap, s in dataset:

        recording_msg = ''

        # Version 2: only use the model to detect persons if not already recording, otherwise continue recording.
        if is_recording:

            im0 = im0s[0].copy()

            #We are recording. See if we should continue.
            if time.time() - recording_start_time < max_recording_duration:
                #Duration OK

                #Every second, test if this frame is similar to bg frame
                if (frame_count % frame_rate == 0) and image_is_similar_to_bg(im0, bg_frame):
                    #Stop recording
                    is_recording = False
                    vid_writer.release()
                    rename_local_file(save_path_and_file, recording_start_time, people_found, confidence, inference_time_ms, im0.shape[1], im0.shape[0])
                    recording_msg = 'Stopped recording as no movement; '
                    recording_msg += upload_videos_to_aws()

                else:
                    #Write another frame
                    vid_writer.write(im0)
                    frame_count += 1
                    recording_msg = 'Continuing recording'

            else:
                #Already recording but hit max duration: stop recording and trigger upload
                is_recording = False
                vid_writer.release()
                rename_local_file(save_path_and_file, recording_start_time, people_found, confidence, inference_time_ms, im0.shape[1], im0.shape[0])
                recording_msg = 'Hit max duration of ' + str(max_recording_duration) + 'secs... stopped recording; '
                recording_msg += str(frame_count) + 'frames; '
                recording_msg += upload_videos_to_aws()

        elif (time.time() - recording_start_time > min_gap_between_video_start) and is_during_recording_hours():
            #Have waited long enough between recordings and in recording hours - see if any persons in image
            with dt:    #Use the profiler to time the inference
                im = torch.from_numpy(im).to(model.device)
                im = im.float()  # uint8 to fp
                im /= 255  # 0 - 255 to 0.0 - 1.0

                # Inference
                pred = model(im, augment = False, visualize = False)

                # NMS to remove overlapping bounding boxes. Also pass [0] to set the desired classes to just people (class = 0)
                pred = non_max_suppression(pred, conf_thres, iou_thres, [0], False, max_det = 1000)

            # Process predictions
            for i, det in enumerate(pred):  # per image

                im0 = im0s[i].copy()

                if len(det):
                    #We have detected a person
                    #Add boxes and person labels to image using annotator
                    annotator = Annotator(im0s[i].copy(), line_width = 3, example = str(names))

                    # Rescale boxes from img_size to im0 size
                    det[:, :4] = scale_boxes(im.shape[2:], det[:, :4], im0.shape).round()

                    # Create results string
                    msg = ''
                    for c in det[:, 5].unique():
                        n = (det[:, 5] == c).sum()  # detections per class
                        msg += f"{n} {names[int(c)]}{'s' * (n > 1)}, "  # add to string

                    # Write boxes and labels to annotator
                    max_conf = 0
                    for *xyxy, conf, cls in reversed(det):
                        c = int(cls)  # integer class
                        annotator.box_label(xyxy, f'{names[c].title()}', color = colors(c, True))
                        max_conf = max(max_conf, conf)

                    im0 = annotator.result()

                    #Start recording
                    is_recording = True
                    recording_start_time = time.time()
                    save_path_and_file = videos_directory + '/' + str(round(recording_start_time)) + '.mp4'
                    people_found = len(det)
                    confidence = float(max_conf)
                    inference_time_ms = dt.dt
                    frame_count = 0
                    bg_frame = setup_background(last_frame)

                    if isinstance(vid_writer, cv2.VideoWriter): # Shouldn't be needed but just in case
                        vid_writer.release()

                    vid_writer = cv2.VideoWriter(save_path_and_file, cv2.VideoWriter_fourcc(*'mp4v'), frame_rate, (im0.shape[1], im0.shape[0]))                    
                    vid_writer.write(im0) #Includes the box on the first frame only

                    #Write and upload to AWS this first image (plus any other images)
                    save_image(im0, recording_start_time, confidence)
                    upload_images_to_aws()
                    recording_msg = msg + '; started recording to ' + save_path_and_file

                else:
                    last_frame = im0
                    recording_msg = 'No person found'

        else:
            if is_during_recording_hours():
                #Waiting til min_gap_between_video_start has passed
                recording_msg = 'Waiting til min_gap_between_video_start has elasped'
            else:
                recording_msg = ''

        if recording_msg != '':
            LOGGER.info(recording_msg)


# See if the time now is between the fixed recording hours
#DEVELOPMENT ONKY
def is_during_recording_hours():
    tz = pytz.timezone("Asia/Singapore")
    hour = int(datetime.datetime.now(tz = tz).strftime("%H"))
    return (hour >= recording_hours[0]) and (hour <= recording_hours[1])

#See if image is similar to bg image
def image_is_similar_to_bg(im, bg_frame):
    contour_count = image_similarity_bg_subtract(im, bg_frame)
    return contour_count <= 2

def setup_background(im):
    #Gray scale and Blur - similar approach as used in CM3065 ISP
    gray_frame = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
    return cv2.GaussianBlur(gray_frame, (25, 25), 0)

def image_similarity_bg_subtract(im, bg_frame):
    gray_frame = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
    blur_frame = cv2.GaussianBlur(gray_frame, (25, 25), 0)

    #Calc absolute difference from bg frame (before person detected)
    delta_frame = cv2.absdiff(bg_frame, blur_frame)
    
    #The difference (the delta_frame) is converted into a binary image using the threshold value
    threshold_frame = cv2.threshold(delta_frame, 20, 255, cv2.THRESH_BINARY)[1]
    
    #The cv2.findContours() method identifies all the contours in the image.
    (contours, _) = cv2.findContours(threshold_frame, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    return len(contours);

#Save this image locally, embedding the metadata in the filename
def save_image(image, recording_start_time, confidence):
    filename = images_directory + '/' + str(round(recording_start_time))  + '-' + str(round(confidence * 100)) \
        + '-' + str(image.shape[1]) + '-' + str(image.shape[0]) + '.jpg'
    cv2.imwrite(filename, image)

#Try to upload all images to AWS S3. Delete files on successful upload.
def upload_images_to_aws():
    for filename in os.listdir(images_directory):
        file_path = images_directory + '/' + filename

        if not os.path.isfile(file_path):
            continue

        #Extract the metadata from the filename
        parts = filename.split('.')[0].split('-')

        #Create metadata to go with file
        metadata = { 'Metadata': {
            'rpi_serial_no': rpi_serial_no,
            'recording_start_time': parts[0],
            'confidence': parts[1],
            'width': parts[2],
            'height': parts[3]
        }}

        try:
            # Upload the file with a random filename (use a v4 uuid)
            s3.upload_file(file_path, s3_images_bucket_name, str(uuid.uuid4()) + '.jpg', metadata)

            # Delete the local file
            os.remove(file_path)

        except Exception as e:
            LOGGER.info(f'An error occurred while uploading {file_path}: {e}')

#Rename the video file after closed - to encode the metadata in the filename
def rename_local_file(old_filename, recording_start_time, people_found, confidence, inference_time_ms, width, height):
    new_filename = videos_directory + '/' + str(round(recording_start_time)) + '-' + str(round(time.time() - recording_start_time)) \
        + '-' + str(people_found) + '-' + str(round(confidence * 100)) + '-' + str(round(inference_time_ms * 1000)) \
        + '-' + str(width) + '-' + str(height) \
        + '.mp4'
    os.rename(old_filename, new_filename)

#Try to upload all videos to AWS S3. Delete files on successful upload. Return a string describing actions.
def upload_videos_to_aws():
    msg = []
    for filename in os.listdir(videos_directory):
        file_path = videos_directory + '/' + filename

        if not os.path.isfile(file_path):
            continue

        #Extract the metadata from the filename
        parts = filename.split('.')[0].split('-')

        #Check file like 1705477931-20-1-84-855-1280-960.mp4 and not 1705474734.mp4
        if len(parts) != 7:
            os.remove(file_path)
            continue

        #Create metadata to go with file
        metadata = { 'Metadata': {
            'rpi_serial_no': rpi_serial_no,
            'model': str(weights.absolute()),
            'frame_rate': str(frame_rate),
            'confidence_threshold': str(conf_thres),
            'recording_start_time': parts[0],
            'duration_s': parts[1],
            'max_people_found': parts[2],   #People found in first frame only
            'max_confidence': parts[3],     #Max confidence in first frame only
            'inference_time_ms': parts[4],
            'width': parts[5],
            'height': parts[6]
        }}

        try:
            # Upload the file with a random filename (use a v4 uuid)
            s3.upload_file(file_path, s3_videos_bucket_name, str(uuid.uuid4()) + '.mp4', metadata)
            msg += [parts[0] + '.mp4' + ' uploaded to S3']

            # Delete the local file
            os.remove(file_path)
            msg += ['Local file deleted']

        except Exception as e:
            msg += [f'An error occurred while uploading {file_path}: {e}']

    return ('; ').join(msg);

#Get the unique Rapsberry Pi serial number - from the /proc/cpuinfo file
def get_rpi_serial_number():
    try:
        with open('/proc/cpuinfo', 'r') as f:
            for line in f:
                #Looking for the line like 'Serial      : 10000000ceb3d9b3'
                if line.startswith('Serial'):
                    return line.split(':')[1].strip()

    except Exception as e:
        LOGGER.info(f'Error retrieving Raspberry Pi serial number: {e}')
        return None

#Launch the ibcamera-vid application if not running
def check_and_launch_libcamera():
    # Check if the libcamera-vid is running
    for process in psutil.process_iter(['pid', 'name']):
        if 'libcamera-vid' in process.info['name']:
            LOGGER.info('libcamera-vid is already running')
            return

    # Launch libcamera-vid to stream on the stream_url with the frame_rate
    try:
        subprocess.Popen(('libcamera-vid -n -t 0 --width 1280 --height 960 --framerate ' + str(frame_rate) + ' --inline --listen -o ' + stream_url).split())
        LOGGER.info('libcamera-vid launched')
    except Exception as e:
        LOGGER.info('libcamera-vid failed to launch')


#Launch libcamera if not running
check_and_launch_libcamera()

#Check Ultralytics requirements
check_requirements(ROOT / 'requirements.txt', exclude = ('tensorboard', 'thop'))

#Get the unique Raspberry Pi serial number - used to uniquely identify this RPi. Like '10000000ceb3d9b3'
rpi_serial_no = get_rpi_serial_number()
if rpi_serial_no == None:
    exit()
LOGGER.info(f'Raspberry Pi serial number: {rpi_serial_no}')

run()

