from pycocotools.coco import COCO
import urllib.request
import os

#Define how many images we want of each type
IMAGES_DESIRED = 100

def main():

    # coco_annotation_file_path = "annotations/instances_val2017.json"
    coco_annotation_file_path = "annotations/instances_train2017.json"

    coco_annotation = COCO(annotation_file=coco_annotation_file_path)

    # Get person, couch and car categories using their names to search
    cat_ids = coco_annotation.getCatIds(catNms=['person', 'couch', 'car'])
    cats = coco_annotation.loadCats(cat_ids)
    print(cats);
    #[{'supercategory': 'person', 'id': 1, 'name': 'person'}, {'supercategory': 'vehicle', 'id': 3, 'name': 'car'}, {'supercategory': 'furniture', 'id': 63, 'name': 'couch'}]

    # Get the ID of all the images containing the car, couch, person + car, person + couch
    car_ids = coco_annotation.getImgIds(catIds=[3])
    couch_ids = coco_annotation.getImgIds(catIds=[63])
    car_person_ids = coco_annotation.getImgIds(catIds=[3, 1])
    couch_person_ids = coco_annotation.getImgIds(catIds=[63, 1])

    # Get the ids of images of cars without people and couches without people
    car_no_person_ids = list(set(car_ids) - set(car_person_ids))            #Using set difference
    couch_no_person_ids = list(set(couch_ids) - set(couch_person_ids))      #Using set difference

    print(f"Number of images with cars: {len(car_ids)}. Of which, with people: {len(car_person_ids)}, without people: {len(car_no_person_ids)}")
    print(f"Number of images with couches: {len(couch_ids)}. Of which, with people: {len(couch_person_ids)}, without people: {len(couch_no_person_ids)}")

    # Now get IMAGES_DESIRED images with each type. Put data in an array of objects for simplicity
    desiredTypes = [
        { "dir": "car_person", "ids": car_person_ids },
        { "dir": "car_no_person", "ids": car_no_person_ids },
        { "dir": "couch_person", "ids": couch_person_ids },
        { "dir": "couch_no_person", "ids": couch_no_person_ids }
    ]
    for desiredType in desiredTypes:
        ids = desiredType["ids"][0:IMAGES_DESIRED]  #Just first IMAGES_DESIRED images
        imgs_info = coco_annotation.loadImgs(ids)
        for img_info in imgs_info:
            img_file_name = img_info["file_name"]
            img_url = img_info["coco_url"]

            #Save in directory in local images dir
            local_file_path = "images/" + desiredType["dir"] + "/" + img_file_name
            
            #Skip if file exists
            if os.path.isfile(local_file_path):
                continue

            # Retrieve image from url and save
            urllib.request.urlretrieve(img_url, local_file_path)

    return


if __name__ == "__main__":

    main()