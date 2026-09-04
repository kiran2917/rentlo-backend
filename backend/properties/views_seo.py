import os
from django.conf import settings
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from properties.models import Property

def property_seo_view(request, id):
    # Fetch the property
    try:
        prop = Property.objects.select_related('locality', 'locality__city').prefetch_related('media').get(id=id)
    except Property.DoesNotExist:
        return HttpResponse("<html><head><title>Property Not Found - Rentlo</title></head><body>Property not found.</body></html>", status=404)

    # Format property title, locality, and price
    locality_name = prop.locality.name if prop.locality else "Prime Location"
    city_name = prop.locality.city.name if (prop.locality and prop.locality.city) else "Karnataka"
    bhk_str = f"{prop.bedrooms} BHK " if prop.bedrooms else ""
    type_str = prop.get_property_type_display() if hasattr(prop, 'get_property_type_display') else prop.property_type
    
    if prop.property_category == 'pg':
        title = f"Verified PG / Co-Living in {locality_name}, {city_name} | ₹{int(prop.price):,}/mo — Rentlo"
    else:
        title = f"{bhk_str}{type_str} for Rent in {locality_name}, {city_name} | ₹{int(prop.price):,}/mo — Rentlo"

    description = f"Direct Owner Listing (ZERO Brokerage). Rent: ₹{int(prop.price):,}/month. Security Deposit: ₹{int(prop.security_deposit or 0):,}. Available in {locality_name}, {city_name}. View photos, amenities & contact owner directly on Rentlo."

    # Get primary media image
    first_media = prop.media.first()
    image_url = ""
    if first_media:
        image_url = first_media.medium_url or first_media.image_url or ""
        if image_url and not image_url.startswith('http'):
            image_url = request.build_absolute_uri(image_url)
    
    if not image_url:
        image_url = "https://rentlo.creanexatechnologies.tech/og-cover.jpg"

    frontend_base = getattr(settings, 'FRONTEND_URL', 'https://rentlo-frontend-delta.vercel.app')
    target_url = f"{frontend_base}/property/{prop.id}"

    # Rich OpenGraph & Twitter Cards tags
    seo_tags = f"""
    <title>{title}</title>
    <meta name="description" content="{description}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Rentlo — Zero Brokerage Real Estate" />
    <meta property="og:title" content="{title}" />
    <meta property="og:description" content="{description}" />
    <meta property="og:image" content="{image_url}" />
    <meta property="og:image:secure_url" content="{image_url}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:url" content="{target_url}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="{title}" />
    <meta name="twitter:description" content="{description}" />
    <meta name="twitter:image" content="{image_url}" />
    """

    # Check for frontend index.html
    possible_paths = [
        os.path.join(settings.BASE_DIR.parent, 'frontend', 'dist', 'index.html'),
        os.path.join(settings.BASE_DIR.parent, 'buyer-web', 'dist', 'index.html'),
        os.path.join(settings.BASE_DIR, 'frontend_dist', 'index.html')
    ]

    index_path = next((p for p in possible_paths if os.path.exists(p)), None)

    if index_path:
        with open(index_path, 'r', encoding='utf-8') as f:
            html_content = f.read()
        html_content = html_content.replace('<!-- SEO_TAGS -->', seo_tags)
        return HttpResponse(html_content, content_type="text/html; charset=utf-8")

    # Clean fallback with instant auto-redirect for human visitors
    fallback_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    {seo_tags}
    <meta http-equiv="refresh" content="0; url={target_url}">
    <script>
        window.location.replace("{target_url}");
    </script>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc; color: #334155; text-align: center; }}
        .card {{ background: white; padding: 2.5rem; border-radius: 1.5rem; box-shadow: 0 10px 25px rgba(0,0,0,0.05); max-width: 420px; }}
        a {{ color: #4f46e5; text-decoration: none; font-weight: bold; }}
    </style>
</head>
<body>
    <div class="card">
        <h2 style="margin-top:0; font-size: 20px; font-weight: 800; color: #0f172a;">Redirecting to Property...</h2>
        <p style="font-size: 14px; color: #64748b; line-height: 1.5;">{title}</p>
        <p style="margin-top: 20px;"><a href="{target_url}">Click here if not redirected automatically</a></p>
    </div>
</body>
</html>"""
    return HttpResponse(fallback_html, content_type="text/html; charset=utf-8")
