# YOLOv5 🚀 by Ultralytics, AGPL-3.0 license
# Detect and upload - modified script for UOL Compsci Project

import os
import sys
from pathlib import Path

import torch

import time         #for timestamps
import psutil       #for seeing if lib camera running
import subprocess   #for launching lib camera
import boto3        #for AWS S3 file uploading
import uuid         #for generating a random filename

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
frame_rate = 1  #We run the streaming at this frame rate. Also used to save the MP4 at the correct fps

#Constants for the recording settings
max_recording_duration = 20 # seconds
min_gap_between_video_start = 60 # seconds
videos_directory = str(ROOT / 'videos')             #local directory on Raspberry Pi
s3_videos_bucket_name = 'guardianberry.videos'     #AWS S3 bucket name for videos
images_directory = str(ROOT / 'images')             #local directory on Raspberry Pi
s3_images_bucket_name = 'guardianberry.images'     #AWS S3 bucket name for images - the first image captured with a person
s3 = boto3.client('s3')                             #Boto3 client for uploading files to S3

#Constants for the detection algorithm
weights = ROOT / 'yolov5s.pt'       # model path
data = ROOT / 'data/coco128.yaml'   # dataset path

@smart_inference_mode()
def run():

    global imgsz

    # Load model
    device = select_device('')

    model = DetectMultiBackend(weights, device = device, dnn = False, data = data, fp16 = False)
    stride, names, pt = model.stride, model.names, model.pt
    imgsz = check_img_size(imgsz, s = stride)  # check image size

    #Webcam - load stream
    dataset = LoadStreams(stream_url, img_size = imgsz, stride = stride, auto = pt, vid_stride = 1)

    #Make directories if they don't exists
    if not os.path.exists(images_directory):
        os.mkdir(images_directory)
    if not os.path.exists(videos_directory):
        os.mkdir(videos_directory)

    vid_writer = None
    is_recording = False
    recording_start_time = 0
    max_people_found = 0
    max_confidence = 0

    # Run inference
    model.warmup(imgsz = (1, 3, *imgsz))  # warmup
    dt = Profile()
    for path, im, im0s, vid_cap, s in dataset:

        with dt:    #Use the profiler
            im = torch.from_numpy(im).to(model.device)
            im = im.float()  # uint8 to fp
            im /= 255  # 0 - 255 to 0.0 - 1.0

            # Inference
            pred = model(im, augment = False, visualize = False)

            # NMS to remove overlapping bounding boxes. Also pass [0] to set the desired classes to just people (class = 0)
            pred = non_max_suppression(pred, conf_thres, iou_thres, [0], False, max_det = 1000)

        recording_msg = ''

        # Process predictions
        for i, det in enumerate(pred):  # per image
            msg = '%gx%g ' % im.shape[2:]  # print string

            if len(det):
                #We have detected a person - add box to image
                im0 = im0s[i].copy()
                annotator0 = Annotator(im0s[i].copy(), line_width = 3, example = str(names))
                annotator1 = Annotator(im0s[i].copy(), line_width = 3, example = str(names))

                # Rescale boxes from img_size to im0 size
                det[:, :4] = scale_boxes(im.shape[2:], det[:, :4], im0.shape).round()

                # Create results string
                for c in det[:, 5].unique():
                    n = (det[:, 5] == c).sum()  # detections per class
                    msg += f"{n} {names[int(c)]}{'s' * (n > 1)}, "  # add to string

                # Write results to annotator 0 and 1. 0 has no confidence percentage - used for initial image upload.
                for *xyxy, conf, cls in reversed(det):
                    c = int(cls)  # integer class
                    annotator0.box_label(xyxy, f'{names[c].title()}', color=colors(c, True))   # No confidence label for initial image
                    annotator1.box_label(xyxy, f'{names[c].title()} {(conf * 100):.0f}%', color=colors(c, True))

                im0 = annotator1.result()   # includes the confidence percentage

                #Save to video file with logic about max recording duration and minimum gap between recording start times
                if not is_recording and (time.time() - recording_start_time > min_gap_between_video_start):
                    #Start recording
                    is_recording = True
                    recording_start_time = time.time()
                    save_path_and_file = videos_directory + '/' + str(round(recording_start_time)) + '.mp4'
                    max_people_found = len(det)
                    max_confidence = float(conf)

                    if isinstance(vid_writer, cv2.VideoWriter):
                        # Shouldn't be needed but just in case
                        vid_writer.release()
                    vid_writer = cv2.VideoWriter(save_path_and_file, cv2.VideoWriter_fourcc(*'mp4v'), frame_rate, (im0.shape[1], im0.shape[0]))                    
                    vid_writer.write(im0)

                    #Also write and upload to AWS this first image (plus any other images)
                    save_image(annotator0.result(), recording_start_time, max_confidence)
                    upload_images_to_aws()
                    recording_msg = 'Started recording to ' + save_path_and_file

                elif is_recording:
                    if time.time() - recording_start_time < max_recording_duration:
                        #Already recording and duration OK: keep going
                        vid_writer.write(im0)
                        max_people_found = max(max_people_found, len(det))
                        max_confidence = max(max_confidence, float(conf))
                        recording_msg = 'Continuing recording'

                    else:
                        #Already recording but hit max duration: stop recording and trigger upload
                        is_recording = False
                        vid_writer.release()
                        rename_local_file(save_path_and_file, recording_start_time, max_people_found, max_confidence, dt.dt, im0.shape[1], im0.shape[0])
                        recording_msg = 'Hit max duration of ' + str(max_recording_duration) + 'secs... stopped recording; '
                        recording_msg += upload_videos_to_aws()

            else:
                #Nothing detected. If recording then stop, close the file and trigger upload.
                if is_recording:
                    is_recording = False
                    vid_writer.release()
                    rename_local_file(save_path_and_file, recording_start_time, max_people_found, max_confidence, dt.dt, im0.shape[1], im0.shape[0])
                    recording_msg = 'No more people... stopped recording; '
                    recording_msg += upload_videos_to_aws()

        # Print detections, time to process and any info about recordings
        if not len(det):
            msg += '(no detections), '
        LOGGER.info(f"{msg}time:{dt.dt * 1E3:.1f}ms " + recording_msg)

