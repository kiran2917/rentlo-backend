import boto3
import uuid
import mimetypes
from django.conf import settings
from rest_framework import views, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
import logging
from properties.models import Property, PlatformSettings
from .models import PropertyMedia
from PIL import Image, ImageDraw, ImageFont, ImageOps
import io

logger = logging.getLogger('error')

def apply_watermark(img, text="Verified on Rentlo.in"):
    """
    Overlays a subtle, semi-transparent verified badge watermark onto the image.
    Uses Pillow RGBA alpha blending. 100% free VPS CPU processing.
    """
    if not text or not str(text).strip():
        return img

    clean_text = str(text).strip()
    orig_mode = img.mode

    # Convert to RGBA for alpha composite
    if orig_mode != 'RGBA':
        base = img.convert('RGBA')
    else:
        base = img.copy()

    w, h = base.size
    overlay = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    # Dynamic font size based on image resolution (approx 2.8% of min dimension, clamped between 13px and 44px)
    font_size = max(13, min(44, int(min(w, h) * 0.028)))

    font = None
    common_fonts = [
        'arial.ttf', 'Arial.ttf', 'DejaVuSans.ttf', 'DejaVuSans-Bold.ttf',
        'calibri.ttf', 'segoeui.ttf', 'LiberationSans-Regular.ttf',
        'Helvetica.ttf', 'FreeSans.ttf'
    ]
    for font_name in common_fonts:
        try:
            font = ImageFont.truetype(font_name, font_size)
            break
        except Exception:
            continue

    if font is None:
        try:
            font = ImageFont.load_default(size=font_size)
        except Exception:
            font = ImageFont.load_default()

    # Calculate text bounding box
    try:
        bbox = draw.textbbox((0, 0), clean_text, font=font)
        text_w = bbox[2] - bbox[0]
        text_h = bbox[3] - bbox[1]
        offset_y = bbox[1]
    except Exception:
        text_w = len(clean_text) * int(font_size * 0.58)
        text_h = int(font_size * 1.1)
        offset_y = 0

    pad_x = int(font_size * 0.7)
    pad_y = int(font_size * 0.45)
    margin = int(font_size * 0.85)

    badge_w = text_w + (pad_x * 2)
    badge_h = text_h + (pad_y * 2)

    x1 = w - badge_w - margin
    y1 = h - badge_h - margin
    x2 = x1 + badge_w
    y2 = y1 + badge_h

    # Only draw if image is large enough to contain badge comfortably
    if x1 >= 0 and y1 >= 0 and badge_w < w and badge_h < h:
        radius = int(badge_h / 2)
        # Draw dark slate rounded badge with 65% opacity and subtle white outline
        try:
            draw.rounded_rectangle(
                [x1, y1, x2, y2],
                radius=radius,
                fill=(15, 23, 42, 165),
                outline=(255, 255, 255, 80),
                width=1
            )
        except Exception:
            draw.rectangle(
                [x1, y1, x2, y2],
                fill=(15, 23, 42, 165),
                outline=(255, 255, 255, 80)
            )

        # Draw clean white watermark text inside badge
        draw.text(
            (x1 + pad_x, y1 + pad_y - offset_y),
            clean_text,
            fill=(255, 255, 255, 235),
            font=font
        )

        watermarked = Image.alpha_composite(base, overlay)
        if orig_mode != 'RGBA':
            watermarked = watermarked.convert('RGB')
        return watermarked

    return img

def is_r2_configured():
    return bool(
        settings.R2_ENDPOINT_URL and 
        settings.R2_ACCESS_KEY_ID and 
        settings.R2_SECRET_ACCESS_KEY and 
        'your-account-id' not in settings.R2_ENDPOINT_URL
    )

def is_cloudinary_configured():
    return bool(
        getattr(settings, 'CLOUDINARY_CLOUD_NAME', '') and
        getattr(settings, 'CLOUDINARY_API_KEY', '') and
        getattr(settings, 'CLOUDINARY_API_SECRET', '')
    )

