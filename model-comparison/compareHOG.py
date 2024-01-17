# Script written by Charles Allen for UOL Compsci Project CM3070

import cv2
import os
import time

# Setup HOG person detector
hog = cv2.HOGDescriptor()
hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())

def run():
    process_items = [
            { "dir": "car_person", "expected_persons": 100, "files": 100 },
            { "dir": "car_no_person", "expected_persons": 0, "files": 100 },
            { "dir": "couch_person", "expected_persons": 100, "files": 100 },
            { "dir": "couch_no_person", "expected_persons": 0, "files": 100 }
    ]

    time_ms_total, processed_total, correctly_labelled_total = 0, 0, 0

    for process_item in process_items:
            persons, time_ms = process_dir(process_item["dir"])

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


def process_dir(dir):
    path = "../yolov5/data/images/" + dir

    images = load_images(path)

    start = time.time()
    persons = 0

    for image in images:
        (rects, weights) = hog.detectMultiScale(image, winStride=(4, 4),padding=(4, 4), scale=1.05)
        if len(rects) > 0:
            persons += 1

    return persons, (time.time() - start) * 1E3


def load_images(dir):
    images = []
    for file in os.listdir(dir):
        img = cv2.imread(os.path.join(dir, file))
        if img is not None:
            images.append(img)
    return images

run()
