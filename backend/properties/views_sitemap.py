from django.http import HttpResponse
from properties.models import Property
from django.utils import timezone

def robots_txt_view(request):
    content = """User-agent: *
Allow: /
Allow: /property/
Allow: /pricing
Allow: /login
Allow: /owner/login
Disallow: /admin/
Disallow: /api/v1/properties/platform-settings/
Disallow: /api/v1/auth/data-erasure/

Sitemap: https://rentlo.in/sitemap.xml
"""
    return HttpResponse(content, content_type="text/plain")

def sitemap_xml_view(request):
    properties = Property.objects.filter(status='live').order_by('-created_at')[:1000]
    
    xml_entries = [
        """<?xml version="1.0" encoding="UTF-8"?>""",
        """<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">""",
        """  <url><loc>https://rentlo.in/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>""",
        """  <url><loc>https://rentlo.in/pricing</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>""",
        """  <url><loc>https://rentlo.in/login</loc><changefreq>monthly</changefreq><priority>0.6</priority></url>""",
        """  <url><loc>https://rentlo.in/owner/login</loc><changefreq>monthly</changefreq><priority>0.6</priority></url>"""
    ]
    
    for p in properties:
        lastmod = p.created_at.strftime('%Y-%m-%d') if hasattr(p, 'created_at') and p.created_at else timezone.now().strftime('%Y-%m-%d')
        xml_entries.append(f"  <url><loc>https://rentlo.in/property/{p.id}</loc><lastmod>{lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>")
        
    xml_entries.append("</urlset>")
    
    return HttpResponse("\n".join(xml_entries), content_type="application/xml")