def upload_to_cloudinary(buffer, public_id, resource_type='image'):
    """Upload file buffer to Cloudinary. Returns (full_url, medium_url, thumbnail_url)."""
    import cloudinary
    import cloudinary.uploader
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True
    )
    buffer.seek(0)
    result = cloudinary.uploader.upload(
        buffer,
        public_id=public_id,
        folder='rentlo/uploads',
        resource_type=resource_type,
        overwrite=True,
        format='webp',
        quality='auto:good',
    )
    base_url = result['secure_url']
    # Derive medium & thumbnail via Cloudinary transformation URLs
    cloud = settings.CLOUDINARY_CLOUD_NAME
    pid_with_folder = result['public_id']  # e.g. rentlo/uploads/uuid
    medium_url = f"https://res.cloudinary.com/{cloud}/image/upload/w_800,h_600,c_fit,f_webp,q_auto/{pid_with_folder}"
    thumbnail_url = f"https://res.cloudinary.com/{cloud}/image/upload/w_400,h_300,c_fit,f_webp,q_auto/{pid_with_folder}"
    return base_url, medium_url, thumbnail_url


def get_r2_client():
    if not is_r2_configured():
        raise ValueError("R2 is not configured. Falling back to local storage.")
    return boto3.client(
        's3',
        endpoint_url=settings.R2_ENDPOINT_URL,
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        region_name='auto',
    )

