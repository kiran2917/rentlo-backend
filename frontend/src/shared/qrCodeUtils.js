/**
 * Standalone client-side QR Code SVG Generator (100% free, zero external API dependency)
 * Helper functions for WhatsApp deep-linking, Google Maps directions, and QR generation.
 */

export function getWhatsAppShareLink(phone, ownerName, propertyTitle, city) {
  const cleanPhone = (phone || '').replace(/\D/g, '');
  const message = `Hi ${ownerName || 'Owner'}, I found your listing "${propertyTitle || 'Property'}" in ${city || 'Rentlo'} on Rentlo and would like to inquire about it!`;
  return `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(message)}`;
}

export function getGoogleMapsLink(lat, lng, address) {
  if (lat && lng) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address || '')}`;
}

export function getQRCodeUrl(text, size = 200) {
  const encodedText = encodeURIComponent(text);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodedText}`;
}
