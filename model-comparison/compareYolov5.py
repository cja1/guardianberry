# YOLOv5 🚀 by Ultralytics, AGPL-3.0 license
# Calculate Accuracy - script mofified and extended by Charles Allen for UOL Compsci Project CM3070

# Images available here: https://compsci.s3.eu-west-1.amazonaws.com/CM3070/coco/images/images.zip

import os
import sys
from pathlib import Path

import torch

FILE = Path(__file__).resolve()
ROOT = FILE.parents[0]  # YOLOv5 root directory
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))  # add ROOT to PATH
ROOT = Path(os.path.relpath(ROOT, Path.cwd()))  # relative

from models.common import DetectMultiBackend
from utils.dataloaders import LoadImages
from utils.general import (Profile, check_img_size, non_max_suppression)
from utils.torch_utils import select_device, smart_inference_mode

#Constants for the detection algorithm
# weights = ROOT / 'yolov5n.pt'       # model path
weights = ROOT / 'yolov5s.pt'       # model path
data = ROOT / 'data/coco128.yaml'   # dataset path

@smart_inference_mode()
def run():

    imgsz = [640] * 2     # inference size (height, width)

    # Load model
    device = select_device('')
    model = DetectMultiBackend(weights, device = device, dnn = False, data = data, fp16 = False)
    stride, names, pt = model.stride, model.names, model.pt
    imgsz = check_img_size(imgsz, s = stride)  # check image size

    #Model warmup
    model.warmup(imgsz = (1, 3, *imgsz))  # warmup

    process_items = [
        { "dir": "car_person", "expected_persons": 100, "files": 100 },
        { "dir": "car_no_person", "expected_persons": 0, "files": 100 },
        { "dir": "couch_person", "expected_persons": 100, "files": 100 },
        { "dir": "couch_no_person", "expected_persons": 0, "files": 100 }
    ]

    time_ms_total, processed_total, correctly_labelled_total = 0, 0, 0

    for process_item in process_items:
        persons, time_ms = process_dir(process_item["dir"], model, imgsz, stride, pt)

        # Calculate accuracy: How many images were correctly labelled out of all images?
        incorrectly_labelled = abs(process_item["expected_persons"] - persons)   # Might be 100 - 97 = 3 or 0 - 3 = -3 so take abs
        correctly_labelled = process_item["files"] - incorrectly_labelled
        accuracy = correctly_labelled / process_item["files"] * 100

        print(process_item["dir"] + " accuracy " + str(accuracy) + "%, average process time " + str(round(time_ms / process_item["files"], 2)) + "ms")

        correctly_labelled_total += correctly_labelled
        time_ms_total += time_ms
        processed_total += process_item["files"]

    #Overall accuracy
    accuracy = correctly_labelled_total / processed_total * 100
    avg_process_time = time_ms_total / processed_total

    print("Overall correctly labelled " + str(correctly_labelled_total) + "/" + str(processed_total)
        + ", accuracy " + str(accuracy) + "%, average process time " + str(round(avg_process_time, 2)) + "ms")


def process_dir(dir, model, imgsz, stride, pt):
    source = str(ROOT / 'data/images' / dir)

    conf_thres = 0.255    # confidence threshold
    iou_thres = 0.45      # NMS IOU threshold

    # Dataloader
    dataset = LoadImages(source, img_size = imgsz, stride = stride, auto = pt, vid_stride = 1)

    dt = Profile()
    persons = 0

    for path, im, im0s, vid_cap, s in dataset:
        
        with dt:    #Use the profiler
            im = torch.from_numpy(im).to(model.device)
            im = im.float()  # uint8 to fp
            im /= 255  # 0 - 255 to 0.0 - 1.0
            if len(im.shape) == 3:
                im = im[None]  # expand for batch dim

            # Inference
            pred = model(im, augment = False, visualize = False)

            # NMS to remove overlapping bounding boxes. [0] for only person detection (0 = person class).
            pred = non_max_suppression(pred, conf_thres, iou_thres, [0], False, max_det = 1000)

        # Process predictions
        for i, det in enumerate(pred):  # per image
            if len(det):
                persons += 1    #Only one class: person

    return persons, dt.t * 1E3


run()