class PresignedURLView(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.role not in ['admin', 'agent', 'owner']:
            return Response({'detail': 'Only owners, agents, and admins can upload media.'}, status=status.HTTP_403_FORBIDDEN)

        file_name = request.data.get('file_name')
        file_size = request.data.get('file_size')
        file_type = request.data.get('file_type')
        property_id = request.data.get('property_id')

        if not file_name or not file_size or not file_type:
            return Response({'detail': 'file_name, file_size, and file_type are required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Size validation (5MB max)
        try:
            file_size = int(file_size)
        except ValueError:
            return Response({'detail': 'Invalid file_size.'}, status=status.HTTP_400_BAD_REQUEST)
            
        if file_size > 5 * 1024 * 1024:
            return Response({'detail': 'File size exceeds the 5MB limit.'}, status=status.HTTP_400_BAD_REQUEST)

        # Type validation (Allowed image MIME types only)
        allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
        if file_type.lower() not in allowed_types:
            return Response({'detail': f'Invalid file type. Allowed types: {", ".join(allowed_types)}'}, status=status.HTTP_400_BAD_REQUEST)

        # Count validation (Max 10 per listing if property_id is provided)
        if property_id:
            try:
                prop = Property.objects.get(id=property_id, agent=request.user)
                if prop.media.count() >= 10:
                    return Response({'detail': 'Maximum of 10 photos per listing allowed.'}, status=status.HTTP_400_BAD_REQUEST)
            except Property.DoesNotExist:
                return Response({'detail': 'Property not found.'}, status=status.HTTP_404_NOT_FOUND)

        ext = mimetypes.guess_extension(file_type) or '.jpg'
        unique_name = f"{uuid.uuid4()}{ext}"
        object_key = f"uploads/{request.user.id}/{unique_name}"

        try:
            if not is_r2_configured():
                # If R2 is not configured, return a dummy local endpoint URL
                return Response({
                    'upload_url': request.build_absolute_uri('/api/v1/media/upload/'),
                    'public_url': request.build_absolute_uri(f"{settings.MEDIA_URL}{object_key}")
                })
                
            s3 = get_r2_client()
            presigned_url = s3.generate_presigned_url(
                ClientMethod='put_object',
                Params={
                    'Bucket': settings.R2_BUCKET_NAME,
                    'Key': object_key,
                    'ContentType': file_type,
                },
                ExpiresIn=3600
            )
            
            public_url = f"{settings.R2_PUBLIC_URL_PREFIX}/{object_key}"

            return Response({
                'upload_url': presigned_url,
                'public_url': public_url
            })
        except Exception as e:
            logger.error(f"Error generating presigned URL: {str(e)}", exc_info=True)
            return Response({'detail': 'Failed to generate presigned upload URL. Please try again.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

from rest_framework.parsers import MultiPartParser, FormParser

class UploadMediaView(views.APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)
    def post(self, request):
        user_roles = set(getattr(request.user, 'roles', []) or [])
        user_roles.add(getattr(request.user, 'role', 'buyer'))
        allowed_roles = {'admin', 'agent', 'owner', 'buyer'}
        if not user_roles.intersection(allowed_roles):
            return Response({'detail': 'You do not have permission to upload media.'}, status=status.HTTP_403_FORBIDDEN)

        file_obj = request.FILES.get('file')
        property_id = request.data.get('property_id') # Optional

        if not file_obj:
            return Response({'detail': 'No file provided.'}, status=status.HTTP_400_BAD_REQUEST)

        if file_obj.size > 5 * 1024 * 1024:
            return Response({'detail': 'File size exceeds the 5MB limit.'}, status=status.HTTP_400_BAD_REQUEST)

        if not file_obj.content_type.startswith('image/'):
            return Response({'detail': 'Only image files are allowed.'}, status=status.HTTP_400_BAD_REQUEST)

        if property_id:
            try:
                prop = Property.objects.get(id=property_id, agent=request.user)
                if prop.media.count() >= 10:
                    return Response({'detail': 'Maximum of 10 photos per listing allowed.'}, status=status.HTTP_400_BAD_REQUEST)
            except Property.DoesNotExist:
                return Response({'detail': 'Property not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            # Process image with Pillow
            img = Image.open(file_obj)
            
            # Auto-orient based on EXIF if present
            img = ImageOps.exif_transpose(img)

            # Define sizes
            sizes = {
                'full': None, # keep original but convert to webp (maybe scale if too large)
                'medium': (800, 600),
                'thumbnail': (400, 300)
            }
            
            # If original is massive, restrict to 1920x1080
            img.thumbnail((1920, 1080), Image.Resampling.LANCZOS)
            
            urls = {}
            original_name = getattr(file_obj, 'name', '').lower()
            prefix = 'sig_' if 'sig' in original_name else ''
            base_uuid = f"{prefix}{uuid.uuid4()}"

            # Auto-Watermark: 100% Free on VPS with Pillow (dynamic text configured by Admin)
            # Skip for signature canvas captures or docs
            if not prefix:
                try:
                    ps = PlatformSettings.load()
                    if ps.enable_watermark:
                        wm_text = ps.watermark_text or "Verified on Rentlo.in"
                        img = apply_watermark(img, text=wm_text)
                except Exception as wm_err:
                    logger.warning(f"Watermark processing skipped: {wm_err}")
            
            use_r2 = is_r2_configured()
            use_cloudinary = not use_r2 and is_cloudinary_configured()
            use_local = not use_r2 and not use_cloudinary

            if use_r2:
                try:
                    s3 = get_r2_client()
                except Exception:
                    use_r2 = False
                    use_cloudinary = is_cloudinary_configured()
                    use_local = not use_cloudinary

            if use_cloudinary:
                # Upload the full-res WebP to Cloudinary once; derive medium/thumbnail via transform URLs
                buffer = io.BytesIO()
                img.save(buffer, format='WEBP', quality=85)
                buffer.seek(0)
                try:
                    full_url, medium_url, thumbnail_url = upload_to_cloudinary(buffer, base_uuid)
                    urls = {'full': full_url, 'medium': medium_url, 'thumbnail': thumbnail_url}
                except Exception as cld_err:
                    logger.error(f"Cloudinary upload failed: {cld_err}", exc_info=True)
                    use_cloudinary = False
                    use_local = True

            if use_r2 or use_local:
                for size_name, max_size in sizes.items():
                    img_copy = img.copy()
                    if max_size:
                        img_copy.thumbnail(max_size, Image.Resampling.LANCZOS)

                    buf = io.BytesIO()
                    img_copy.save(buf, format='WEBP', quality=85)
                    buf.seek(0)

                    object_key = f"uploads/{request.user.id}/{base_uuid}-{size_name}.webp"

                    if use_r2:
                        s3.put_object(
                            Bucket=settings.R2_BUCKET_NAME,
                            Key=object_key,
                            Body=buf,
                            ContentType='image/webp'
                        )
                        urls[size_name] = f"{settings.R2_PUBLIC_URL_PREFIX}/{object_key}"
                    else:
                        # Local dev fallback (Render ephemeral — not persistent)
                        from django.core.files.storage import default_storage
                        from django.core.files.base import ContentFile
                        local_path = default_storage.save(object_key, ContentFile(buf.read()))
                        urls[size_name] = request.build_absolute_uri(f"{settings.MEDIA_URL}{local_path}")

            # Calculate perceptual hash
            import imagehash
            phash_value = str(imagehash.phash(img))

            return Response({
                'full_url': urls['full'],
                'medium_url': urls['medium'],
                'thumbnail_url': urls['thumbnail'],
                'image_hash': phash_value
            })

        except Exception as e:
            logger.error(f"Error uploading media file: {str(e)}", exc_info=True)
            return Response({'detail': 'Failed to process and upload media file. Please try again.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

import tempfile
from mutagen import File as MutagenFile

class UploadVoiceNoteView(views.APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request):
        if request.user.role not in ['admin', 'agent', 'owner']:
            return Response({'detail': 'Only owners, agents, and admins can upload voice notes.'}, status=status.HTTP_403_FORBIDDEN)

        file_obj = request.FILES.get('file')

        if not file_obj:
            return Response({'detail': 'No file provided.'}, status=status.HTTP_400_BAD_REQUEST)

        if file_obj.size > 5 * 1024 * 1024:
            return Response({'detail': 'File size exceeds the 5MB limit.'}, status=status.HTTP_400_BAD_REQUEST)

        valid_types = ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/webm;codecs=opus']
        if file_obj.content_type not in valid_types and not file_obj.content_type.startswith('audio/'):
            return Response({'detail': 'Invalid file format. Please upload a valid audio file.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix='.tmp') as tmp:
                for chunk in file_obj.chunks():
                    tmp.write(chunk)
                tmp_path = tmp.name

            try:
                audio = MutagenFile(tmp_path)
                if audio is not None and audio.info:
                    if audio.info.length > 61: # allow 1 second leeway
                        return Response({'detail': 'Voice note must be 60 seconds or less.'}, status=status.HTTP_400_BAD_REQUEST)
            except Exception:
                pass
            finally:
                import os
                if os.path.exists(tmp_path):
                    os.remove(tmp_path)

            file_obj.seek(0)
            
            ext = mimetypes.guess_extension(file_obj.content_type)
            if not ext and file_obj.content_type.startswith('audio/webm'):
                ext = '.webm'
            elif not ext:
                ext = '.mp3'
                
            unique_name = f"{uuid.uuid4()}{ext}"
            object_key = f"voice_notes/{request.user.id}/{unique_name}"

            use_local = not is_r2_configured()
            if not use_local:
                try:
                    s3 = get_r2_client()
                except Exception:
                    use_local = True

            if use_local:
                # Local storage fallback
                from django.core.files.storage import default_storage
                saved_path = default_storage.save(object_key, file_obj)
                public_url = request.build_absolute_uri(f"{settings.MEDIA_URL}{saved_path}")
            else:
                s3.put_object(
                    Bucket=settings.R2_BUCKET_NAME,
                    Key=object_key,
                    Body=file_obj,
                    ContentType=file_obj.content_type
                )
                public_url = f"{settings.R2_PUBLIC_URL_PREFIX}/{object_key}"

            return Response({
                'public_url': public_url
            })

        except Exception as e:
            logger.error(f"Error uploading voice note: {str(e)}", exc_info=True)
            return Response({'detail': 'Failed to process voice note upload. Please try again.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
