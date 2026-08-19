from celery import shared_task
import logging
from PIL import Image
import os

logger = logging.getLogger(__name__)

@shared_task(name="media.process_property_image_async")
def process_property_image_async(image_path):
    """
    Asynchronously strips EXIF metadata and converts property images to WebP format in background Redis workers.
    """
    if not os.path.exists(image_path):
        logger.warning(f"Image path does not exist for processing: {image_path}")
        return False
        
    try:
        with Image.open(image_path) as img:
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
            
            base_name, _ = os.path.splitext(image_path)
            webp_path = f"{base_name}.webp"
            img.save(webp_path, "WEBP", quality=85, optimize=True)
            logger.info(f"Successfully processed image asynchronously: {webp_path}")
            return webp_path
    except Exception as e:
        logger.error(f"Error in async image processing task for {image_path}: {e}", exc_info=True)
        return False