#Save this image locally
def save_image(image, recording_start_time, confidence):
    filename = images_directory + '/' + str(round(recording_start_time))  + '-' + str(round(confidence * 100)) \
        + '-' + str(image.shape[1]) + '-' + str(image.shape[0]) + '.jpg'
    cv2.imwrite(filename, image)

#Try to upload all files in /images/ directory to AWS S3. Delete files on successful upload.
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

#Rename the file after closed - to encode the metadata in the filename
def rename_local_file(old_filename, recording_start_time, max_people_found, max_confidence, inference_time_ms, width, height):
    new_filename = videos_directory + '/' + str(round(recording_start_time)) + '-' + str(round(time.time() - recording_start_time)) \
        + '-' + str(max_people_found) + '-' + str(round(max_confidence * 100)) + '-' + str(round(inference_time_ms * 1000)) \
        + '-' + str(width) + '-' + str(height) \
        + '.mp4'
    os.rename(old_filename, new_filename)

#Try to upload all files in /videos/ directory to AWS S3. Delete files on successful upload. Return a string describing actions.
def upload_videos_to_aws():
    msg = []
    for filename in os.listdir(videos_directory):
        file_path = videos_directory + '/' + filename

        if not os.path.isfile(file_path):
            continue

        #Extract the metadata from the filename
        parts = filename.split('.')[0].split('-')

        #Create metadata to go with file
        metadata = { 'Metadata': {
            'rpi_serial_no': rpi_serial_no,
            'model': str(weights.absolute()),
            'frame_rate': str(frame_rate),
            'confidence_threshold': str(conf_thres),
            'recording_start_time': parts[0],
            'duration_s': parts[1],
            'max_people_found': parts[2],
            'max_confidence': parts[3],
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

