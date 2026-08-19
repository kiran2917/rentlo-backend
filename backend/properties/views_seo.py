import os
from django.conf import settings
from django.http import HttpResponse, Http404
from django.shortcuts import get_object_or_404
from properties.models import Property

def property_seo_view(request, id):
    # Fetch the property
    prop = get_object_or_404(Property, id=id, status='live')
    
    # Get the image url for OG tag
    first_media = prop.media.order_by('display_order').first()
    image_url = first_media.medium_url if first_media else ''
    
    title = f"{prop.property_type.capitalize()} in {prop.locality.name if prop.locality else 'Hubli-Dharwad'} — ₹{float(prop.price):,.0f} — Rentlo"
    description = prop.description[:150] + '...' if len(prop.description) > 150 else prop.description
    
    seo_tags = f"""
    <title>{title}</title>
    <meta name="description" content="{description}" />
    <meta property="og:title" content="{title}" />
    <meta property="og:description" content="{description}" />
    <meta property="og:image" content="{image_url}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="{request.build_absolute_uri()}" />
    """
    
    seo_content = f"""
    <div id="seo-content" style="display:none">
        <h1>{title}</h1>
        <p>Price: ₹{float(prop.price):,.0f}</p>
        <p>Type: {prop.property_type.capitalize()}</p>
        <p>Locality: {prop.locality.name if prop.locality else 'Hubli-Dharwad'}</p>
        <p>{description}</p>
    </div>
    """
    
    # Read the built React index.html
    # We will assume buyer-web is built in the parent directory of backend
    index_path = os.path.join(settings.BASE_DIR.parent, 'buyer-web', 'dist', 'index.html')
    
    if not os.path.exists(index_path):
        # Fallback if index.html is not built (e.g. in dev without building)
        return HttpResponse(f"<html><head>{seo_tags}</head><body>{seo_content}<h2>Please build the frontend using 'npm run build' in buyer-web</h2></body></html>")
    
    with open(index_path, 'r', encoding='utf-8') as f:
        html_content = f.read()
    
    # Inject tags and content
    html_content = html_content.replace('<!-- SEO_TAGS -->', seo_tags)
    html_content = html_content.replace('<div id="root"></div>', f'<div id="root">{seo_content}</div>')
    
    return HttpResponse(html_content)
