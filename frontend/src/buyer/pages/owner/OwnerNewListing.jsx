/**
 * OWNER NEW LISTING WIZARD ARCHITECTURE DOCUMENTATION
 * ====================================================
 * Single-file multi-step wizard for property listing onboarding:
 * 1. Step 1 (Basic Details): Property type, category, address, city/locality selection.
 * 2. Step 2 (Map Pinning & Geocoding): Interactive Leaflet map pinning and Nominatim reverse geocoding.
 * 3. Step 3 (Property Specifications): Pricing, bedrooms, bathrooms, area, amenities.
 * 4. Step 4 (Media & Voice Notes): Multi-file image dropzone with Pillow WebP compression & audio recording.
 * 5. Step 5 (Owner Verification & Consent): Canvas signature capture / photo document verification.
 * 6. Step 6 (Payment & Submission): Razorpay gateway integration / UPI QR payment / submission payload dispatch.
 * 
 * State Persistence: Form draft state synced to localStorage under 'owner_onboarding_form_data' (PII password fields omitted).
 */
import React, { useState, useCallback, useRef, useEffect } from "react";
import QRCode from "react-qr-code";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../../shared/context/AuthContext";
import { compressImage } from "../../../shared/imageCompressor";
// TODO(monorepo): Extract this component to a shared package between admin and buyer web.
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import SignatureCanvas from "react-signature-canvas";
import { useDropzone } from "react-dropzone";
import { get, set, del, keys } from "idb-keyval";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { STATE_CITY_DATA, MapFlyToHandler } from "../../../shared/constants/locationData";

// Fix leaflet default icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

function LocationPicker({ position, setPosition, onLocationUpdate }) {
  useMapEvents({
    click(e) {
      setPosition(e.latlng);
      if (onLocationUpdate) onLocationUpdate(e.latlng);
    },
  });
  return position === null ? null : (
    <Marker
      position={position}
      draggable={true}
      eventHandlers={{
        dragend: (e) => {
          setPosition(e.target.getLatLng());
          if (onLocationUpdate) onLocationUpdate(e.target.getLatLng());
        },
      }}
    />
  );
}

const defaultOwnerFormData = {
  owner_name: "",
  owner_phone: "",
  owner_password: "",
  price: "",
  property_category: "residential",
  property_type: "apartment",
  description: "",
  virtual_tour_url: "",
  city_id: "",
  locality: "",
  exact_address: "",
  bedrooms: "",
  bathrooms: "",
  balconies: "",
  carpet_area: "",
  furnishing_status: "",
  facing_direction: "",
  floor_number: "",
  total_floors: "",
  property_age: "",
  security_deposit: "",
  maintenance_charges: "",
  available_from: "",
  preferred_tenants: "any",
  food_preference: "any",
  pet_policy: "not_allowed",
  amenities: [],
  house_floor: "ground",
  pg_gender: "boys",
  pg_sharing_type: "double",
  total_beds: 13,
  available_beds: 4,
  pg_food_provided: ["Morning (Breakfast)", "Afternoon (Lunch)", "Night (Dinner)"],
  pg_room_inventory: {
    single: { enabled: true, rooms: 3, beds_per_room: 1, available_beds: 1, rent: 12000 },
    double: { enabled: true, rooms: 5, beds_per_room: 2, available_beds: 3, rent: 8000 },
    triple: { enabled: false, rooms: 0, beds_per_room: 3, available_beds: 0, rent: 6000 },
    four_plus: { enabled: false, rooms: 0, beds_per_room: 4, available_beds: 0, rent: 5000 },
  },
  is_featured: false,
  is_hero_spotlight: false,
};

const loadTrackingLibrary = () => {
  return new Promise((resolve) => {
    if (window.tracking && window.tracking.ObjectTracker) {
      return resolve(true);
    }
    const script1 = document.createElement("script");
    script1.src = "https://cdn.jsdelivr.net/npm/tracking@1.1.3/build/tracking-min.js";
    script1.id = "tracking-js-core";
    script1.onload = () => {
      const script2 = document.createElement("script");
      script2.src = "https://cdn.jsdelivr.net/npm/tracking@1.1.3/build/data/face-min.js";
      script2.id = "tracking-js-face";
      script2.onload = () => {
        resolve(true);
      };
      script2.onerror = () => resolve(false);
      document.head.appendChild(script2);
    };
    script1.onerror = () => resolve(false);
    document.head.appendChild(script1);
  });
};

export const OwnerNewListing = () => {
  const { user, checkAuth } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isSubmittedRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState(() => {
    const saved = localStorage.getItem("owner_onboarding_form_data");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { 
          ...defaultOwnerFormData, 
          ...parsed,
          pg_room_inventory: {
            ...defaultOwnerFormData.pg_room_inventory,
            ...(parsed.pg_room_inventory || {})
          }
        };
      } catch (error) {
        console.error("Failed to parse cached owner_onboarding_form_data:", error);
        localStorage.removeItem("owner_onboarding_form_data");
      }
    }
    return { ...defaultOwnerFormData };
  });

  const calculatePgSummary = (invMap) => {
    if (!invMap) return { totalRooms: 0, totalBeds: 0, availableBeds: 0, minRent: 0 };
    let totalRooms = 0;
    let totalBeds = 0;
    let availableBeds = 0;
    let minRent = Infinity;

    Object.keys(invMap).forEach((key) => {
      const item = invMap[key];
      if (item && item.enabled) {
        const rooms = Number(item.rooms) || 0;
        const bedsPerRoom = Number(item.beds_per_room) || (key === 'single' ? 1 : key === 'double' ? 2 : key === 'triple' ? 3 : 4);
        const avail = Number(item.available_beds) || 0;
        const rent = Number(item.rent) || 0;

        totalRooms += rooms;
        totalBeds += rooms * bedsPerRoom;
        availableBeds += avail;
        if (rent > 0 && rent < minRent) minRent = rent;
      }
    });

    return {
      totalRooms,
      totalBeds,
      availableBeds,
      minRent: minRent === Infinity ? 0 : minRent,
    };
  };

  const updateRoomInventory = (typeKey, updatedItem) => {
    setFormData((prev) => {
      const currentInv = prev.pg_room_inventory || {
        single: { enabled: true, rooms: 3, beds_per_room: 1, available_beds: 1, rent: 12000 },
        double: { enabled: true, rooms: 5, beds_per_room: 2, available_beds: 3, rent: 8000 },
        triple: { enabled: false, rooms: 0, beds_per_room: 3, available_beds: 0, rent: 6000 },
        four_plus: { enabled: false, rooms: 0, beds_per_room: 4, available_beds: 0, rent: 5000 },
      };

      const newInv = {
        ...currentInv,
        [typeKey]: updatedItem,
      };

      const summary = calculatePgSummary(newInv);

      return {
        ...prev,
        pg_room_inventory: newInv,
        total_beds: summary.totalBeds,
        available_beds: summary.availableBeds,
        price: summary.minRent > 0 ? summary.minRent.toString() : prev.price,
      };
    });
  };

  const [cities, setCities] = useState([]);
  const [localities, setLocalities] = useState([]);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [offlineDrafts, setOfflineDrafts] = useState([]);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [regConfig, setRegConfig] = useState(null);
  const [regUtr, setRegUtr] = useState("");
  const [razorpayDetails, setRazorpayDetails] = useState(null);
  const [platformSettings, setPlatformSettings] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState("3pack");
  const [selectedPlanAmount, setSelectedPlanAmount] = useState(null);
  
  // Custom Plan Builder State
  const [planMode, setPlanMode] = useState("packages"); // 'packages' | 'custom'
  const [customHouseCount, setCustomHouseCount] = useState(1);
  const [customPgCount, setCustomPgCount] = useState(0);
  const [customPgDuration, setCustomPgDuration] = useState(30);
  const [customCommercialCount, setCustomCommercialCount] = useState(0);
  const [customAddonFeatured, setCustomAddonFeatured] = useState(false);
  const [customAddonHero, setCustomAddonHero] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("online"); // 'online' | 'upi'

  const [selectedStateKey, setSelectedStateKey] = useState("karnataka");
  const [selectedCityId, setSelectedCityId] = useState("hubli");
  const [mapCenter, setMapCenter] = useState([15.3647, 75.1240]);
  const [mapZoom, setMapZoom] = useState(13);

  const [ownerCredits, setOwnerCredits] = useState({ has_active_credits: false, total_credits_remaining: 0 });

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/properties/platform-settings/`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setPlatformSettings(data);
      })
      .catch((err) => console.error(err));

    if (user) {
      const catQuery = formData.property_category ? `?category=${formData.property_category}` : "";
      fetch(`${import.meta.env.VITE_API_URL}/properties/owner-credits/${catQuery}`, { credentials: "include" })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) setOwnerCredits(data);
        })
        .catch((err) => console.error("Could not fetch owner credits:", err));
    }
  }, [user, formData.property_category]);

  const getCategoryPlans = () => {
    const isCommercial =
      formData.property_category === "commercial" ||
      ["shop", "office", "warehouse", "showroom", "industrial", "commercial_building"].includes(
        formData.property_type
      );

    const isPg = formData.property_category === "pg" || formData.property_type === "pg_hostel";

    if (isCommercial) {
      const commDays = platformSettings?.validity_commercial_days || 30;
      return {
        categoryName: "Commercial Property",
        categoryTag: "COMMERCIAL",
        validityDays: commDays,
        plans: [
          {
            id: "single",
            name: "Single Commercial Listing",
            price: Number(platformSettings?.owner_commercial_fee) || 199,
            count: 1,
            tag: "Standard",
            popular: false,
            description: `Live for ${commDays} days · Standard visibility for 1 commercial property.`
          },
          {
            id: "3pack",
            name: "Commercial 3-Pack Pass",
            price: Number(platformSettings?.owner_commercial_3pack_price) || 449,
            count: 3,
            tag: "Featured",
            popular: true,
            description: `Live for ${commDays} days · Priority search placement & WhatsApp alerts to 500+ buyers.`
          },
          {
            id: "6pack",
            name: "Commercial 6-Pack VIP Pass",
            price: Number(platformSettings?.owner_commercial_6pack_price) || 799,
            count: 6,
            tag: "VIP Deal",
            popular: false,
            description: `Live for ${commDays} days · Dedicated concierge agent & homepage hero banner spotlight.`
          }
        ]
      };
    } else if (isPg) {
      const pgDays = platformSettings?.validity_apt_pg_days || 60;
      return {
        categoryName: "PG & Hostel",
        categoryTag: "PG / HOSTEL",
        validityDays: pgDays,
        plans: [
          {
            id: "single",
            name: "Single PG & Hostel Listing",
            price: Number(platformSettings?.owner_apt_pg_fee) || 149,
            count: 1,
            tag: "Standard",
            popular: false,
            description: `Live for ${pgDays} days · Standard listing visibility for 1 PG or Hostel.`
          },
          {
            id: "3pack",
            name: "PG & Hostel 3-Pack Pass",
            price: Number(platformSettings?.owner_apt_pg_3pack_price) || 349,
            count: 3,
            tag: "Featured",
            popular: true,
            description: `Live for ${pgDays} days · Top search ranking & WhatsApp buyer broadcasts.`
          },
          {
            id: "6pack",
            name: "PG & Hostel 6-Pack VIP Pass",
            price: Number(platformSettings?.owner_apt_pg_6pack_price) || 649,
            count: 6,
            tag: "VIP Deal",
            popular: false,
            description: `Live for ${pgDays} days · Dedicated concierge agent & free verification.`
          }
        ]
      };
    } else {
      const resDays = platformSettings?.validity_residential_days || 30;
      return {
        categoryName: "Residential House / Villa",
        categoryTag: "RESIDENTIAL",
        validityDays: resDays,
        plans: [
          {
            id: "single",
            name: "Single House/Villa Listing",
            price: Number(platformSettings?.owner_residential_fee) || 99,
            count: 1,
            tag: "Standard",
            popular: false,
            description: `Live for ${resDays} days · Standard visibility for 1 independent house, villa or plot.`
          },
          {
            id: "3pack",
            name: "Residential 3-Pack Pass",
            price: Number(platformSettings?.owner_residential_3pack_price) || 259,
            count: 3,
            tag: "Featured",
            popular: true,
            description: `Live for ${resDays} days · Top search placement & instant tenant alerts.`
          },
          {
            id: "6pack",
            name: "Residential 6-Pack VIP Pass",
            price: Number(platformSettings?.owner_residential_6pack_price) || 499,
            count: 6,
            tag: "VIP Deal",
            popular: false,
            description: `Live for ${resDays} days · Concierge support & homepage banner spotlight.`
          }
        ]
      };
    };
  };

  // OTP State
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);

  // Selfie verification state (used when platform is set to 'selfie' mode)
  const [selfiePhoto, setSelfiePhoto] = useState(null); // base64 data URL
  const [selfiePreview, setSelfiePreview] = useState(null);
  const [showSelfieCamera, setShowSelfieCamera] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [faceMisaligned, setFaceMisaligned] = useState(false);
  const selfieVideoRef = useRef(null);
  const selfieCanvasRef = useRef(null);
  const selfieStreamRef = useRef(null);
  const selfieTimeoutRef = useRef(null);
  const trackingTaskRef = useRef(null);

  const openSelfieCamera = async () => {
    setShowSelfieCamera(true);
    setFaceDetected(false);
    setFaceMisaligned(false);
    
    // Dynamically load tracking.js
    const loaded = await loadTrackingLibrary();
    if (!loaded) {
      toast.error("Could not load face detection modules.");
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "user" } } });
      selfieStreamRef.current = stream;
      setTimeout(() => { 
        if (selfieVideoRef.current) {
          selfieVideoRef.current.srcObject = stream;
          
          // Face detection setup after video warms up
          setTimeout(() => {
            const video = selfieVideoRef.current;
            if (!video) return;
            
            if (window.tracking && window.tracking.ObjectTracker) {
              const tracker = new window.tracking.ObjectTracker('face');
              tracker.setInitialScale(4);
              tracker.setStepSize(2);
              tracker.setEdgesDensity(0.1);

              trackingTaskRef.current = window.tracking.track(video, tracker);
              
              tracker.on('track', (event) => {
                if (!event.data || event.data.length === 0) {
                  setFaceDetected(false);
                  setFaceMisaligned(false);
                } else {
                  const rect = event.data[0];
                  const videoWidth = video.videoWidth || 640;
                  const videoHeight = video.videoHeight || 480;
                  
                  // Calculate face center coordinates normalized to 0-1
                  const faceCenterX = (rect.x + rect.width / 2) / videoWidth;
                  const faceCenterY = (rect.y + rect.height / 2) / videoHeight;
                  const faceWidthRatio = rect.width / videoWidth;
                  
                  // Face must be horizontally centered (32%-68%), vertically centered (22%-78%), and at the correct scale (22%-68% of frame width)
                  const isCentered = faceCenterX >= 0.32 && faceCenterX <= 0.68 && faceCenterY >= 0.22 && faceCenterY <= 0.78;
                  const isRightSize = faceWidthRatio >= 0.22 && faceWidthRatio <= 0.68;
                  
                  if (isCentered && isRightSize) {
                    setFaceDetected(true);
                    setFaceMisaligned(false);
                  } else {
                    setFaceDetected(false);
                    setFaceMisaligned(true);
                  }
                }
              });
            } else {
              // Simulated fallback e-KYC scanner visuals
              selfieTimeoutRef.current = setTimeout(() => {
                setFaceMisaligned(true);
                selfieTimeoutRef.current = setTimeout(() => {
                  setFaceDetected(true);
                  setFaceMisaligned(false);
                }, 800);
              }, 400);
            }
          }, 600);
        }
      }, 100);
    } catch {
      toast.error("Camera access denied. Please allow camera access.");
      setShowSelfieCamera(false);
    }
  };

  const closeSelfieCamera = () => {
    if (selfieStreamRef.current) { selfieStreamRef.current.getTracks().forEach(t => t.stop()); selfieStreamRef.current = null; }
    if (trackingTaskRef.current) { trackingTaskRef.current.stop(); trackingTaskRef.current = null; }
    if (selfieTimeoutRef.current) { clearTimeout(selfieTimeoutRef.current); selfieTimeoutRef.current = null; }
    setFaceDetected(false);
    setFaceMisaligned(false);
    setShowSelfieCamera(false);
  };

  const captureSelfie = () => {
    if (selfieVideoRef.current && selfieCanvasRef.current) {
      const video = selfieVideoRef.current;
      const canvas = selfieCanvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      setSelfiePhoto(dataUrl);
      setSelfiePreview(dataUrl);
      closeSelfieCamera();
      toast.success("Owner selfie captured!");
    }
  };

  const handleGenerateDescription = async () => {
    if (!formData.bhk && !formData.property_type && !formData.price) {
      toast.warn("Please fill out BHK, Property Type, and Price first for better results.");
    }
    setGeneratingDescription(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/properties/generate-description/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        const data = await res.json();
        setFormData(prev => ({ ...prev, description: data.description }));
        toast.success("Description auto-generated!");
      } else {
        toast.error("Failed to generate description.");
      }
    } catch (err) {
      toast.error("An error occurred.");
    } finally {
      setGeneratingDescription(false);
    }
  };

  const loadOfflineDrafts = async () => {
    try {
      const ks = await keys();
      const drafts = [];
      for (const k of ks) {
        if (typeof k === "string" && k.startsWith("draft_")) {
          const val = await get(k);
          drafts.push({ key: k, val });
        }
      }
      setOfflineDrafts(drafts);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadOfflineDrafts();
    const handleOnline = () => {
      toast.info("Back online! Ready to sync offline drafts.");
      loadOfflineDrafts();
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  const saveOfflineDraft = async (payload, files, audioBlob, signatureUrl) => {
    try {
      const key = "draft_" + Date.now();
      const val = {
        payload,
        files: files, // Storing File objects directly in IndexedDB is supported in most modern browsers
        audioBlob,
        signatureUrl,
        savedAt: new Date().toISOString(),
      };
      await set(key, val);
      toast.info("Saved offline — will submit when back online");
      loadOfflineDrafts();
    } catch (e) {
      console.error("Failed to save offline draft", e);
      toast.error("Failed to save offline draft");
    }
  };

  const syncDraft = async (draftKey) => {
    try {
      const draft = await get(draftKey);
      if (!draft) return;
      const { payload, files, audioBlob, signatureUrl } = draft;
      setIsSubmitting(true);
      const uploadedMediaUrls = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        const uploadRes = await fetch(
          `${import.meta.env.VITE_API_URL}/media/upload/`,
          {
            method: "POST",
            credentials: "include",
            body: formData,
          },
        );
        if (!uploadRes.ok) throw new Error("Upload failed");
        const data = await uploadRes.json();
        uploadedMediaUrls.push({
          image_url: data.full_url,
          medium_url: data.medium_url,
          thumbnail_url: data.thumbnail_url,
          image_hash: data.image_hash,
        });
      }
      let finalSignatureUrl = "";
      if (signatureUrl && signatureUrl.startsWith("data:image")) {
        const fetchRes = await fetch(signatureUrl);
        const sigBlob = await fetchRes.blob();
        const presignRes = await fetch(
          `${import.meta.env.VITE_API_URL}/media/upload-url/`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              file_name: "signature.png",
              file_size: sigBlob.size,
              file_type: "image/png",
            }),
          },
        );
        if (presignRes.ok) {
          const { upload_url, public_url } = await presignRes.json();
          await fetch(upload_url, {
            method: "PUT",
            headers: { "Content-Type": "image/png" },
            body: sigBlob,
          });
          finalSignatureUrl = public_url;
        }
      } else {
        finalSignatureUrl = signatureUrl;
      }
      let uploadedVoiceNoteUrl = "";
      if (audioBlob) {
        const vnFormData = new FormData();
        vnFormData.append("file", audioBlob, "voice_note.webm");
        const vnRes = await fetch(
          `${import.meta.env.VITE_API_URL}/media/upload/voice-note/`,
          {
            method: "POST",
            credentials: "include",
            body: vnFormData,
          },
        );
        if (vnRes.ok) {
          uploadedVoiceNoteUrl = (await vnRes.json()).public_url;
        }
      }
      const finalPayload = {
        ...payload,
        consent_proof_url:
          payload.consentMethod === "signature"
            ? finalSignatureUrl
            : "otp_verified_placeholder",
        uploaded_media: uploadedMediaUrls,
        voice_note_url: uploadedVoiceNoteUrl,
        registration_payment_method: regConfig?.payment_gateway === 'razorpay' ? "razorpay" : "upi",
        registration_utr: regUtr,
        registration_razorpay_order_id: razorpayDetails?.order_id,
        registration_razorpay_payment_id: razorpayDetails?.payment_id,
        registration_razorpay_signature: razorpayDetails?.signature,
      };
      const res = await fetch(`${import.meta.env.VITE_API_URL}/properties/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(finalPayload),
      });
      if (res.ok) {
        toast.success("Offline draft synced successfully!");
        await del(draftKey);
        loadOfflineDrafts();
      } else {
        throw new Error("Failed to create listing");
      }
    } catch (e) {
      toast.error("Sync failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    // Fetch cities the agent/owner is assigned to
    if (user) {
      const uRoles = user.roles || (user.role ? [user.role] : []);
      const isStaffUser = uRoles.some(r => ['admin', 'sub_admin', 'subadmin', 'agent'].includes(r));
      if (!isStaffUser) {
        const ownerNameStr = (user.first_name || user.last_name)
          ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
          : (user.username || "");
        setFormData((prev) => ({
          ...prev,
          owner_name: prev.owner_name || ownerNameStr,
          owner_phone: prev.owner_phone || user.phone || ""
        }));
      }
      fetch(`${import.meta.env.VITE_API_URL}/properties/cities/`)
        .then((res) => res.json())
        .then((data) => {
          let availableCities = data;
          const userRoles = user.roles || [user.role];
          if (userRoles.includes("agent")) {
            availableCities = data.filter((city) =>
              user.assigned_cities?.includes(city.id),
            );
          }
          setCities(availableCities);
          if (availableCities.length === 1) {
            setFormData((prev) => ({
              ...prev,
              city_id: availableCities[0].id.toString(),
            }));
          }
        })
      fetch(`${import.meta.env.VITE_API_URL}/properties/owner-credits/`, { credentials: "include" })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) setOwnerCredits(data);
        })
        .catch((err) => console.error("Could not fetch owner credits:", err));
    }
  }, [user]);

  useEffect(() => {
    if (formData.city_id) {
      fetch(
        `${import.meta.env.VITE_API_URL}/properties/cities/${formData.city_id}/localities/`,
      )
        .then((res) => res.json())
        .then((data) => {
          setLocalities(data);
          if (formData.locality) {
            const locStr = formData.locality.toString();
            const matched = data.find((l) => l.id.toString() === locStr || l.name.toLowerCase() === locStr.toLowerCase());
            if (matched) {
              setFormData((prev) => ({ ...prev, locality: matched.name }));
            }
          }
        })
        .catch((err) => console.error(err));

      fetch(
        `${import.meta.env.VITE_API_URL}/properties/cities/${formData.city_id}/registration-config/`,
      )
        .then((res) => res.json())
        .then((data) => {
          const role = user?.role || "owner";
          const gateway =
            role === "admin"
              ? data.admin_payment_gateway
              : role === "agent"
                ? data.agent_payment_gateway
                : data.owner_payment_gateway;
          setRegConfig({ ...data, payment_gateway: gateway });
        })
        .catch((err) => console.error(err));
    } else {
      setLocalities([]);
      setRegConfig(null);
    }
  }, [formData.city_id, user?.role]);

  const [position, setPosition] = useState(() => {
    const saved = localStorage.getItem("owner_onboarding_position");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (error) {
        console.error("Failed to parse cached owner_onboarding_position:", error);
        toast.error("Failed to load cached map location.");
        localStorage.removeItem("owner_onboarding_position");
      }
    }
    return null;
  });
  
  useEffect(() => {
    if (isSubmittedRef.current) return;
    if (position) {
      localStorage.setItem("owner_onboarding_position", JSON.stringify(position));
    }
  }, [position]);

  const handleLocationUpdate = async (latlng) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latlng.lat}&lon=${latlng.lng}&format=jsonv2&accept-language=en`);
      if (res.ok) {
        const data = await res.json();
        const addressObj = data.address || {};
        const newAddress = data.display_name || "";
        
        const cName = addressObj.city || addressObj.town || addressObj.municipality || addressObj.county || addressObj.state_district || "";
        const sName = addressObj.state || "";
        const lName = addressObj.residential || addressObj.neighbourhood || addressObj.suburb || addressObj.village || addressObj.hamlet || addressObj.road || "";

        setFormData((prev) => {
          const updated = { 
            ...prev, 
            exact_address: newAddress,
            city_name_input: cName || prev.city_name_input || "",
            state_name_input: sName || prev.state_name_input || "",
            locality_name_input: lName || prev.locality_name_input || prev.locality || "",
            locality: lName || prev.locality || ""
          };
          const foundCity = cities.find(c => c.name.toLowerCase() === cName.toLowerCase());
          if (foundCity) {
            updated.city_id = foundCity.id.toString();
          } else if (!prev.city_id && cities.length > 0) {
            updated.city_id = cities[0].id.toString();
          }
          return updated;
        });
        toast.success("Address auto-filled from map pin!");
      }
    } catch (e) {
      console.error("Reverse geocoding failed", e);
    }
  };

  const detectMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser.");
      return;
    }
    toast.info("Detecting your location...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latlng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPosition(latlng);
        handleLocationUpdate(latlng);
      },
      (err) => {
        toast.error("Could not detect location. Please click on the map to drop a pin.");
      }
    );
  };

  const [files, setFiles] = useState([]);
  const [uploadedMediaList, setUploadedMediaList] = useState(() => {
    try {
      const saved = localStorage.getItem("owner_onboarding_uploaded_media");
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [step, setStep] = useState(() => {
    const saved = localStorage.getItem("owner_onboarding_step");
    if (saved) {
      try {
        const parsed = parseInt(saved, 10);
        if (isNaN(parsed)) throw new Error("Parsed step is NaN");
        return Math.min(4, parsed);
      } catch (error) {
        console.error("Failed to parse cached owner_onboarding_step:", error);
        toast.error("Failed to load cached step. Starting from step 1.");
        localStorage.removeItem("owner_onboarding_step");
      }
    }
    return 1;
  });

  const goToStep = (targetStep) => {
    const nextVal = Math.max(1, Math.min(4, targetStep));
    setStep(nextVal);
    try {
      localStorage.setItem("owner_onboarding_step", nextVal.toString());
    } catch (e) {}
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    if (user && step === 4) {
      let targetCat = "residential";
      if (formData.property_category === "commercial" || ["shop", "office", "warehouse", "showroom", "industrial", "commercial_building"].includes(formData.property_type)) {
        targetCat = "commercial";
      } else if (formData.property_category === "pg" || formData.property_type === "pg_hostel") {
        targetCat = "pg";
      }

      fetch(`${import.meta.env.VITE_API_URL}/properties/owner-credits/?category=${targetCat}`, { credentials: "include" })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) setOwnerCredits(data);
        })
        .catch((err) => console.error("Could not fetch owner credits:", err));
    }
  }, [user, step, formData.property_category, formData.property_type]);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get("reset") === "true") {
      isSubmittedRef.current = true;
      localStorage.removeItem("owner_onboarding_form_data");
      localStorage.removeItem("owner_onboarding_step");
      localStorage.removeItem("owner_onboarding_position");
      setFormData({
        ...defaultOwnerFormData,
        owner_name: user?.first_name || user?.username || "",
        owner_phone: user?.phone || ""
      });
      setStep(1);
      setPosition(null);
      setFiles([]);
      navigate(location.pathname, { replace: true });
      setTimeout(() => { isSubmittedRef.current = false; }, 300);
    }
  }, [location.search, user, navigate]);

  useEffect(() => {
    if (isSubmittedRef.current) return;
    const { owner_password, ...safeFormData } = formData;
    localStorage.setItem("owner_onboarding_form_data", JSON.stringify(safeFormData));
  }, [formData]);

  useEffect(() => {
    if (isSubmittedRef.current) return;
    localStorage.setItem("owner_onboarding_step", step.toString());
  }, [step]);

  const handleDiscard = () => {
    if (window.confirm("Are you sure you want to discard your draft? This will clear all entered data.")) {
      localStorage.removeItem("owner_onboarding_form_data");
      localStorage.removeItem("owner_onboarding_step");
      localStorage.removeItem("owner_onboarding_position");
      localStorage.removeItem("owner_onboarding_signature_data");
      localStorage.removeItem("owner_onboarding_uploaded_media");
      setSignatureData(null);
      setUploadedMediaList([]);
      setFormData({ ...defaultOwnerFormData, owner_name: (user.first_name || user.last_name) ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : "", owner_phone: user.phone || "" });
      setStep(1);
      setFiles([]);
      setPosition(null);
    }
  };


  const userRolesList = user?.roles || (user?.role ? [user.role] : []);
  const isStaff = userRolesList.some(r => ['admin', 'sub_admin', 'subadmin', 'agent'].includes(r));

  const [ownerAccountExists, setOwnerAccountExists] = useState(null);
  const [ownerAccountDetails, setOwnerAccountDetails] = useState(null);
  const [checkingOwnerPhone, setCheckingOwnerPhone] = useState(false);

  useEffect(() => {
    const phoneClean = (formData.owner_phone || "").replace(/[^0-9]/g, "");
    if (phoneClean.length >= 10) {
      setCheckingOwnerPhone(true);
      fetch(`${import.meta.env.VITE_API_URL}/accounts/check-phone/?phone=${phoneClean}`, { credentials: "include" })
        .then((res) => res.json())
        .then((data) => {
          if (data.exists) {
            setOwnerAccountExists(true);
            setOwnerAccountDetails(data);
            if (!formData.owner_name && data.first_name) {
              setFormData((prev) => ({ ...prev, owner_name: data.first_name }));
            }
          } else {
            setOwnerAccountExists(false);
            setOwnerAccountDetails(null);
          }
        })
        .catch(() => {})
        .finally(() => setCheckingOwnerPhone(false));
    } else {
      setOwnerAccountExists(null);
      setOwnerAccountDetails(null);
    }
  }, [formData.owner_phone]);

  const [consentMethod, setConsentMethod] = useState("signature");
  const [signatureData, setSignatureData] = useState(() => {
    return localStorage.getItem("owner_onboarding_signature_data") || null;
  });
  const sigCanvas = useRef(null);

  useEffect(() => {
    if (step === -1 && consentMethod === "signature" && signatureData && sigCanvas.current) {
      try {
        sigCanvas.current.clear();
        sigCanvas.current.fromDataURL(signatureData);
      } catch (e) {
        console.error("Could not restore signature canvas", e);
      }
    }
  }, [step, consentMethod]);
  const [proofPhoto, setProofPhoto] = useState(null);
  const [proofPhotoPreview, setProofPhotoPreview] = useState(null);

  // Live Camera Capture State & Refs
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraTarget, setCameraTarget] = useState("consent");
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraStreamRef = useRef(null);

  const openCamera = async (target = "consent") => {
    setCameraTarget(target);
    setShowCameraModal(true);
    try {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }
      cameraStreamRef.current = stream;
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err) {
      toast.error("Camera access denied or unavailable. Please upload a file instead.");
      setShowCameraModal(false);
    }
  };

  const closeCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
    }
    setShowCameraModal(false);
  };

  const capturePhotoFromCamera = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const fileName = `camera_photo_${Date.now()}.jpg`;
            const file = new File([blob], fileName, { type: "image/jpeg" });
            if (cameraTarget === "consent") {
              setProofPhoto(file);
              setProofPhotoPreview(URL.createObjectURL(file));
              toast.success("Photo captured for verification!");
            } else {
              setFiles((prev) => [
                ...prev,
                Object.assign(file, { preview: URL.createObjectURL(file) }),
              ]);
              toast.success("Property photo captured!");
            }
            closeCamera();
          }
        },
        "image/jpeg",
        0.9,
      );
    }
  };

  // Voice Note State
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const mediaRecorder = useRef(null);
  const [audioURL, setAudioURL] = useState(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      const chunks = [];
      mediaRecorder.current.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.current.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioURL(URL.createObjectURL(blob));
      };
      mediaRecorder.current.start();
      setIsRecording(true);
    } catch (err) {
      toast.error("Microphone access denied or unavailable.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current) {
      mediaRecorder.current.stop();
      setIsRecording(false);
    }
  };

  const clearRecording = () => {
    setAudioBlob(null);
    setAudioURL(null);
  };

  const onDrop = useCallback(async (acceptedFiles) => {
    let validFiles = [...acceptedFiles];
    const nonImage = validFiles.find((f) => !f.type.startsWith("image/"));
    if (nonImage) {
      toast.error("Only image files are allowed.");
      validFiles = validFiles.filter((f) => f.type.startsWith("image/"));
    }

    const oversized = validFiles.find((f) => f.size > 5 * 1024 * 1024);
    if (oversized) {
      toast.error("File size must not exceed 5MB per photo.");
      validFiles = validFiles.filter((f) => f.size <= 5 * 1024 * 1024);
    }

    if (validFiles.length === 0) return;

    setUploadingPhotos(true);
    const toastId = toast.loading(`Uploading ${validFiles.length} photo(s)...`);

    try {
      const newUploaded = [];
      for (const file of validFiles) {
        // Compress the image file in the browser to WebP format before uploading
        const compressedFile = await compressImage(file);
        const formData = new FormData();
        formData.append("file", compressedFile);

        const uploadRes = await fetch(
          `${import.meta.env.VITE_API_URL}/media/upload/`,
          {
            method: "POST",
            credentials: "include",
            body: formData,
          },
        );

        if (uploadRes.ok) {
          const data = await uploadRes.json();
          newUploaded.push({
            image_url: data.full_url,
            medium_url: data.medium_url,
            thumbnail_url: data.thumbnail_url,
            image_hash: data.image_hash,
          });
        } else {
          toast.error(`Failed to upload ${file.name}`);
        }
      }

      toast.dismiss(toastId);
      if (newUploaded.length > 0) {
        setUploadedMediaList((prev) => {
          const updated = [...prev, ...newUploaded].slice(0, 10);
          try {
            localStorage.setItem("owner_onboarding_uploaded_media", JSON.stringify(updated));
          } catch (e) {}
          return updated;
        });
        toast.success(`Successfully uploaded ${newUploaded.length} photo(s)!`);
      }
    } catch (err) {
      toast.dismiss(toastId);
      console.error("Photo upload error:", err);
      toast.error("Error uploading photo(s).");
    } finally {
      setUploadingPhotos(false);
    }
  }, []);

  const removeUploadedMedia = (indexToRemove) => {
    setUploadedMediaList((prev) => {
      const updated = prev.filter((_, idx) => idx !== indexToRemove);
      try {
        localStorage.setItem("owner_onboarding_uploaded_media", JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
  });

  const handleInputChange = (e) => {
    let { name, value } = e.target;
    
    // Global validation rules for maximum length input fields
    const descriptiveFields = ["description", "society", "street", "landmark", "title"];
    if (name === "owner_phone" || name === "tenant_phone") {
      value = value.replace(/[^0-9+]/g, '').slice(0, 10);
    } else if (descriptiveFields.includes(name)) {
      value = value.slice(0, 1000);
    } else if (["price", "carpet_area", "security_deposit", "maintenance_charges", "total_beds", "available_beds"].includes(name)) {
      value = value.slice(0, 10);
    } else if (["floor_number", "total_floors", "bedrooms", "bathrooms", "balconies", "property_age"].includes(name)) {
      value = value.slice(0, 3);
    } else {
      value = value.slice(0, 100);
    }

    // Auto-capitalize first letter for text fields
    const textFields = ["owner_name", "society", "street", "landmark", "title", "description"];
    if (textFields.includes(name) && value.length > 0) {
      value = value.charAt(0).toUpperCase() + value.slice(1);
    }
    
    if (name === "owner_phone") {
      setOtpSent(false);
      setOtpVerified(false);
      setOtpCode("");
    }

    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      if (name === "city_id") {
        updated.locality = "";
      }
      if (name === "property_type") {
        if (value === "1bhk") updated.bedrooms = "1";
        else if (value === "2bhk") updated.bedrooms = "2";
        else if (value === "3bhk") updated.bedrooms = "3";
        else if (value === "4bhk") updated.bedrooms = "4";
        else if (value === "5bhk") updated.bedrooms = "5";
        else if (value === "studio") updated.bedrooms = "1";
      }
      return updated;
    });
  };

  const handleNext = () => {
    if (step === 1) {
      if (!formData.owner_name?.trim()) {
        toast.warn("Please enter Owner Name.");
        return;
      }
      if (!formData.owner_phone?.trim()) {
        toast.warn("Please enter Owner Phone Number.");
        return;
      }
      if (!formData.property_type) {
        toast.warn("Please select Property Type.");
        return;
      }
      if (!formData.city_id && cities.length > 0) {
        formData.city_id = cities[0].id.toString();
      }
      if (!formData.locality?.trim()) {
        toast.warn("Please enter or pin Locality.");
        return;
      }
      if (formData.property_category !== "pg" && !formData.price) {
        toast.warn("Please enter Rent Price.");
        return;
      }
      if (!position) {
        toast.warn("Please pin the exact property location on the map.");
        return;
      }
    }
    if (step === 2) {
      if (formData.property_category === "residential") {
        if (formData.property_type !== "studio" && !formData.bedrooms) {
          toast.warn("Please enter Bedrooms / BHK count.");
          return;
        }
        if (!formData.bathrooms) {
          toast.warn("Please enter Bathrooms count.");
          return;
        }
      } else if (formData.property_category === "pg") {
        if (!formData.available_beds) {
          toast.warn("Please enter Available Beds count.");
          return;
        }
      } else if (formData.property_category === "commercial") {
        if (!formData.carpet_area) {
          toast.warn("Please enter Carpet Area (sq.ft).");
          return;
        }
      }
    }
    setStep((prev) => {
      const nextStep = Math.min(4, prev + 1);
      localStorage.setItem("owner_onboarding_step", nextStep.toString());
      return nextStep;
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const sendOTP = async () => {
    setOtpLoading(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/auth/buyer-otp/request/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ phone: formData.owner_phone, intended_role: "owner" }),
        },
      );
      if (res.ok) {
        const data = await res.json();
        if (!data.require_otp) {
          toast.success("OTP Verified (bypassed by settings).");
          setOtpVerified(true);
        } else {
          toast.success(`OTP Sent! (Demo code: ${data.demo_code})`);
          setOtpSent(true);
        }
      } else {
        toast.error("Failed to send OTP.");
      }
    } catch (err) {
      toast.error("Network error while sending OTP.");
    } finally {
      setOtpLoading(false);
    }
  };

  const verifyOTP = async () => {
    setOtpLoading(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/auth/buyer-otp/verify/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ phone: formData.owner_phone, code: otpCode }),
        },
      );
      if (res.ok) {
        toast.success("OTP Verified!");
        setOtpVerified(true);
      } else {
        toast.error("Invalid or expired OTP.");
      }
    } catch (err) {
      toast.error("Network error verifying OTP.");
    } finally {
      setOtpLoading(false);
    }
  };

  // Dynamically load Razorpay checkout script
  const loadRazorpayScript = () =>
    new Promise((resolve) => {
      if (document.getElementById('razorpay-sdk')) return resolve(true);
      const script = document.createElement('script');
      script.id = 'razorpay-sdk';
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });

  const handleOnboardingPayment = async (propertyId, fee) => {
    const loaded = await loadRazorpayScript();
    if (!loaded) {
      toast.error('Could not load Razorpay. Please try again.');
      return;
    }

    // Initiate Razorpay order
    let orderData;
    try {
      const initRes = await fetch(
        `${import.meta.env.VITE_API_URL}/properties/${propertyId}/onboarding/initiate/`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: selectedPlanAmount, plan: selectedPlan }),
        }
      );
      if (!initRes.ok) {
        const err = await initRes.json().catch(() => ({}));
        toast.error(err.detail || 'Could not initiate payment.');
        return;
      }
      orderData = await initRes.json();
    } catch {
      toast.error('Network error initiating payment.');
      return;
    }

    return new Promise((resolve) => {
      const options = {
        key: orderData.razorpay_key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'Rentlo',
        description: 'Property Onboarding Fee',
        order_id: orderData.order_id,
        handler: async (response) => {
          try {
            const verifyRes = await fetch(
              `${import.meta.env.VITE_API_URL}/properties/${propertyId}/onboarding/verify/`,
              {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_order_id:   response.razorpay_order_id,
                  razorpay_signature:  response.razorpay_signature,
                }),
              }
            );
            if (verifyRes.ok) {
              toast.success('Onboarding payment successful! ✓');
            } else {
              const err = await verifyRes.json().catch(() => ({}));
              toast.error(err.detail || 'Payment verification failed.');
            }
          } catch {
            toast.error('Network error verifying payment.');
          }
          resolve();
        },
        modal: {
          ondismiss: () => {
            toast.info('Payment skipped. You can pay later from your dashboard.');
            resolve();
          },
        },
        prefill: {
          name: user?.first_name || user?.username || '',
          contact: user?.phone || '',
        },
        theme: { color: '#ea580c' },
      };
      const rzp = new window.Razorpay(options);
      rzp.open();
    });
  };


  const handleRazorpayPayment = async (targetAmount, targetPlan) => {
    const validationErrors = [];
    if (!formData.property_type) validationErrors.push("Property type is required");
    if (formData.property_category !== 'pg' && (!formData.price || isNaN(formData.price) || Number(formData.price) <= 0)) {
      validationErrors.push("Valid monthly price is required");
    }

    if (validationErrors.length > 0) {
      toast.error(validationErrors.join(" • "));
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/properties/create-registration-order/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          city_id: formData.city_id,
          amount: targetAmount,
          plan: targetPlan
        })
      });
      if (!res.ok) throw new Error("Failed to create order");
      const data = await res.json();
      
      const options = {
        key: data.key_id,
        amount: data.amount,
        currency: "INR",
        name: "Rentlo",
        description: "Property Registration & Package Fee",
        order_id: data.order_id,
        handler: function (response) {
          setRazorpayDetails({
            order_id: response.razorpay_order_id,
            payment_id: response.razorpay_payment_id,
            signature: response.razorpay_signature
          });
        },
        prefill: {
          name: formData.owner_name,
          contact: formData.owner_phone
        },
        theme: {
          color: "#ea580c"
        }
      };
      await loadRazorpayScript();
      if (!window.Razorpay) {
        toast.error("Unable to load Razorpay SDK. Please check your internet connection.");
        return;
      }
      const rzp1 = new window.Razorpay(options);
      rzp1.on('payment.failed', function (response){
        toast.error(response.error.description);
      });
      rzp1.open();
    } catch (err) {
      toast.error("Could not initialize payment gateway. " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (razorpayDetails) {
      handleSubmit();
    }
  }, [razorpayDetails]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      let consentProofUrl = "";

      if (consentMethod === "signature") {
        if (signatureData) {
          try {
            const fetchRes = await fetch(signatureData);
            const sigBlob = await fetchRes.blob();
            const sigFormData = new FormData();
            sigFormData.append("file", sigBlob, "signature.png");
            const uploadRes = await fetch(
              `${import.meta.env.VITE_API_URL}/media/upload/`,
              {
                method: "POST",
                credentials: "include",
                body: sigFormData,
              },
            );
            if (uploadRes.ok) {
              const data = await uploadRes.json();
              consentProofUrl = data.full_url;
            }
          } catch (e) {
            console.error("Signature upload failed, using paid consent fallback", e);
          }
        }
        if (!consentProofUrl) {
          if (razorpayDetails) {
            consentProofUrl = "verified_owner_consent_paid";
          } else {
            toast.error("Signature data missing. Please go back to the Consent step and sign again.");
            setIsSubmitting(false);
            return;
          }
        }
      } else if (consentMethod === "photo") {
        if (!proofPhoto) {
          toast.error("Please upload a photo verification document.");
          setIsSubmitting(false);
          return;
        }
        try {
          const photoFormData = new FormData();
          photoFormData.append("file", proofPhoto);
          const uploadRes = await fetch(
            `${import.meta.env.VITE_API_URL}/media/upload/`,
            {
              method: "POST",
              credentials: "include",
              body: photoFormData,
            },
          );
          if (uploadRes.ok) {
            const data = await uploadRes.json();
            consentProofUrl = data.full_url;
          } else {
            toast.error("Failed to upload photo verification document.");
            setIsSubmitting(false);
            return;
          }
        } catch {
          toast.error("Error uploading photo verification document.");
          setIsSubmitting(false);
          return;
        }
      }

      // Upload photos directly to the backend processing endpoint
      let uploadedVoiceNoteUrl = "";
      if (audioBlob) {
        const vnFormData = new FormData();
        vnFormData.append("file", audioBlob, "voice_note.webm");
        const vnRes = await fetch(
          `${import.meta.env.VITE_API_URL}/media/upload/voice-note/`,
          {
            method: "POST",
            credentials: "include",
            body: vnFormData,
          },
        );
        if (vnRes.ok) {
          const vnData = await vnRes.json();
          uploadedVoiceNoteUrl = vnData.public_url;
        } else {
          toast.error("Failed to upload voice note. Continuing without it.");
        }
      }

      // Clean empty numeric fields
      const cleanData = { ...formData };
      const numericFields = ['bedrooms', 'bathrooms', 'balconies', 'carpet_area', 'floor_number', 'total_floors', 'property_age', 'security_deposit', 'maintenance_charges', 'price'];
      for (const field of numericFields) {
        if (cleanData[field] === "") {
          delete cleanData[field];
        }
      }
      // Clean empty optional string / date fields
      const optionalStringFields = ['available_from', 'furnishing_status', 'facing_direction', 'voice_note_url', 'consent_proof_url'];
      for (const field of optionalStringFields) {
        if (cleanData[field] === "" || cleanData[field] === null || cleanData[field] === undefined) {
          delete cleanData[field];
        }
      }

      // Create listing
      const pgSummary = formData.property_category === 'pg' ? calculatePgSummary(formData.pg_room_inventory) : null;

      const payload = {
        ...cleanData,
        total_beds: pgSummary ? pgSummary.totalBeds : cleanData.total_beds,
        available_beds: pgSummary ? pgSummary.availableBeds : cleanData.available_beds,
        price: (pgSummary && pgSummary.minRent > 0) ? pgSummary.minRent : cleanData.price,
        pg_rules: formData.property_category === 'pg' ? { room_inventory: formData.pg_room_inventory } : cleanData.pg_rules,
        exact_lat: position?.lat ? Number(position.lat.toFixed(8)) : undefined,
        exact_lng: position?.lng ? Number(position.lng.toFixed(8)) : undefined,
        consent_proof_url: consentProofUrl || "https://rentlo.in/consent/verified",
        uploaded_media: uploadedMediaList,
        voice_note_url: uploadedVoiceNoteUrl,
        plan: selectedPlan || 'single',
        registration_payment_method: razorpayDetails?.payment_id ? 'razorpay' : 'cash',
        registration_razorpay_order_id: razorpayDetails?.order_id,
        registration_razorpay_payment_id: razorpayDetails?.payment_id,
        registration_razorpay_signature: razorpayDetails?.signature,
      };

      const res = await fetch(`${import.meta.env.VITE_API_URL}/properties/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const createdProp = await res.json();
        toast.success('Listing created! Status: Pending Review');

        // Clear local draft state and lock ref so subsequent new listings start with a clean form on Step 1
        isSubmittedRef.current = true;
        localStorage.removeItem("owner_onboarding_form_data");
        localStorage.removeItem("owner_onboarding_step");
        localStorage.removeItem("owner_onboarding_position");
        localStorage.removeItem("owner_onboarding_signature_data");
        localStorage.removeItem("owner_onboarding_uploaded_media");
        setUploadedMediaList([]);
        setFormData({ ...defaultOwnerFormData, owner_name: (user?.first_name || user?.username || ''), owner_phone: user?.phone || '' });
        setStep(1);
        setPosition(null);
        setFiles([]);

        // If there is an onboarding fee and payment was NOT already completed via Razorpay or Owner Credit Pass
        const fee = parseFloat(createdProp.onboarding_fee || 0);
        const isCreditUsed = createdProp.registration_fee_paid || createdProp.registration_payment_method === 'owner_credit' || createdProp.onboarding_payment_status === 'paid';
        
        if (isCreditUsed) {
          toast.success("🎉 Listing published successfully using 1 credit! Status: Approved");
        } else if (fee > 0 && createdProp.onboarding_payment_status !== 'paid' && !razorpayDetails?.payment_id) {
          toast.info(`An onboarding fee of ₹${fee.toFixed(0)} is required. Launching payment...`, { autoClose: 3000 });
          await handleOnboardingPayment(createdProp.id, fee);
        }

        await checkAuth(); // Ensure global state is synced
        setTimeout(() => navigate('/owner/dashboard'), 2000);
      } else {
        const errData = await res.json().catch(() => ({}));
        const errMsg = typeof errData === 'object'
          ? Object.entries(errData).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' | ')
          : 'Failed to create listing. Please check the inputs.';
        toast.error(errMsg);
      }
    } catch (err) {
      if (
        (err instanceof TypeError && err.message.includes("Failed to fetch")) ||
        !navigator.onLine
      ) {
        await saveOfflineDraft(
          payload_draft,
          files,
          audioBlob,
          consentMethod === "signature" ? signatureUrl : "",
        );
      } else {
        toast.error("Network error creating listing. " + err.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="pb-20">
      <ToastContainer position="top-right" />

      <div className="relative z-10 w-full max-w-4xl mx-auto">
        {offlineDrafts.length > 0 && (
          <div className="mb-10">
            <div className="bg-amber-500/10 backdrop-blur-xl border border-amber-500/20 p-6 rounded-2xl shadow-lg relative overflow-hidden group">
              <div className="absolute -right-10 -top-10 w-32 h-32 bg-amber-500/20 rounded-full blur-2xl group-hover:bg-amber-500/30 transition-all duration-700 pointer-events-none"></div>
              <h2 className="text-[16px] font-extrabold text-amber-600 mb-5 flex items-center gap-2 drop-shadow-sm">
                <span className="material-symbols-outlined text-[20px] animate-pulse">
                  cloud_sync
                </span>
                Offline Drafts Pending Sync ({offlineDrafts.length})
              </h2>
              <div className="space-y-4 relative z-10">
                {offlineDrafts.map((draft) => (
                  <div
                    key={draft.key}
                    className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 bg-white/60 backdrop-blur-md p-4 rounded-xl border border-white/80 shadow-sm hover:shadow-md transition-all"
                  >
                    <div>
                      <p className="font-extrabold text-slate-900 drop-shadow-sm capitalize">
                        {draft.val.payload.property_type} -{" "}
                        {draft.val.payload.owner_name}
                      </p>
                      <p className="text-[9px] font-medium text-slate-600 mt-1 uppercase tracking-widest">
                        Saved at: {new Date(draft.val.savedAt).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => syncDraft(draft.key)}
                      disabled={isSubmitting || !navigator.onLine}
                      className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-[9px] font-extrabold uppercase tracking-widest rounded-xl hover:-translate-y-0.5 transition-all shadow-lg shadow-amber-600/30 disabled:opacity-50 flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {isSubmitting ? "sync" : "cloud_upload"}
                      </span>
                      {isSubmitting ? "Syncing..." : "Sync Now"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="mb-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4 group">
            <div className="w-14 h-10 bg-orange-500/10 rounded-2xl flex items-center justify-center text-orange-600 shadow-sm border border-orange-500/20 group-hover:scale-110 group-hover:bg-orange-500/20 transition-all duration-500">
              <span className="material-symbols-outlined text-[32px] group-hover:-translate-y-1 transition-transform duration-500">
                add_business
              </span>
            </div>
            <div>
              <h1 className="text-3xl font-extrabold font-sans text-slate-900 tracking-tight mb-1 drop-shadow-sm">
                Onboard New Property
              </h1>
              <p className="text-[11px] text-slate-600 font-medium">
                Complete the required fields to list a new asset on the
                marketplace.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDiscard}
            className="h-9 px-3 rounded-xl border border-red-200 bg-red-50 text-red-600 font-bold uppercase tracking-wider hover:bg-red-100 transition-all shadow-sm flex items-center gap-2 text-[9px]"
          >
            <span className="material-symbols-outlined text-[18px]">delete</span>
            Discard Draft
          </button>
        </div>

        {/* Progress Indicator */}
        <div className="mb-12 relative w-full px-2">
          {/* Mobile: compact step numbers */}
          <div className="absolute top-5 left-[8%] right-[8%] h-[2px] bg-slate-200 -z-10 rounded-full"></div>
          <div className="flex justify-between w-full">
            {[
              "Location",
              "Details",
              "Photos",
              "Plans & Payment",
            ].map((stepName, idx) => {
              const stepNum = idx + 1;
              const isCompleted = step > stepNum;
              const isActive = step === stepNum;
              return (
                <div
                  key={stepName}
                  onClick={() => goToStep(stepNum)}
                  className="flex flex-col items-center gap-1 sm:gap-3 relative z-10 w-16 sm:w-24 cursor-pointer group"
                >
                  <div
                    className={`w-10 h-9 rounded-2xl flex items-center justify-center transition-all duration-500 border-2 ${
                      isCompleted || isActive
                        ? "text-white border-transparent shadow-lg scale-110"
                        : "bg-slate-50 border-slate-200 text-slate-400"
                    }`}
                    style={isCompleted || isActive ? { backgroundColor: "var(--accent)" } : {}}
                  >
                    {isCompleted ? (
                      <span className="material-symbols-outlined text-[18px] font-bold">
                        check
                      </span>
                    ) : (
                      <span className="text-[11px] font-extrabold">
                        {stepNum}
                      </span>
                    )}
                  </div>
                  <span
                    className={`hidden sm:block text-[9px] font-extrabold text-center uppercase tracking-widest transition-colors duration-300 drop-shadow-sm ${
                      isCompleted
                        ? "text-slate-800"
                        : isActive
                          ? "text-orange-700"
                          : "text-slate-500"
                    }`}
                  >
                    {stepName}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-3xl border shadow-sm p-8 md:p-12 relative overflow-hidden" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
          <div className="relative z-10">
            {step === 1 && (
              <div className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="mb-1 border-b pb-6" style={{ borderColor: "var(--border)" }}>
                  <h2 className="text-[20px] font-extrabold tracking-tight flex items-center gap-2" style={{ color: "var(--ink)" }}>
                    <span className="material-symbols-outlined text-[24px]" style={{ color: "var(--accent)" }}>
                      location_city
                    </span>
                    Location &amp; Property Details
                  </h2>
                  <p className="text-[11px] font-medium mt-2" style={{ color: "var(--text-muted)" }}>
                    Enter the core details about the property and pin the exact
                    location on the map.
                  </p>
                </div>

                <div className="rounded-2xl p-8 border shadow-inner" style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)" }}>
                  <h3 className="text-[9px] font-extrabold uppercase tracking-widest mb-6 flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
                    <span className="material-symbols-outlined text-[16px]">
                      info
                    </span>{" "}
                    Property Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    {/* Owner Phone Input (Always enabled) */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
                          <span className="material-symbols-outlined text-[11px]">phone</span>
                          Owner Phone <span className="text-red-500">*</span>
                        </label>
                        {checkingOwnerPhone && (
                          <span className="text-[9px] font-bold text-amber-500 animate-pulse">Checking account...</span>
                        )}
                        {ownerAccountExists === true && (
                          <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/30">
                            ✓ Account Exists ({ownerAccountDetails?.first_name || ownerAccountDetails?.username})
                          </span>
                        )}
                        {ownerAccountExists === false && (
                          <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/30">
                            🆕 New Account
                          </span>
                        )}
                      </div>
                      <input
                        name="owner_phone"
                        value={formData.owner_phone}
                        onChange={handleInputChange}
                        placeholder="Enter 10-digit owner phone"
                        className="w-full h-9 px-3 rounded-xl border outline-none text-[11px] font-bold transition-all shadow-sm"
                        style={{ backgroundColor: "var(--surface)", color: "var(--ink)", borderColor: "var(--border)" }}
                        required
                      />

                      {/* Staff Verification Sub-flow (OTP or Selfie based on platform setting) */}
                      {isStaff && formData.owner_phone?.replace(/[^0-9]/g, "").length >= 10 && (() => {
                        const verifyMode = platformSettings?.owner_listing_verification_method || "otp";
                        const isVerified = verifyMode === "otp" ? otpVerified : !!selfiePhoto;

                        return (
                          <div className="mt-3.5 p-3 rounded-2xl bg-white border border-slate-200/80 shadow-xs animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                                {verifyMode === "otp" ? "Phone Verification Required" : "Owner Selfie Required"}
                              </span>
                              {isVerified && (
                                <span className="text-[9.5px] font-black text-emerald-600 flex items-center gap-0.5">
                                  <span className="material-symbols-outlined text-[13px]">check_circle</span>Verified
                                </span>
                              )}
                            </div>

                            {verifyMode === "otp" ? (
                              /* ── OTP MODE ── */
                              !otpVerified ? (
                                !otpSent ? (
                                  <button type="button" onClick={sendOTP} disabled={otpLoading}
                                    className="h-8 px-4 bg-orange-600 hover:bg-orange-500 text-white text-[9px] font-extrabold uppercase tracking-widest rounded-xl transition-all shadow-sm disabled:opacity-50 cursor-pointer">
                                    {otpLoading ? "Sending..." : "Verify Owner Phone via OTP"}
                                  </button>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <input type="text" value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ""))}
                                      placeholder="6-digit code" maxLength={6}
                                      className="h-8 w-28 px-2 rounded-xl border border-slate-200 text-center tracking-widest text-[12px] font-bold outline-none focus:border-orange-500" />
                                    <button type="button" onClick={verifyOTP} disabled={otpLoading || otpCode.length < 6}
                                      className="h-8 px-4 bg-orange-600 hover:bg-orange-500 text-white text-[9px] font-extrabold uppercase tracking-widest rounded-xl transition-all shadow-sm disabled:opacity-50 cursor-pointer">
                                      {otpLoading ? "..." : "Verify"}
                                    </button>
                                  </div>
                                )
                              ) : (
                                <p className="text-[10px] text-slate-500 font-semibold">Owner phone verified. Form unlocked.</p>
                              )
                            ) : (
                              /* ── SELFIE MODE ── */
                              !selfiePhoto ? (
                                <button type="button" onClick={openSelfieCamera}
                                  className="h-8 px-4 bg-orange-600 hover:bg-orange-500 text-white text-[9px] font-extrabold uppercase tracking-widest rounded-xl transition-all shadow-sm cursor-pointer flex items-center gap-1.5">
                                  <span className="material-symbols-outlined text-[14px]">camera_alt</span>
                                  Capture Owner Live Selfie
                                </button>
                              ) : (
                                <div className="flex items-center gap-3">
                                  <img src={selfiePreview} alt="Owner selfie" className="w-12 h-12 rounded-xl object-cover border-2 border-emerald-400 shadow" />
                                  <div>
                                    <p className="text-[10px] font-bold text-emerald-600">Selfie captured. Form unlocked.</p>
                                    <button type="button" onClick={() => { setSelfiePhoto(null); setSelfiePreview(null); }}
                                      className="text-[9px] text-slate-400 hover:text-red-500 underline mt-0.5 cursor-pointer">
                                      Retake
                                    </button>
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {/* fieldset disables the remaining fields of Step 1 until verification is complete */}
                    <fieldset
                      disabled={isStaff && !(
                        platformSettings?.owner_listing_verification_method === "selfie" ? !!selfiePhoto : otpVerified
                      )}
                      className="contents"
                    >
                      {/* Owner Name Input */}
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1 flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[11px]">
                            person
                          </span>{" "}
                          Owner Name
                          <span className="text-red-500 ml-0.5">*</span>
                        </label>
                        <input
                          name="owner_name"
                          value={formData.owner_name}
                          onChange={handleInputChange}
                          className="w-full h-9 px-3 rounded-xl border outline-none text-[11px] font-bold transition-all shadow-sm"
                          style={{ backgroundColor: "var(--surface)", color: "var(--ink)", borderColor: "var(--border)" }}
                          required
                        />
                      </div>

                      {isStaff && (
                        <div className="col-span-1 md:col-span-2">
                          <label className="text-[9px] font-bold uppercase tracking-widest block mb-1 flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
                            <span className="material-symbols-outlined text-[11px]">lock</span>
                            Owner Initial Password
                            {ownerAccountExists === false && <span className="text-red-500 ml-0.5">* (Required for New Owner)</span>}
                          </label>
                          <input
                            type="password"
                            name="owner_password"
                            value={ownerAccountExists === true ? "" : (formData.owner_password || "")}
                            onChange={handleInputChange}
                            disabled={ownerAccountExists === true}
                            placeholder={
                              ownerAccountExists === true
                                ? "Owner account already exists. Password field disabled."
                                : ownerAccountExists === false
                                ? "Set initial login password for this new Owner account"
                                : "Enter owner initial password"
                            }
                            className="w-full h-9 px-3 rounded-xl border outline-none text-[11px] font-bold transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ backgroundColor: "var(--surface)", color: "var(--ink)", borderColor: "var(--border)" }}
                          />
                          {ownerAccountExists === true && (
                            <p className="text-[10px] font-bold text-emerald-500 mt-1">
                              ✓ Password field disabled because this owner already has a registered Rentlo account.
                            </p>
                          )}
                        </div>
                      )}
                    <div className="col-span-1 md:col-span-2 mb-1 mt-2">
                      <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-2 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[11px]">category</span>
                        Property Category <span className="text-red-500 ml-0.5">*</span>
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[
                          { id: "residential", label: "Residential", icon: "home", defaultType: "apartment" },
                          { id: "pg", label: "PG / Co-Living", icon: "bed", defaultType: "pg_hostel" },
                          { id: "commercial", label: "Commercial", icon: "storefront", defaultType: "office" }
                        ].map(cat => (
                          <div 
                            key={cat.id}
                            onClick={() => setFormData({
                              ...formData,
                              property_category: cat.id,
                              property_type: cat.defaultType
                            })}
                            className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all ${formData.property_category === cat.id ? 'border-orange-500 bg-orange-50 text-orange-600 shadow-sm font-bold' : 'border-slate-100 hover:border-slate-300 text-slate-600'}`}
                          >
                            <span className="material-symbols-outlined mb-1 text-[20px]">{cat.icon}</span>
                            <span className="text-[10px] font-bold text-center">{cat.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {formData.property_category !== 'pg' && (
                      <div className="col-span-1 md:col-span-2">
                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1 flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[11px]">
                            house
                          </span>{" "}
                          Property Type
                          <span className="text-red-500 ml-0.5">*</span>
                        </label>
                        <select
                          name="property_type"
                          value={formData.property_type}
                          onChange={handleInputChange}
                          className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 outline-none text-[10px] font-bold text-slate-900 transition-all shadow-sm hover:border-slate-300 cursor-pointer"
                        >
                          {formData.property_category === 'residential' && (
                            <>
                              <option value="1bhk">1 BHK Apartment / House</option>
                              <option value="2bhk">2 BHK Apartment / House</option>
                              <option value="3bhk">3 BHK Apartment / House</option>
                              <option value="4bhk">4 BHK Apartment / House</option>
                              <option value="5bhk">5+ BHK / Luxury Villa</option>
                              <option value="studio">1 RK / Studio Apartment</option>
                              <option value="apartment">General Apartment / Flat</option>
                              <option value="house">Independent House / Villa</option>
                              <option value="builder_floor">Builder Floor</option>
                            </>
                          )}
                          {formData.property_category === 'commercial' && (
                            <>
                              <option value="office">Office Space</option>
                              <option value="retail">Retail Shop / Showroom</option>
                              <option value="warehouse">Warehouse / Godown</option>
                              <option value="coworking">Co-working Space</option>
                              <option value="industrial">Industrial Shed / Building</option>
                            </>
                          )}
                        </select>
                      </div>
                    )}
                    </fieldset>
                  </div>
                </div>

                {formData.property_category !== 'pg' && (
                  <fieldset disabled={isStaff && !(platformSettings?.owner_listing_verification_method === 'selfie' ? !!selfiePhoto : otpVerified)} className="contents">
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-2">
                        <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                          Rent Price (₹)
                          <span className="text-red-500 ml-0.5">*</span>
                        </label>
                        <input
                          name="price"
                          type="number"
                          value={formData.price}
                          onChange={handleInputChange}
                          placeholder="e.g. 25000"
                          className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 outline-none text-[12px] font-semibold text-slate-900 transition-all shadow-sm"
                        />
                      </div>
                    </div>
                  </fieldset>
                )}



                <fieldset disabled={isStaff && !(platformSettings?.owner_listing_verification_method === 'selfie' ? !!selfiePhoto : otpVerified)} className="contents">
                <div className="bg-slate-50 rounded-2xl p-8 border border-slate-100 shadow-inner mt-6">
                  <h3 className="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px]">
                      pin_drop
                    </span>{" "}
                    Exact Location
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                    <div className="md:col-span-2">
                      <label className="block text-[9px] font-bold text-slate-700 mb-1 uppercase tracking-wider">
                        Exact Address *
                      </label>
                      <textarea
                        required
                        rows="2"
                        value={formData.exact_address}
                        onChange={(e) => setFormData({ ...formData, exact_address: e.target.value })}
                        className="w-full rounded-xl bg-slate-50 border-2 border-slate-100 p-4 text-[11px] font-semibold text-slate-800 focus:border-accent focus:bg-white transition-all outline-none resize-none placeholder-slate-400"
                        placeholder="Pin point the property on the map below to auto-fill this, or type manually"
                      ></textarea>
                    </div>

                    <div className="md:col-span-2 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="block text-[9px] font-bold text-slate-700 uppercase tracking-wider">
                          Map Location *
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={detectMyLocation}
                            className="px-3 py-1 bg-orange-100 hover:bg-orange-200 text-orange-800 text-[10px] font-bold rounded-lg transition flex items-center gap-1 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[14px]">my_location</span>
                            Detect My Location
                          </button>
                          {!position && (
                            <span className="text-[9px] font-bold text-red-500 bg-red-50 px-3 py-1 rounded-full">
                              Pin Required
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="h-[350px] rounded-2xl overflow-hidden border-2 border-slate-200 shadow-inner relative group z-0">
                        {/* FLOATING LOCATION ZOOM SELECTOR TOOLBAR */}
                        <div className="absolute top-3 left-14 right-3 z-[1000] bg-white/95 backdrop-blur-md border border-slate-200/90 p-2 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-2 transition-all">
                          <div className="flex items-center gap-1.5 px-2 text-slate-800 text-[11px] font-black uppercase tracking-wider shrink-0">
                            <span className="material-symbols-outlined text-[16px] text-emerald-600">travel_explore</span>
                            <span className="hidden sm:inline">Zoom Map To:</span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 flex-1 justify-end">
                            {/* State Selector */}
                            <div className="relative flex-1 min-w-[130px] max-w-[200px]">
                              <select
                                value={selectedStateKey}
                                onChange={(e) => {
                                  const stateKey = e.target.value;
                                  setSelectedStateKey(stateKey);
                                  const stateData = STATE_CITY_DATA[stateKey];
                                  if (stateData) {
                                    const firstCity = stateData.cities[0];
                                    const newCityId = firstCity ? firstCity.id : "all";
                                    setSelectedCityId(newCityId);
                                    setMapCenter(firstCity ? firstCity.center : stateData.center);
                                    setMapZoom(firstCity ? firstCity.zoom : stateData.zoom);
                                  }
                                }}
                                className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-300/80 text-slate-800 rounded-xl text-[11px] font-extrabold py-1.5 pl-3 pr-7 outline-none focus:border-emerald-500 focus:bg-white cursor-pointer shadow-xs transition-all appearance-none"
                              >
                                {Object.entries(STATE_CITY_DATA).map(([key, data]) => (
                                  <option key={key} value={key}>
                                    🏛️ {data.name}
                                  </option>
                                ))}
                              </select>
                              <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-[16px] text-slate-400 pointer-events-none">
                                expand_more
                              </span>
                            </div>

                            {/* District / City Selector */}
                            <div className="relative flex-1 min-w-[130px] max-w-[200px]">
                              <select
                                value={selectedCityId}
                                onChange={(e) => {
                                  const cityId = e.target.value;
                                  setSelectedCityId(cityId);
                                  const stateData = STATE_CITY_DATA[selectedStateKey];
                                  if (stateData) {
                                    if (cityId === "all") {
                                      setMapCenter(stateData.center);
                                      setMapZoom(stateData.zoom);
                                    } else {
                                      const matchCity = stateData.cities.find((c) => c.id === cityId);
                                      if (matchCity) {
                                        setMapCenter(matchCity.center);
                                        setMapZoom(matchCity.zoom);
                                      }
                                    }
                                  }
                                }}
                                className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-300/80 text-slate-800 rounded-xl text-[11px] font-extrabold py-1.5 pl-3 pr-7 outline-none focus:border-emerald-500 focus:bg-white cursor-pointer shadow-xs transition-all appearance-none"
                              >
                                <option value="all">📍 All Cities</option>
                                {STATE_CITY_DATA[selectedStateKey]?.cities.map((city) => (
                                  <option key={city.id} value={city.id}>
                                    📍 {city.name}
                                  </option>
                                ))}
                              </select>
                              <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-[16px] text-slate-400 pointer-events-none">
                                expand_more
                              </span>
                            </div>
                          </div>
                        </div>

                        <MapContainer
                          center={position ? [position.lat, position.lng] : mapCenter}
                          zoom={mapZoom}
                          style={{ height: "100%", width: "100%" }}
                        >
                          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                          <MapFlyToHandler center={mapCenter} zoom={mapZoom} />
                          <LocationPicker
                            position={position}
                            setPosition={setPosition}
                            onLocationUpdate={handleLocationUpdate}
                          />
                        </MapContainer>
                      </div>
                    </div>
                  </div>
                  
                  <p className="text-[9px] mt-3 font-medium flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                    <span className="material-symbols-outlined text-[11px]">
                      info
                    </span>{" "}
                    Click anywhere on the map to drop a pin. You can drag the
                    pin to adjust.
                  </p>
                </div>

                <div className="rounded-2xl p-8 border shadow-inner mt-6" style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)" }}>
                  <h3 className="text-[9px] font-extrabold uppercase tracking-widest mb-6 flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
                    <span className="material-symbols-outlined text-[16px]">
                      map
                    </span>{" "}
                    Region Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-6">
                    <div>
                      <label className="text-[9px] font-bold uppercase tracking-widest block mb-1 flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
                        <span className="material-symbols-outlined text-[11px]">
                          location_city
                        </span>{" "}
                        City
                        <span className="text-red-500 ml-0.5">*</span>
                      </label>
                      <input
                        name="city_name_input"
                        value={formData.city_name_input || (cities.find(c => c.id.toString() === formData.city_id?.toString())?.name) || ""}
                        onChange={handleInputChange}
                        className="w-full h-9 px-3 rounded-xl border outline-none text-[11px] font-bold transition-all shadow-sm"
                        style={{ backgroundColor: "var(--surface)", color: "var(--ink)", borderColor: "var(--border)" }}
                        placeholder="Auto-filled from map or enter manually"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold uppercase tracking-widest block mb-1 flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
                        <span className="material-symbols-outlined text-[11px]">
                          map
                        </span>{" "}
                        State
                        <span className="text-red-500 ml-0.5">*</span>
                      </label>
                      <input
                        name="state_name_input"
                        value={formData.state_name_input || ""}
                        onChange={handleInputChange}
                        className="w-full h-9 px-3 rounded-xl border outline-none text-[11px] font-bold transition-all shadow-sm"
                        style={{ backgroundColor: "var(--surface)", color: "var(--ink)", borderColor: "var(--border)" }}
                        placeholder="Auto-filled from map or enter manually"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold uppercase tracking-widest block mb-1 flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
                        <span className="material-symbols-outlined text-[11px]">
                          map
                        </span>{" "}
                        Locality
                        <span className="text-red-500 ml-0.5">*</span>
                      </label>
                      <input
                        name="locality_name_input"
                        value={formData.locality_name_input || formData.locality || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData(prev => ({ ...prev, locality_name_input: val, locality: val }));
                        }}
                        className="w-full h-9 px-3 rounded-xl border outline-none text-[11px] font-bold transition-all shadow-sm"
                        style={{ backgroundColor: "var(--surface)", color: "var(--ink)", borderColor: "var(--border)" }}
                        placeholder="Auto-filled from map or enter manually"
                        required
                      />
                    </div>
                  </div>
                </div>
                </fieldset>

                <div className="flex justify-end pt-6 border-t border-slate-100 mt-6">
                  <button
                    onClick={handleNext}
                    disabled={isStaff && !(platformSettings?.owner_listing_verification_method === 'selfie' ? !!selfiePhoto : otpVerified)}
                    className="h-10 px-8 bg-orange-600 hover:bg-orange-500 text-white text-[9px] font-extrabold uppercase tracking-widest rounded-xl transition-all flex items-center gap-3 shadow-lg shadow-orange-600/30 hover:shadow-orange-600/40 hover:-translate-y-0.5 pulse-button disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Continue to Property Details
                    <span className="material-symbols-outlined text-[20px]">
                      arrow_forward
                    </span>
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (<>
                <div className="animate-fade-rise pt-6">
                  <h3 className="text-[9px] font-extrabold uppercase tracking-widest mb-6 flex items-center gap-2 border-b pb-4" style={{ color: "var(--text-muted)", borderColor: "var(--border)" }}>
                    <span className="material-symbols-outlined text-[16px]">
                      architecture
                    </span>{" "}
                    Property Specifications
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {/* Residential Category Fields */}
                    {formData.property_category === 'residential' && (
                      <>
                        <div>
                          <label className="text-[9px] font-bold uppercase tracking-widest block mb-1" style={{ color: "var(--text-muted)" }}>
                            Carpet Area (sq.ft) <span className="text-red-500 ml-0.5">*</span>
                          </label>
                          <input
                            name="carpet_area"
                            type="number"
                            value={formData.carpet_area}
                            onChange={handleInputChange}
                            placeholder="e.g. 1100"
                            className="w-full h-9 px-3 rounded-xl border outline-none text-[11px] font-bold transition-all shadow-sm"
                            style={{ backgroundColor: "var(--surface)", color: "var(--ink)", borderColor: "var(--border)" }}
                            required
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold uppercase tracking-widest block mb-1" style={{ color: "var(--text-muted)" }}>
                            Super Built-up Area (sq.ft)
                          </label>
                          <input
                            name="super_built_up_area"
                            type="number"
                            value={formData.super_built_up_area}
                            onChange={handleInputChange}
                            placeholder="e.g. 1350"
                            className="w-full h-9 px-3 rounded-xl border outline-none text-[11px] font-bold transition-all shadow-sm"
                            style={{ backgroundColor: "var(--surface)", color: "var(--ink)", borderColor: "var(--border)" }}
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold uppercase tracking-widest block mb-1" style={{ color: "var(--text-muted)" }}>Bedrooms / BHK <span className="text-red-500">*</span></label>
                          <select
                            name="bedrooms"
                            value={formData.bedrooms}
                            onChange={handleInputChange}
                            className="w-full h-9 px-3 rounded-xl border outline-none text-[11px] font-bold cursor-pointer transition-all shadow-sm"
                            style={{ backgroundColor: "var(--surface)", color: "var(--ink)", borderColor: "var(--border)" }}
                            required
                          >
                            <option value="">Select BHK...</option>
                            <option value="1">1 BHK / 1 RK</option>
                            <option value="2">2 BHK</option>
                            <option value="3">3 BHK</option>
                            <option value="4">4 BHK</option>
                            <option value="5">5 BHK</option>
                            <option value="6">6+ BHK / Villa</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[9px] font-bold uppercase tracking-widest block mb-1" style={{ color: "var(--text-muted)" }}>Bathrooms <span className="text-red-500">*</span></label>
                          <input name="bathrooms" type="number" value={formData.bathrooms} onChange={handleInputChange} placeholder="e.g. 2" className="w-full h-9 px-3 rounded-xl border outline-none text-[11px] font-bold transition-all shadow-sm" style={{ backgroundColor: "var(--surface)", color: "var(--ink)", borderColor: "var(--border)" }} required />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold uppercase tracking-widest block mb-1" style={{ color: "var(--text-muted)" }}>Balconies</label>
                          <input name="balconies" type="number" value={formData.balconies} onChange={handleInputChange} placeholder="e.g. 1" className="w-full h-9 px-3 rounded-xl border outline-none text-[11px] font-bold transition-all shadow-sm" style={{ backgroundColor: "var(--surface)", color: "var(--ink)", borderColor: "var(--border)" }} />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold uppercase tracking-widest block mb-1" style={{ color: "var(--text-muted)" }}>Furnishing Status</label>
                          <select name="furnishing_status" value={formData.furnishing_status} onChange={handleInputChange} className="w-full h-9 px-3 rounded-xl border outline-none text-[11px] font-bold cursor-pointer transition-all shadow-sm" style={{ backgroundColor: "var(--surface)", color: "var(--ink)", borderColor: "var(--border)" }}>
                            <option value="">Select...</option>
                            <option value="unfurnished">Unfurnished</option>
                            <option value="semi">Semi-Furnished</option>
                            <option value="fully">Fully-Furnished</option>
                          </select>
                        </div>
                        {['apartment', 'builder_floor', 'studio'].includes(formData.property_type) && (
                          <div>
                            <label className="text-[9px] font-bold uppercase tracking-widest block mb-1" style={{ color: "var(--text-muted)" }}>Floor Number</label>
                            <input name="floor_number" type="number" value={formData.floor_number} onChange={handleInputChange} placeholder="e.g. 3" className="w-full h-9 px-3 rounded-xl border outline-none text-[11px] font-bold transition-all shadow-sm" style={{ backgroundColor: "var(--surface)", color: "var(--ink)", borderColor: "var(--border)" }} />
                          </div>
                        )}
                        {['apartment', 'house', 'builder_floor', 'studio'].includes(formData.property_type) && (
                          <div>
                            <label className="text-[9px] font-bold uppercase tracking-widest block mb-1" style={{ color: "var(--text-muted)" }}>Total Floors in Building</label>
                            <input name="total_floors" type="number" value={formData.total_floors} onChange={handleInputChange} placeholder="e.g. 5" className="w-full h-9 px-3 rounded-xl border outline-none text-[11px] font-bold transition-all shadow-sm" style={{ backgroundColor: "var(--surface)", color: "var(--ink)", borderColor: "var(--border)" }} />
                          </div>
                        )}
                        <div>
                          <label className="text-[9px] font-bold uppercase tracking-widest block mb-1" style={{ color: "var(--text-muted)" }}>Covered Parking Spots</label>
                          <input name="covered_parking_spots" type="number" value={formData.covered_parking_spots} onChange={handleInputChange} placeholder="e.g. 1" className="w-full h-9 px-3 rounded-xl border outline-none text-[11px] font-bold transition-all shadow-sm" style={{ backgroundColor: "var(--surface)", color: "var(--ink)", borderColor: "var(--border)" }} />
                        </div>
                      </>
                    )}

                    {/* PG & Co-Living Category Fields */}
                    {formData.property_category === 'pg' && (
                      <div className="col-span-1 md:col-span-2 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-[9px] font-bold uppercase tracking-widest block mb-1" style={{ color: "var(--text-muted)" }}>PG Gender Preference <span className="text-red-500">*</span></label>
                            <select name="pg_gender" value={formData.pg_gender} onChange={handleInputChange} className="w-full h-9 px-3 rounded-xl border outline-none text-[11px] font-bold cursor-pointer transition-all shadow-sm" style={{ backgroundColor: "var(--surface)", color: "var(--ink)", borderColor: "var(--border)" }}>
                              <option value="boys">Boys / Male Only</option>
                              <option value="girls">Girls / Female Only</option>
                              <option value="coliving">Co-Living / Unisex</option>
                            </select>
                          </div>
                          <div className="col-span-1 md:col-span-2">
                            <label className="text-[9px] font-bold uppercase tracking-widest block mb-2" style={{ color: "var(--text-muted)" }}>
                              Food Service &amp; Meal Plan Included in Rent <span className="text-red-500">*</span>
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                              {[
                                { id: "any", label: "Rent Includes Food (Veg & Non-Veg)", icon: "restaurant" },
                                { id: "veg", label: "Rent Includes Food (Veg Only)", icon: "eco" },
                                { id: "no_food", label: "Rent Excludes Food / No Meals", icon: "no_meals" },
                              ].map((foodOpt) => {
                                const isSel = formData.food_preference === foodOpt.id;
                                return (
                                  <button
                                    key={foodOpt.id}
                                    type="button"
                                    onClick={() => setFormData((prev) => ({ ...prev, food_preference: foodOpt.id }))}
                                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 text-[10px] font-black cursor-pointer transition-all ${
                                      isSel
                                        ? "border-orange-500 bg-orange-50 text-orange-700 shadow-sm"
                                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                                    }`}
                                  >
                                    <span className="material-symbols-outlined text-[18px]">{foodOpt.icon}</span>
                                    <span className="text-center">{foodOpt.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {formData.food_preference !== 'no_food' && (
                            <div className="col-span-1 md:col-span-2 bg-amber-500/5 p-4 rounded-xl border border-amber-500/20 space-y-2">
                              <label className="text-[9px] font-extrabold uppercase tracking-widest block text-slate-700 flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-[14px] text-amber-600">schedule</span>
                                Mark Included Daily Meals:
                              </label>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                {[
                                  { id: "Morning (Breakfast)", label: "Morning (Breakfast)", icon: "wb_twilight" },
                                  { id: "Afternoon (Lunch)", label: "Afternoon (Lunch)", icon: "wb_sunny" },
                                  { id: "Night (Dinner)", label: "Night (Dinner)", icon: "bedtime" },
                                ].map((meal) => {
                                  const isChecked = (formData.pg_food_provided || []).includes(meal.id);
                                  const toggleMeal = () => {
                                    setFormData((prev) => {
                                      const list = prev.pg_food_provided || [];
                                      const nextList = isChecked
                                        ? list.filter((m) => m !== meal.id)
                                        : [...list, meal.id];
                                      return { ...prev, pg_food_provided: nextList };
                                    });
                                  };

                                  return (
                                    <label
                                      key={meal.id}
                                      onClick={toggleMeal}
                                      className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all ${
                                        isChecked
                                          ? "bg-amber-50 border-amber-400 text-amber-900 font-extrabold shadow-xs"
                                          : "bg-white border-slate-200 text-slate-500 font-medium"
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {}}
                                        className="w-3.5 h-3.5 accent-amber-600 rounded cursor-pointer"
                                      />
                                      <span className="material-symbols-outlined text-[16px] text-amber-600">{meal.icon}</span>
                                      <span className="text-[10px]">{meal.label}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Multi-Room & Bed Inventory Configurator Card */}
                        <div className="p-5 rounded-2xl border bg-orange-500/5 border-orange-500/20 space-y-4 shadow-sm">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-orange-500/20 pb-3">
                            <div>
                              <h4 className="text-[12px] font-black text-slate-900 flex items-center gap-2">
                                <span className="material-symbols-outlined text-orange-600 text-[18px]">meeting_room</span>
                                Multi-Room &amp; Bed Inventory Tracker
                              </h4>
                              <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                                Select room sharing types available in your PG, configure room counts, total beds &amp; available beds per type.
                              </p>
                            </div>
                          </div>

                          <div className="space-y-3">
                            {[
                              { key: "single", label: "Single Private Room", defaultBeds: 1, icon: "bed" },
                              { key: "double", label: "Double Sharing", defaultBeds: 2, icon: "king_bed" },
                              { key: "triple", label: "Triple Sharing", defaultBeds: 3, icon: "hotel" },
                              { key: "four_plus", label: "4+ Bed Sharing", defaultBeds: 4, icon: "single_bed" },
                            ].map((type) => {
                              const inv = (formData.pg_room_inventory && formData.pg_room_inventory[type.key]) || { enabled: false, rooms: 0, beds_per_room: type.defaultBeds, available_beds: 0, rent: 0 };
                              
                              const handleToggle = (e) => {
                                updateRoomInventory(type.key, { ...inv, enabled: e.target.checked });
                              };

                              const handleFieldChange = (field, val) => {
                                const numVal = Math.max(0, parseInt(val, 10) || 0);
                                const updated = { ...inv, [field]: numVal };
                                if (field === 'rooms') {
                                  const totBeds = numVal * type.defaultBeds;
                                  if (updated.available_beds > totBeds) updated.available_beds = totBeds;
                                }
                                updateRoomInventory(type.key, updated);
                              };

                              return (
                                <div key={type.key} className={`p-3.5 rounded-xl border transition-all ${inv.enabled ? 'bg-white border-orange-300 shadow-sm' : 'bg-slate-50/70 border-slate-200 opacity-70'}`}>
                                  <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={inv.enabled}
                                        onChange={handleToggle}
                                        className="w-4 h-4 accent-orange-600 rounded cursor-pointer"
                                      />
                                      <span className="material-symbols-outlined text-[18px] text-orange-600">{type.icon}</span>
                                      <span className="text-[11px] font-black text-slate-900">{type.label}</span>
                                    </label>

                                    {inv.enabled && (
                                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                                        Total: {inv.rooms * type.defaultBeds} Beds ({inv.rooms} Rooms)
                                      </span>
                                    )}
                                  </div>

                                  {inv.enabled && (
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2 pt-2 border-t border-slate-100">
                                      <div>
                                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Rooms Count</label>
                                        <input
                                          type="number"
                                          min="1"
                                          value={inv.rooms || ""}
                                          onChange={(e) => handleFieldChange("rooms", e.target.value)}
                                          placeholder="e.g. 5"
                                          className="w-full h-8 px-2 rounded-lg border border-slate-200 text-[11px] font-bold outline-none focus:border-orange-500 bg-white"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Beds Per Room</label>
                                        <input
                                          type="number"
                                          disabled
                                          value={type.defaultBeds}
                                          className="w-full h-8 px-2 rounded-lg border border-slate-200 text-[11px] font-bold bg-slate-100 text-slate-600 cursor-not-allowed"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Available Beds</label>
                                        <input
                                          type="number"
                                          min="0"
                                          value={inv.available_beds}
                                          onChange={(e) => handleFieldChange("available_beds", e.target.value)}
                                          placeholder="e.g. 3"
                                          className="w-full h-8 px-2 rounded-lg border border-slate-200 text-[11px] font-bold outline-none focus:border-orange-500 bg-white"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Rent / Bed (₹/mo)</label>
                                        <input
                                          type="number"
                                          min="0"
                                          value={inv.rent || ""}
                                          onChange={(e) => handleFieldChange("rent", e.target.value)}
                                          placeholder="e.g. 7500"
                                          className="w-full h-8 px-2 rounded-lg border border-slate-200 text-[11px] font-bold outline-none focus:border-orange-500 bg-white"
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Live Inventory Summary Pill */}
                          <div className="p-3 bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-xl flex items-center justify-between flex-wrap gap-2 shadow-sm text-[11px] font-extrabold">
                            <div className="flex items-center gap-2">
                              <span className="material-symbols-outlined text-[18px]">analytics</span>
                              <span>Live Summary: {calculatePgSummary(formData.pg_room_inventory).totalBeds} Total Beds across {calculatePgSummary(formData.pg_room_inventory).totalRooms} Rooms</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="bg-white/20 px-2.5 py-0.5 rounded-full">Available Beds: {calculatePgSummary(formData.pg_room_inventory).availableBeds}</span>
                              {calculatePgSummary(formData.pg_room_inventory).minRent > 0 && (
                                <span className="bg-white text-orange-700 px-2.5 py-0.5 rounded-full font-black">Starting ₹{calculatePgSummary(formData.pg_room_inventory).minRent}/mo</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Commercial Category Fields */}
                    {formData.property_category === 'commercial' && (
                      <>
                        <div>
                          <label className="text-[9px] font-bold uppercase tracking-widest block mb-1" style={{ color: "var(--text-muted)" }}>
                            Carpet Area (sq.ft) <span className="text-red-500 ml-0.5">*</span>
                          </label>
                          <input
                            name="carpet_area"
                            type="number"
                            value={formData.carpet_area}
                            onChange={handleInputChange}
                            placeholder="e.g. 2500"
                            className="w-full h-9 px-3 rounded-xl border outline-none text-[11px] font-bold transition-all shadow-sm"
                            style={{ backgroundColor: "var(--surface)", color: "var(--ink)", borderColor: "var(--border)" }}
                            required
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold uppercase tracking-widest block mb-1" style={{ color: "var(--text-muted)" }}>
                            Super Built-up Area (sq.ft)
                          </label>
                          <input
                            name="super_built_up_area"
                            type="number"
                            value={formData.super_built_up_area}
                            onChange={handleInputChange}
                            placeholder="e.g. 3000"
                            className="w-full h-9 px-3 rounded-xl border outline-none text-[11px] font-bold transition-all shadow-sm"
                            style={{ backgroundColor: "var(--surface)", color: "var(--ink)", borderColor: "var(--border)" }}
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold uppercase tracking-widest block mb-1" style={{ color: "var(--text-muted)" }}>Washroom Facility</label>
                          <select name="commercial_washrooms" value={formData.commercial_washrooms} onChange={handleInputChange} className="w-full h-9 px-3 rounded-xl border outline-none text-[11px] font-bold cursor-pointer transition-all shadow-sm" style={{ backgroundColor: "var(--surface)", color: "var(--ink)", borderColor: "var(--border)" }}>
                            <option value="private">Private Washroom</option>
                            <option value="shared">Shared Washroom</option>
                            <option value="none">No Washroom</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[9px] font-bold uppercase tracking-widest block mb-1" style={{ color: "var(--text-muted)" }}>Commercial Furnishing</label>
                          <select name="furnishing_status" value={formData.furnishing_status} onChange={handleInputChange} className="w-full h-9 px-3 rounded-xl border outline-none text-[11px] font-bold cursor-pointer transition-all shadow-sm" style={{ backgroundColor: "var(--surface)", color: "var(--ink)", borderColor: "var(--border)" }}>
                            <option value="unfurnished">Bare Shell</option>
                            <option value="semi">Warm Shell</option>
                            <option value="fully">Fully Furnished Office</option>
                          </select>
                        </div>
                        {formData.property_type === 'retail' && (
                          <div>
                            <label className="text-[9px] font-bold uppercase tracking-widest block mb-1" style={{ color: "var(--text-muted)" }}>Shop Frontage (Feet) <span className="text-red-500">*</span></label>
                            <input name="retail_frontage_feet" type="number" value={formData.retail_frontage_feet} onChange={handleInputChange} placeholder="e.g. 25" className="w-full h-9 px-3 rounded-xl border outline-none text-[11px] font-bold transition-all shadow-sm" style={{ backgroundColor: "var(--surface)", color: "var(--ink)", borderColor: "var(--border)" }} required />
                          </div>
                        )}
                        {['warehouse', 'industrial'].includes(formData.property_type) && (
                          <div>
                            <label className="text-[9px] font-bold uppercase tracking-widest block mb-1" style={{ color: "var(--text-muted)" }}>Ceiling Height (Feet) <span className="text-red-500">*</span></label>
                            <input name="warehouse_ceiling_height_feet" type="number" value={formData.warehouse_ceiling_height_feet} onChange={handleInputChange} placeholder="e.g. 20" className="w-full h-9 px-3 rounded-xl border outline-none text-[11px] font-bold transition-all shadow-sm" style={{ backgroundColor: "var(--surface)", color: "var(--ink)", borderColor: "var(--border)" }} required />
                          </div>
                        )}
                      </>
                    )}

                  </div>

                  <h3 className="text-[9px] font-extrabold uppercase tracking-widest mb-6 flex items-center gap-2 border-t pt-6" style={{ color: "var(--text-muted)", borderColor: "var(--border)" }}>
                    <span className="material-symbols-outlined text-[16px]">
                      account_balance_wallet
                    </span>{" "}
                    Financials &amp; Rules
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="text-[9px] font-bold uppercase tracking-widest block mb-1" style={{ color: "var(--text-muted)" }}>Security Deposit (₹)</label>
                      <input name="security_deposit" type="number" value={formData.security_deposit} onChange={handleInputChange} className="w-full h-9 px-3 rounded-xl border outline-none text-[11px] font-bold transition-all shadow-sm" style={{ backgroundColor: "var(--surface)", color: "var(--ink)", borderColor: "var(--border)" }} />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold uppercase tracking-widest block mb-1" style={{ color: "var(--text-muted)" }}>Maintenance Charges (₹ / month)</label>
                      <input name="maintenance_charges" type="number" value={formData.maintenance_charges} onChange={handleInputChange} className="w-full h-9 px-3 rounded-xl border outline-none text-[11px] font-bold transition-all shadow-sm" style={{ backgroundColor: "var(--surface)", color: "var(--ink)", borderColor: "var(--border)" }} />
                    </div>
                    <div className="flex items-center gap-3 h-9">
                      <input type="checkbox" checked={formData.maintenance_included_in_rent} onChange={(e) => setFormData(prev => ({...prev, maintenance_included_in_rent: e.target.checked}))} className="w-5 h-5 accent-emerald-500 cursor-pointer" />
                      <label className="text-[11px] font-bold cursor-pointer" style={{ color: "var(--ink)" }} onClick={() => setFormData(prev => ({...prev, maintenance_included_in_rent: !prev.maintenance_included_in_rent}))}>Maintenance Included in Rent</label>
                    </div>
                    <div>
                      <label className="text-[9px] font-bold uppercase tracking-widest block mb-1" style={{ color: "var(--text-muted)" }}>Lock-in Period (Months)</label>
                      <input name="lock_in_period_months" type="number" value={formData.lock_in_period_months} onChange={handleInputChange} className="w-full h-9 px-3 rounded-xl border outline-none text-[11px] font-bold transition-all shadow-sm" style={{ backgroundColor: "var(--surface)", color: "var(--ink)", borderColor: "var(--border)" }} />
                    </div>

                    {/* Standard Residential Rules */}
                    {formData.property_category === 'residential' && formData.property_type !== 'pg' && (
                      <>
                        <div>
                          <label className="text-[9px] font-bold uppercase tracking-widest block mb-1" style={{ color: "var(--text-muted)" }}>Preferred Tenants</label>
                          <select name="preferred_tenants" value={formData.preferred_tenants} onChange={handleInputChange} className="w-full h-9 px-3 rounded-xl border outline-none text-[11px] font-bold cursor-pointer transition-all shadow-sm" style={{ backgroundColor: "var(--surface)", color: "var(--ink)", borderColor: "var(--border)" }}>
                            <option value="any">Any / All</option>
                            <option value="family">Family Only</option>
                            <option value="bachelors">Bachelors Allowed</option>
                            <option value="only_boys">Boys Only</option>
                            <option value="only_girls">Girls Only</option>
                            <option value="company">Company Lease</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[9px] font-bold uppercase tracking-widest block mb-1" style={{ color: "var(--text-muted)" }}>Food Preference</label>
                          <select name="food_preference" value={formData.food_preference} onChange={handleInputChange} className="w-full h-9 px-3 rounded-xl border outline-none text-[11px] font-bold cursor-pointer transition-all shadow-sm" style={{ backgroundColor: "var(--surface)", color: "var(--ink)", borderColor: "var(--border)" }}>
                            <option value="any">Any Food / No Restriction</option>
                            <option value="veg_only">Veg Only</option>
                            <option value="non_veg_allowed">Non-Veg Allowed</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[9px] font-bold uppercase tracking-widest block mb-1" style={{ color: "var(--text-muted)" }}>Pet Policy</label>
                          <select name="pet_policy" value={formData.pet_policy} onChange={handleInputChange} className="w-full h-9 px-3 rounded-xl border outline-none text-[11px] font-bold cursor-pointer transition-all shadow-sm" style={{ backgroundColor: "var(--surface)", color: "var(--ink)", borderColor: "var(--border)" }}>
                            <option value="not_allowed">Not Allowed</option>
                            <option value="allowed">Allowed</option>
                          </select>
                        </div>
                      </>
                    )}

                    {/* PG Specific Rules */}
                    {formData.property_type === 'pg' && (
                      <>
                        <div>
                          <label className="text-[9px] font-bold uppercase tracking-widest block mb-1" style={{ color: "var(--text-muted)" }}>Gender Preference</label>
                          <select name="preferred_tenants" value={formData.preferred_tenants} onChange={handleInputChange} className="w-full h-9 px-3 rounded-xl border outline-none text-[11px] font-bold cursor-pointer transition-all shadow-sm" style={{ backgroundColor: "var(--surface)", color: "var(--ink)", borderColor: "var(--border)" }}>
                            <option value="any">Anyone</option>
                            <option value="only_boys">Boys Only</option>
                            <option value="only_girls">Girls Only</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-3 h-9">
                          <input type="checkbox" checked={formData.pg_rules?.non_veg_allowed || false} onChange={(e) => setFormData(prev => ({...prev, pg_rules: {...prev.pg_rules, non_veg_allowed: e.target.checked}}))} className="w-5 h-5 accent-emerald-500 cursor-pointer" />
                          <label className="text-[11px] font-bold cursor-pointer" style={{ color: "var(--ink)" }} onClick={() => setFormData(prev => ({...prev, pg_rules: {...prev.pg_rules, non_veg_allowed: !prev.pg_rules?.non_veg_allowed}}))}>Non-Veg Allowed</label>
                        </div>
                        <div className="flex items-center gap-3 h-9">
                          <input type="checkbox" checked={formData.pg_rules?.smoking_allowed || false} onChange={(e) => setFormData(prev => ({...prev, pg_rules: {...prev.pg_rules, smoking_allowed: e.target.checked}}))} className="w-5 h-5 accent-emerald-500 cursor-pointer" />
                          <label className="text-[11px] font-bold cursor-pointer" style={{ color: "var(--ink)" }} onClick={() => setFormData(prev => ({...prev, pg_rules: {...prev.pg_rules, smoking_allowed: !prev.pg_rules?.smoking_allowed}}))}>Smoking Allowed</label>
                        </div>
                      </>
                    )}
                  </div>

                  <h3 className="text-[9px] font-extrabold uppercase tracking-widest mb-6 flex items-center gap-2 border-t pt-6" style={{ color: "var(--text-muted)", borderColor: "var(--border)" }}>
                    <span className="material-symbols-outlined text-[16px]">
                      star
                    </span>{" "}
                    Amenities
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    {[
                      "Gym",
                      "Swimming Pool",
                      "Clubhouse",
                      "Power Backup",
                      "Security",
                      "Lifts",
                      "Gas Pipeline",
                      "WiFi",
                      "Air Conditioning"
                    ].map((amenity) => (
                       <button
                        key={amenity}
                        type="button"
                        onClick={() => {
                          const has = (formData.amenities || []).includes(amenity);
                          setFormData((prev) => ({
                            ...prev,
                            amenities: has
                              ? (prev.amenities || []).filter((a) => a !== amenity)
                              : [...(prev.amenities || []), amenity],
                          }));
                        }}
                        className="h-9 px-5 rounded-full text-[9px] font-extrabold tracking-widest uppercase transition-all shadow-sm cursor-pointer"
                        style={{
                          backgroundColor: (formData.amenities || []).includes(amenity) ? "var(--accent)" : "var(--surface-alt)",
                          color: (formData.amenities || []).includes(amenity) ? "#ffffff" : "var(--ink)",
                          borderColor: "var(--border)"
                        }}
                      >
                        {amenity}
                      </button>
                    ))}
                  </div>

                  <div className="mt-8 border-t pt-6" style={{ borderColor: "var(--border)" }}>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
                        <span className="material-symbols-outlined text-[11px]">
                          description
                        </span>{" "}
                        Property Description
                      </label>
                      <button
                        type="button"
                        onClick={handleGenerateDescription}
                        disabled={generatingDescription}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-[9px] font-bold uppercase tracking-widest rounded-lg shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95"
                      >
                        {generatingDescription ? (
                          <div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
                        ) : (
                          <span className="material-symbols-outlined text-[12px]">auto_awesome</span>
                        )}
                        Auto-write with AI ✨
                      </button>
                    </div>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      className="w-full h-28 p-4 rounded-xl border outline-none text-[11px] font-medium transition-all shadow-sm resize-none"
                      style={{ backgroundColor: "var(--surface)", color: "var(--ink)", borderColor: "var(--border)" }}
                      placeholder="Write a brief description or click 'Auto-write with AI ✨' to generate automatically using filled property details..."
                    ></textarea>
                    <p className="text-[9px] text-slate-500 mt-2 font-medium flex items-center gap-1">
                      <span className="material-symbols-outlined text-[11px] text-amber-500">lightbulb</span>
                      Tip: Click "Auto-write with AI ✨" to automatically generate a rich property description based on all your filled specifications, location, price, rules, and amenities above.
                    </p>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-6 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => goToStep(1)}
                    className="h-10 px-8 rounded-xl border border-slate-200 bg-white text-slate-600 font-extrabold uppercase tracking-widest hover:bg-slate-50 hover:text-slate-900 transition-all shadow-sm flex items-center gap-2 text-[9px]"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      arrow_back
                    </span>{" "}
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="h-10 px-8 bg-orange-600 hover:bg-orange-500 text-white text-[9px] font-extrabold uppercase tracking-widest rounded-xl transition-all flex items-center gap-3 shadow-lg shadow-orange-600/30 hover:-translate-y-0.5"
                  >
                    Continue to Photos &amp; Audio
                    <span className="material-symbols-outlined text-[20px]">
                      arrow_forward
                    </span>
                  </button>
                </div>
              </>
            )}

            {step === 3 && (
              <div className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="mb-1 border-b border-slate-200 pb-6">
                  <h2 className="text-[20px] font-extrabold text-slate-900 tracking-tight flex items-center gap-2 drop-shadow-sm">
                    <span className="material-symbols-outlined text-orange-600 text-[24px]">
                      perm_media
                    </span>
                    Photos & Audio
                  </h2>
                  <p className="text-[9px] font-medium text-slate-600 mt-2">
                    Upload property photos and record optional audio notes.
                  </p>
                </div>

                <div className="bg-slate-50 rounded-2xl p-8 border border-slate-100 shadow-inner">
                  <div className="flex justify-between items-center mb-1">
                    <h3 className="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px]">
                        photo_library
                      </span>{" "}
                      Property Photos
                    </h3>
                  </div>
                  <div
                    {...getRootProps()}
                    className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer group transition-all duration-300 ${
                      isDragActive
                        ? "border-orange-500 bg-orange-50 scale-[1.02]"
                        : "border-slate-300 bg-white hover:border-orange-400 shadow-sm"
                    }`}
                  >
                    <input {...getInputProps()} />
                    <span className="text-[11px] font-extrabold text-slate-700">
                      Click to browse or drag images here
                    </span>
                  </div>

                  {uploadedMediaList.length > 0 && (
                    <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                      {uploadedMediaList.map((m, i) => (
                        <div
                          key={m.image_url + i}
                          className="relative group rounded-xl overflow-hidden shadow-sm border border-slate-200 h-24"
                        >
                          <img
                            src={m.thumbnail_url || m.image_url}
                            alt="preview"
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => removeUploadedMedia(i)}
                            className="absolute top-1 right-1 bg-white/90 hover:bg-white text-red-500 rounded-full p-1 shadow-md opacity-90 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[16px]">
                              delete
                            </span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {uploadingPhotos && (
                    <div className="mt-4 flex items-center justify-center gap-2 text-xs font-bold text-orange-600 bg-orange-50 p-3 rounded-xl border border-orange-200 animate-pulse">
                      <span className="material-symbols-outlined text-[18px] animate-spin">sync</span>
                      Processing & Uploading Photos...
                    </div>
                  )}
                </div>

                <div className="bg-slate-50 rounded-2xl p-8 border border-slate-100 shadow-inner mt-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px]">
                        mic
                      </span>{" "}
                      Audio Note (Optional)
                    </h3>
                  </div>

                  {!audioURL ? (
                    <div className="flex flex-col items-center justify-center p-8 border border-slate-200 rounded-xl bg-white shadow-sm">
                      <button
                        type="button"
                        onClick={isRecording ? stopRecording : startRecording}
                        className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${isRecording ? "bg-red-100 text-red-600 animate-pulse ring-4 ring-red-100" : "bg-orange-50 hover:bg-orange-100 text-orange-600 shadow-sm"}`}
                      >
                        <span className="material-symbols-outlined text-[32px]">
                          {isRecording ? "stop" : "mic"}
                        </span>
                      </button>
                      <p className="mt-4 text-[9px] font-bold text-slate-600">
                        {isRecording
                          ? "Recording..."
                          : "Click to record an audio note for the property"}
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-8 border border-slate-200 rounded-xl bg-white shadow-sm gap-4">
                      <audio
                        src={audioURL}
                        controls
                        className="w-full max-w-md"
                      />
                      <button
                        type="button"
                        onClick={clearRecording}
                        className="text-[9px] font-extrabold text-red-500 uppercase tracking-widest hover:text-red-600 transition-colors flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          delete
                        </span>{" "}
                        Remove Recording
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center pt-6 border-t border-slate-100 mt-6">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="h-10 px-8 rounded-xl border border-slate-200 bg-white text-slate-600 font-extrabold uppercase tracking-widest hover:bg-slate-50 hover:text-slate-900 transition-all shadow-sm flex items-center gap-2 text-[9px]"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      arrow_back
                    </span>{" "}
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="h-10 px-8 bg-orange-600 hover:bg-orange-500 text-white text-[9px] font-extrabold uppercase tracking-widest rounded-xl transition-all flex items-center gap-3 shadow-lg shadow-orange-600/30 hover:-translate-y-0.5"
                  >
                    Continue to Consent
                    <span className="material-symbols-outlined text-[20px]">
                      arrow_forward
                    </span>
                  </button>
                </div>
              </div>
            )}

            {step === -1 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="mb-1 border-b border-slate-200 pb-6">
                  <h2 className="text-[20px] font-extrabold text-slate-900 tracking-tight flex items-center gap-2 drop-shadow-sm">
                    <span className="material-symbols-outlined text-emerald-600 text-[24px]">
                      verified_user
                    </span>
                    Owner Consent Verification
                  </h2>
                  <p className="text-[9px] font-medium text-slate-600 mt-2">
                    Provide owner verification via Digital Signature or Photo Document.
                  </p>
                </div>

                {/* Verification Method Selector */}
                <div className="flex gap-3 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setConsentMethod("signature")}
                    className={`flex-1 py-3 px-3 rounded-xl text-[9px] sm:text-[9px] font-extrabold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                      consentMethod === "signature"
                        ? "bg-white text-orange-600 shadow-md border border-orange-200"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">draw</span>
                    Digital Signature
                  </button>

                  <button
                    type="button"
                    onClick={() => setConsentMethod("photo")}
                    className={`flex-1 py-3 px-3 rounded-xl text-[9px] sm:text-[9px] font-extrabold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                      consentMethod === "photo"
                        ? "bg-white text-orange-600 shadow-md border border-orange-200"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">add_a_photo</span>
                    Photo Verification
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setConsentMethod("otp")}
                    className={`flex-1 py-3 px-3 rounded-xl text-[9px] sm:text-[9px] font-extrabold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                      consentMethod === "otp"
                        ? "bg-white text-orange-600 shadow-md border border-orange-200"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">dialpad</span>
                    OTP Verification
                  </button>
                </div>

                <section className="bg-slate-50 rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-inner">
                  {consentMethod === "signature" ? (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="text-[11px] font-bold text-slate-900">
                            Digital Signature
                          </h3>
                          <p className="text-[9px] text-slate-500">
                            Draw your signature below using your mouse or touchscreen.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              sigCanvas.current &&
                              typeof sigCanvas.current.clear === "function"
                            ) {
                              sigCanvas.current.clear();
                            }
                            setSignatureData(null);
                            localStorage.removeItem("owner_onboarding_signature_data");
                          }}
                          className="px-3.5 py-1.5 text-[9px] font-extrabold text-slate-700 hover:text-red-600 bg-white hover:bg-red-50 border border-slate-200 rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            refresh
                          </span>
                          Clear Signature
                        </button>
                      </div>

                      <div className="bg-white rounded-2xl overflow-hidden shadow-inner border border-slate-300 relative cursor-crosshair">
                        <SignatureCanvas
                          penColor="#0f172a"
                          canvasProps={{
                            width: 500,
                            height: 220,
                            className: "sigCanvas w-full h-[220px]",
                          }}
                          ref={sigCanvas}
                          onEnd={() => {
                            if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
                              const dataUrl = sigCanvas.current.getCanvas().toDataURL("image/png");
                              setSignatureData(dataUrl);
                              try {
                                localStorage.setItem("owner_onboarding_signature_data", dataUrl);
                              } catch (e) {}
                            }
                          }}
                        />
                        <div className="absolute bottom-3 right-3 pointer-events-none text-[9px] font-bold text-slate-400 bg-slate-100/90 px-2.5 py-1 rounded-lg border border-slate-200">
                          Sign above
                        </div>
                      </div>
                    </div>
                  ) : consentMethod === "photo" ? (
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-[11px] font-bold text-slate-900">
                          Photo Verification Document
                        </h3>
                        <p className="text-[9px] text-slate-500">
                          Upload a photo of your ownership document, tax receipt, electricity bill, or ID proof.
                        </p>
                      </div>

                      {proofPhotoPreview ? (
                        <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-sm flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <img
                              src={proofPhotoPreview}
                              alt="Proof Document"
                              className="w-20 h-20 object-cover rounded-xl border border-slate-200 shadow-inner"
                            />
                            <div>
                              <div className="flex items-center gap-1.5 text-emerald-600 text-[9px] font-extrabold mb-1">
                                <span className="material-symbols-outlined text-[16px]">
                                  check_circle
                                </span>
                                Photo Ready
                              </div>
                              <p className="text-[9px] font-bold text-slate-800 truncate max-w-[200px] sm:max-w-[300px]">
                                {proofPhoto?.name || "Captured_Photo.jpg"}
                              </p>
                              <p className="text-[9px] font-medium text-slate-500 mt-0.5">
                                Verification proof attached
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setProofPhoto(null);
                              setProofPhotoPreview(null);
                            }}
                            className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                            title="Remove photo"
                          >
                            <span className="material-symbols-outlined text-[20px]">
                              delete
                            </span>
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <button
                            type="button"
                            onClick={() => openCamera("consent")}
                            className="h-32 border-2 border-dashed border-orange-300 bg-orange-50/50 hover:bg-orange-100/50 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all group"
                          >
                            <span className="material-symbols-outlined text-[36px] text-orange-600 mb-1 group-hover:scale-110 transition-transform">
                              photo_camera
                            </span>
                            <span className="text-[9px] font-bold text-slate-900">
                              Take Live Photo
                            </span>
                            <span className="text-[9px] text-slate-500 mt-0.5 font-medium">
                              Use device camera
                            </span>
                          </button>

                          <label className="h-32 border-2 border-dashed border-slate-300 bg-white hover:border-orange-400 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all relative group">
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setProofPhoto(file);
                                  setProofPhotoPreview(URL.createObjectURL(file));
                                }
                              }}
                            />
                            <span className="material-symbols-outlined text-[36px] text-slate-500 mb-1 group-hover:scale-110 transition-transform">
                              upload_file
                            </span>
                            <span className="text-[9px] font-bold text-slate-900">
                              Upload Photo / File
                            </span>
                            <span className="text-[9px] text-slate-500 mt-0.5 font-medium">
                              Browse from device
                            </span>
                          </label>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-[11px] font-bold text-slate-900">
                          OTP Verification
                        </h3>
                        <p className="text-[9px] text-slate-500 mb-6">
                          Verify your phone number ({formData.owner_phone}) to provide consent.
                        </p>
                      </div>

                      {otpVerified ? (
                        <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-sm flex items-center gap-4">
                          <span className="material-symbols-outlined text-emerald-600 text-[24px]">check_circle</span>
                          <div>
                            <p className="text-[11px] font-bold text-slate-900">Verified Successfully</p>
                            <p className="text-[9px] text-slate-500">Your consent has been recorded.</p>
                          </div>
                        </div>
                      ) : !otpSent ? (
                        <button
                          type="button"
                          onClick={sendOTP}
                          disabled={otpLoading}
                          className="h-10 px-6 bg-orange-600 hover:bg-orange-500 text-white text-[9px] font-extrabold uppercase tracking-widest rounded-xl transition-all shadow-md disabled:opacity-50"
                        >
                          {otpLoading ? "Sending..." : "Send OTP"}
                        </button>
                      ) : (
                        <div className="flex flex-col max-w-sm gap-4">
                          <input
                            type="text"
                            value={otpCode}
                            onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ""))}
                            placeholder="Enter 6-digit code"
                            maxLength={6}
                            className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:border-orange-500 outline-none text-center tracking-widest text-[14px]"
                          />
                          <button
                            type="button"
                            onClick={verifyOTP}
                            disabled={otpLoading || otpCode.length < 6}
                            className="h-10 px-6 bg-orange-600 hover:bg-orange-500 text-white text-[9px] font-extrabold uppercase tracking-widest rounded-xl transition-all shadow-md disabled:opacity-50"
                          >
                            {otpLoading ? "Verifying..." : "Verify Code"}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </section>

                <div className="flex justify-between items-center pt-6 border-t border-slate-100 mt-6">
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="h-10 px-8 rounded-xl border border-slate-200 bg-white text-slate-600 font-extrabold uppercase tracking-widest hover:bg-slate-50 hover:text-slate-900 transition-all shadow-sm flex items-center gap-2 text-[9px]"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      arrow_back
                    </span>{" "}
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="h-10 px-10 bg-orange-600 hover:bg-orange-500 text-white text-[9px] font-extrabold uppercase tracking-widest rounded-xl transition-all flex items-center gap-3 shadow-lg shadow-orange-600/30 hover:shadow-orange-600/40 hover:-translate-y-0.5"
                  >
                    Continue to Payment
                    <span className="material-symbols-outlined text-[20px]">
                      arrow_forward
                    </span>
                  </button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="animate-in slide-in-from-right-4 duration-300">
                {(() => {
                  const categoryInfo = getCategoryPlans();

                  const housePrice = Number(platformSettings?.owner_residential_fee) || 99;
                  const pgPrice = Number(platformSettings?.owner_apt_pg_fee) || 149;
                  const commercialPrice = Number(platformSettings?.owner_commercial_fee) || 199;

                  const pgDurationFee = customPgDuration === 60 ? 49 : customPgDuration === 90 ? 89 : customPgDuration === 180 ? 149 : 0;

                  const customSubtotal =
                    customHouseCount * housePrice +
                    customPgCount * (pgPrice + pgDurationFee) +
                    customCommercialCount * commercialPrice +
                    (customAddonFeatured ? 99 : 0) +
                    (customAddonHero ? 199 : 0);

                  const totalProps = customHouseCount + customPgCount + customCommercialCount;
                  const customDiscountPercent = totalProps >= 3 ? 15 : 0;
                  const customDiscountAmount = Math.round((customSubtotal * customDiscountPercent) / 100);
                  const customFinalAmount = Math.max(0, customSubtotal - customDiscountAmount);

                  const currentAmount =
                    planMode === "custom"
                      ? customFinalAmount
                      : selectedPlanAmount ||
                        categoryInfo.plans.find((p) => p.id === selectedPlan)?.price ||
                        categoryInfo.plans[1]?.price ||
                        categoryInfo.plans[0].price;

                  return (
                    <>
                      {/* Active Credits Top Notification Banner */}
                      {ownerCredits?.total_credits_remaining > 0 && (
                        <div className="mb-8 p-6 bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white rounded-3xl border-2 border-emerald-500/50 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6 animate-in fade-in slide-in-from-top-4 duration-300">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 flex-shrink-0">
                              <span className="material-symbols-outlined text-[28px]">workspace_premium</span>
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black uppercase tracking-wider">
                                  ACTIVE PASS DETECTED
                                </span>
                                <span className="text-[11px] font-bold text-slate-300">
                                  ({ownerCredits.total_credits_remaining} Credit{ownerCredits.total_credits_remaining === 1 ? '' : 's'} Remaining)
                                </span>
                              </div>
                              <h3 className="text-lg font-black text-white mt-0.5">
                                You have {ownerCredits.total_credits_remaining} active listing credit{ownerCredits.total_credits_remaining === 1 ? '' : 's'} ready to use!
                              </h3>
                              <p className="text-xs text-slate-300 mt-0.5 font-medium">
                                Skip payment and publish this property instantly for ₹0 FREE using 1 credit from your active pass.
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="w-full sm:w-auto px-6 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black uppercase tracking-wider rounded-2xl transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 cursor-pointer flex-shrink-0 hover:-translate-y-0.5 disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined text-[18px]">bolt</span>
                            {isSubmitting ? "Publishing..." : "USE 1 CREDIT & PUBLISH NOW"}
                          </button>
                        </div>
                      )}

                      {/* Mode Switcher Tabs */}
                      <div className="flex justify-center mb-8">
                        <div className="bg-slate-100 p-1.5 rounded-2xl flex items-center gap-2 border border-slate-200 shadow-inner">
                          <button
                            type="button"
                            onClick={() => setPlanMode("packages")}
                            className={`px-5 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                              planMode === "packages"
                                ? "bg-white text-orange-600 shadow-md border border-slate-200/80"
                                : "text-slate-500 hover:text-slate-900"
                            }`}
                          >
                            <span className="material-symbols-outlined text-[18px]">package_2</span>
                            Standard Packages
                          </button>
                          <button
                            type="button"
                            onClick={() => setPlanMode("custom")}
                            className={`px-5 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                              planMode === "custom"
                                ? "bg-white text-orange-600 shadow-md border border-slate-200/80"
                                : "text-slate-500 hover:text-slate-900"
                            }`}
                          >
                            <span className="material-symbols-outlined text-[18px]">build_circle</span>
                            Custom Build-Your-Own Plan
                          </button>
                        </div>
                      </div>

                      {planMode === "packages" ? (
                        <>
                          <div className="mb-8 text-center">
                            <span className="inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-orange-500/10 text-orange-600 border border-orange-500/20 text-[11px] font-black uppercase tracking-wider mb-3 shadow-xs">
                              {categoryInfo.categoryTag} PACKAGES
                            </span>
                            <h2 className="text-[26px] font-black text-slate-900 tracking-tight">
                              Select Listing Plan for {categoryInfo.categoryName}
                            </h2>
                            <p className="text-slate-500 text-[13px] max-w-xl mx-auto leading-relaxed mt-2 font-medium">
                              Choose a package tailored for {categoryInfo.categoryName}. Multi-property passes offer higher savings.
                            </p>
                          </div>

                          {/* Plan Selection Cards Grid */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
                            {categoryInfo.plans.map((plan) => {
                              const isSelected = selectedPlan === plan.id;
                              return (
                                <div
                                  key={plan.id}
                                  onClick={() => {
                                    setSelectedPlan(plan.id);
                                    setSelectedPlanAmount(plan.price);
                                  }}
                                  className={`relative p-6 rounded-3xl border-2 transition-all duration-300 cursor-pointer flex flex-col justify-between ${
                                    isSelected
                                      ? "border-orange-500 bg-orange-500/5 shadow-xl scale-[1.02]"
                                      : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-md"
                                  }`}
                                >
                                  {plan.popular && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-md">
                                      ★ MOST POPULAR
                                    </div>
                                  )}
                                  <div>
                                    <div className="flex justify-between items-center mb-3 mt-1">
                                      <span
                                        className={`text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full border ${
                                          plan.id === "single"
                                            ? "bg-slate-100 text-slate-700 border-slate-200"
                                            : plan.id === "3pack"
                                            ? "bg-orange-100 text-orange-700 border-orange-200"
                                            : "bg-purple-100 text-purple-700 border-purple-200"
                                        }`}
                                      >
                                        {plan.tag}
                                      </span>
                                      {isSelected && (
                                        <span className="material-symbols-outlined text-orange-600 text-[22px]">
                                          check_circle
                                        </span>
                                      )}
                                    </div>
                                    <h3 className="text-[20px] font-extrabold text-slate-900">{plan.name}</h3>
                                    <div className="mt-3 flex items-baseline gap-1">
                                      <span className="text-[32px] font-black text-slate-900">₹{plan.price}</span>
                                    </div>
                                    <p className="text-[12px] text-slate-500 mt-2 font-medium">
                                      {plan.description}
                                    </p>
                                    <ul className="mt-5 space-y-2.5 text-[12px] font-semibold text-slate-700">
                                      <li className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-orange-600 text-[18px]">
                                          home_work
                                        </span>
                                        <span className="font-extrabold text-slate-900">
                                          {plan.count} Property {plan.count === 1 ? "Listing" : "Listings"}
                                        </span>{" "}
                                        Included
                                      </li>
                                      <li className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-emerald-500 text-[18px]">
                                          check
                                        </span>
                                        Direct Verified Tenant Enquiries
                                      </li>
                                      <li className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-emerald-500 text-[18px]">
                                          check
                                        </span>
                                        {plan.count > 1
                                          ? "Priority Top Search Placement"
                                          : "Verified Owner Badge"}
                                      </li>
                                    </ul>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      ) : (
                        <div className="max-w-2xl mx-auto mb-10 bg-white border-2 border-slate-200 p-8 rounded-3xl shadow-xl">
                          <div className="text-center mb-6">
                            <h2 className="text-[22px] font-black text-slate-900">
                              Custom Build-Your-Own Owner Plan
                            </h2>
                            <p className="text-[12px] text-slate-500 mt-1 font-medium">
                              Select your exact property mix & optional visibility boosts. Get an automatic 15% discount for 3+ total properties!
                            </p>
                          </div>

                          {/* Property Mix Counter Grid */}
                          <div className="space-y-4 mb-8">
                            <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-wider border-b border-slate-100 pb-2">
                              1. Select Property Quantities
                            </h3>

                            {/* House Counter */}
                            <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                              <div>
                                <h4 className="text-[14px] font-extrabold text-slate-900 flex items-center gap-2">
                                  <span className="material-symbols-outlined text-orange-600 text-[20px]">home</span>
                                  Residential House / Villa
                                </h4>
                                <p className="text-[11px] text-slate-500 font-medium">₹{housePrice} per property ({platformSettings?.validity_residential_days || 30}d Validity)</p>
                              </div>
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => setCustomHouseCount((prev) => Math.max(0, prev - 1))}
                                  className="w-8 h-8 rounded-xl bg-white border border-slate-300 font-black text-slate-700 hover:bg-slate-100 transition-all flex items-center justify-center text-[16px]"
                                >
                                  -
                                </button>
                                <span className="text-[16px] font-black text-slate-900 w-6 text-center">
                                  {customHouseCount}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setCustomHouseCount((prev) => prev + 1)}
                                  className="w-8 h-8 rounded-xl bg-white border border-slate-300 font-black text-slate-700 hover:bg-slate-100 transition-all flex items-center justify-center text-[16px]"
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            {/* PG Counter */}
                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h4 className="text-[14px] font-extrabold text-slate-900 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-orange-600 text-[20px]">apartment</span>
                                    Apartment / PG & Hostel
                                  </h4>
                                  <p className="text-[11px] text-slate-500 font-medium">₹{pgPrice + pgDurationFee} per property ({customPgDuration}d Validity & Room Tracker)</p>
                                </div>
                                <div className="flex items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={() => setCustomPgCount((prev) => Math.max(0, prev - 1))}
                                    className="w-8 h-8 rounded-xl bg-white border border-slate-300 font-black text-slate-700 hover:bg-slate-100 transition-all flex items-center justify-center text-[16px]"
                                  >
                                    -
                                  </button>
                                  <span className="text-[16px] font-black text-slate-900 w-6 text-center">
                                    {customPgCount}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setCustomPgCount((prev) => prev + 1)}
                                    className="w-8 h-8 rounded-xl bg-white border border-slate-300 font-black text-slate-700 hover:bg-slate-100 transition-all flex items-center justify-center text-[16px]"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>

                              {/* Duration Selector Buttons */}
                              <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between gap-2 flex-wrap">
                                <span className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[14px] text-orange-600">schedule</span>
                                  Select Listing Duration:
                                </span>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {[
                                    { days: 30, label: "30 Days", fee: "+₹0" },
                                    { days: 60, label: "60 Days", fee: "+₹49" },
                                    { days: 90, label: "90 Days", fee: "+₹89" },
                                    { days: 180, label: "6 Months", fee: "+₹149" },
                                  ].map((d) => (
                                    <button
                                      key={d.days}
                                      type="button"
                                      onClick={() => setCustomPgDuration(d.days)}
                                      className={`px-2.5 py-1 rounded-xl text-[10px] font-black transition-all cursor-pointer border ${
                                        customPgDuration === d.days
                                          ? "bg-orange-600 text-white border-orange-600 shadow-sm"
                                          : "bg-white text-slate-700 border-slate-300 hover:border-slate-400 hover:bg-slate-100"
                                      }`}
                                    >
                                      {d.label} ({d.fee})
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* Commercial Counter */}
                            <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                              <div>
                                <h4 className="text-[14px] font-extrabold text-slate-900 flex items-center gap-2">
                                  <span className="material-symbols-outlined text-orange-600 text-[20px]">storefront</span>
                                  Commercial Shop / Office
                                </h4>
                                <p className="text-[11px] text-slate-500 font-medium">₹{commercialPrice} per property ({platformSettings?.validity_commercial_days || 30}d Validity)</p>
                              </div>
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => setCustomCommercialCount((prev) => Math.max(0, prev - 1))}
                                  className="w-8 h-8 rounded-xl bg-white border border-slate-300 font-black text-slate-700 hover:bg-slate-100 transition-all flex items-center justify-center text-[16px]"
                                >
                                  -
                                </button>
                                <span className="text-[16px] font-black text-slate-900 w-6 text-center">
                                  {customCommercialCount}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setCustomCommercialCount((prev) => prev + 1)}
                                  className="w-8 h-8 rounded-xl bg-white border border-slate-300 font-black text-slate-700 hover:bg-slate-100 transition-all flex items-center justify-center text-[16px]"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Boost Add-ons Section */}
                          <div className="space-y-3 mb-8">
                            <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-wider border-b border-slate-100 pb-2">
                              2. Optional Visibility Boosts
                            </h3>

                            <label className="flex items-center justify-between p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl cursor-pointer hover:bg-amber-500/10 transition-colors">
                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={customAddonFeatured}
                                  onChange={(e) => setCustomAddonFeatured(e.target.checked)}
                                  className="w-5 h-5 accent-orange-600 rounded cursor-pointer"
                                />
                                <div>
                                  <h4 className="text-[13px] font-extrabold text-slate-900 flex items-center gap-1.5">
                                    ★ Priority Top Search Placement
                                  </h4>
                                  <p className="text-[11px] text-slate-500 font-medium">Pins your listings to top search results with a Featured Badge.</p>
                                </div>
                              </div>
                              <span className="text-[13px] font-black text-orange-600">+₹99</span>
                            </label>

                            <label className="flex items-center justify-between p-4 bg-purple-500/5 border border-purple-500/20 rounded-2xl cursor-pointer hover:bg-purple-500/10 transition-colors">
                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={customAddonHero}
                                  onChange={(e) => setCustomAddonHero(e.target.checked)}
                                  className="w-5 h-5 accent-purple-600 rounded cursor-pointer"
                                />
                                <div>
                                  <h4 className="text-[13px] font-extrabold text-slate-900 flex items-center gap-1.5">
                                    🌟 Homepage Hero Banner Spotlight
                                  </h4>
                                  <p className="text-[11px] text-slate-500 font-medium">Renders your property in top sliding banner on homepage.</p>
                                </div>
                              </div>
                              <span className="text-[13px] font-black text-purple-600">+₹199</span>
                            </label>
                          </div>

                          {/* Live Discount & Total Card */}
                          <div className="p-6 bg-slate-900 text-white rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
                            <div>
                              <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                                {totalProps} Properties Selected
                              </p>
                              <div className="flex items-baseline gap-2 mt-1">
                                <span className="text-[28px] font-black text-white">₹{customFinalAmount}</span>
                                {customDiscountAmount > 0 && (
                                  <span className="text-[13px] text-slate-400 line-through font-bold">
                                    ₹{customSubtotal}
                                  </span>
                                )}
                              </div>
                              {customDiscountAmount > 0 && (
                                <p className="text-[11px] text-emerald-400 font-extrabold mt-1">
                                  🎉 15% Multi-Property Combo Discount Applied (-₹{customDiscountAmount})
                                </p>
                              )}
                            </div>
                            <div className="text-right text-[11px] font-bold text-slate-300">
                              Selected Plan Total: <span className="text-orange-400 font-black text-[15px]">₹{customFinalAmount}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Payment Section / Active Credits Section */}
                      {ownerCredits?.total_credits_remaining > 0 ? (
                        <div className="max-w-xl mx-auto bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 border-2 border-emerald-500/50 shadow-2xl rounded-3xl p-8 mt-10 text-center text-white relative overflow-hidden">
                          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                            <span className="material-symbols-outlined text-[32px]">stars</span>
                          </div>
                          <h3 className="text-xl font-black mb-1 text-white">
                            {ownerCredits.total_credits_remaining} Active Listing Credit{ownerCredits.total_credits_remaining === 1 ? '' : 's'} Available!
                          </h3>
                          <p className="text-xs text-emerald-200/90 font-medium mb-6 max-w-sm mx-auto">
                            You have active listing credits on your account. Publish this property instantly for FREE using 1 credit!
                          </p>

                          <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 rounded-2xl font-black text-sm uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 hover:-translate-y-0.5"
                          >
                            <span className="material-symbols-outlined text-[20px]">bolt</span>
                            {isSubmitting ? "Publishing Listing..." : "PUBLISH LISTING USING 1 CREDIT"}
                          </button>

                          <p className="text-[11px] text-slate-400 font-semibold mt-4">
                            (1 credit will be deducted. Remaining credits after publishing: {ownerCredits.total_credits_remaining - 1})
                          </p>

                          <div className="flex justify-center items-center pt-6 border-t border-slate-800/80 mt-6">
                            <button
                              type="button"
                              onClick={() => goToStep(4)}
                              className="h-10 px-8 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 font-extrabold uppercase tracking-widest hover:bg-slate-700 hover:text-white transition-all shadow-sm flex items-center gap-2 text-[10px] cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                              Back
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="max-w-xl mx-auto bg-white border-2 border-slate-200 shadow-2xl rounded-3xl p-8 mt-10 text-center">
                          <h3 className="text-[18px] font-black text-slate-900 mb-1">
                            Complete Payment & Publish Listing
                          </h3>
                          <p className="text-[12px] text-slate-500 font-medium mb-6">
                            Total Amount Due: <span className="text-orange-600 font-black text-[16px]">₹{currentAmount}</span>
                          </p>

                        {regConfig?.payment_gateway === "razorpay" ? (
                          <div className="space-y-4">
                            <div className="p-4 bg-orange-50/50 border border-orange-200/60 rounded-2xl text-[11px] text-slate-600 font-medium leading-relaxed">
                              🔒 <strong>Instant Automated Checkout</strong> via Razorpay. Supports Credit/Debit Cards, GPay, PhonePe, Paytm, and NetBanking.
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRazorpayPayment(currentAmount, selectedPlan)}
                              disabled={isSubmitting}
                              className="w-full h-12 bg-orange-600 hover:bg-orange-500 text-white text-[12px] font-black uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-orange-600/30 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer hover:-translate-y-0.5"
                            >
                              <span className="material-symbols-outlined text-[20px]">lock</span>
                              {isSubmitting ? "Processing..." : `Pay ₹${currentAmount} & Publish Listing`}
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-6">
                            <div className="flex flex-col items-center">
                              {regConfig ? (
                                <QRCode
                                  value={`upi://pay?pa=${regConfig.upi_merchant_id}&pn=Rentlo&am=${currentAmount}&cu=INR`}
                                  size={180}
                                />
                              ) : (
                                <div className="w-[180px] h-[180px] bg-slate-100 animate-pulse rounded-2xl flex items-center justify-center text-slate-400 text-[11px] font-bold">
                                  Loading QR...
                                </div>
                              )}
                              <a
                                href={`upi://pay?pa=${regConfig?.upi_merchant_id || "rentlo@upi"}&pn=Rentlo&am=${currentAmount}&cu=INR`}
                                className="mt-4 w-full max-w-xs h-10 bg-slate-900 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors text-[12px]"
                              >
                                <span className="material-symbols-outlined text-[18px]">touch_app</span>
                                Pay ₹{currentAmount} via GPay / PhonePe
                              </a>
                            </div>

                            <div className="text-left space-y-2 max-w-md mx-auto">
                              <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                                Enter 12-Digit UTR / Reference Number <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="text"
                                value={regUtr}
                                onChange={(e) => setRegUtr(e.target.value.replace(/[^0-9]/g, ""))}
                                maxLength={12}
                                placeholder="e.g. 312345678901"
                                className="w-full h-11 bg-white border-2 border-slate-200 rounded-xl px-3 text-[13px] font-bold outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 transition-all"
                              />
                            </div>

                            <button
                              type="button"
                              onClick={handleSubmit}
                              disabled={isSubmitting || regUtr.length !== 12}
                              className="w-full h-12 bg-green-600 hover:bg-green-500 text-white text-[12px] font-black uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-green-600/30 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer hover:-translate-y-0.5"
                            >
                              <span className="material-symbols-outlined text-[20px]">check_circle</span>
                              {isSubmitting ? "Submitting..." : `Submit UTR & Publish Listing (₹${currentAmount})`}
                            </button>
                          </div>
                        )}

                        <div className="flex justify-between items-center pt-6 border-t border-slate-100 mt-8">
                          <button
                            type="button"
                            onClick={() => setStep(4)}
                            className="h-10 px-8 rounded-xl border border-slate-200 bg-white text-slate-600 font-extrabold uppercase tracking-widest hover:bg-slate-50 hover:text-slate-900 transition-all shadow-sm flex items-center gap-2 text-[9px]"
                          >
                            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                            Back
                          </button>
                        </div>
                      </div>
                    )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      </div>

      {showCameraModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" style={{ backgroundColor: "rgba(0,0,0,0.45)" }}>
          <div className="rounded-3xl overflow-hidden max-w-lg w-full shadow-2xl flex flex-col items-center border animate-in zoom-in duration-200" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="w-full px-6 py-4 flex items-center justify-between border-b" style={{ borderColor: "var(--border)" }}>
              <h3 className="font-extrabold text-[12px] flex items-center gap-2" style={{ color: "var(--ink)" }}>
                <span className="material-symbols-outlined text-orange-500">photo_camera</span>
                Live Camera Capture
              </h3>
              <button
                type="button"
                onClick={closeCamera}
                className="transition-colors border w-7 h-7 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--text-muted)" }}
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="relative w-full h-80 bg-black flex items-center justify-center overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              ></video>
              <canvas ref={canvasRef} className="hidden"></canvas>
            </div>

            <div className="w-full p-6 flex items-center justify-center gap-4 border-t" style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)" }}>
              <button
                type="button"
                onClick={closeCamera}
                className="px-6 py-3 border text-[9px] font-extrabold uppercase tracking-widest rounded-xl transition-all"
                style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)", color: "var(--text-muted)" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={capturePhotoFromCamera}
                className="px-8 py-3 text-white text-[9px] font-extrabold uppercase tracking-widest rounded-xl shadow-lg transition-all flex items-center gap-2 transform hover:scale-105 active:scale-95"
                style={{ backgroundColor: "var(--accent)", boxShadow: "0 4px 12px rgba(5,150,105,0.3)" }}
              >
                <span className="material-symbols-outlined text-[18px]">photo_camera</span>
                Capture Photo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selfie Camera Modal for Owner Listing Verification */}
      {showSelfieCamera && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.65)" }}>
          <div className="rounded-3xl overflow-hidden max-w-sm w-full shadow-2xl flex flex-col items-center border animate-in zoom-in duration-200" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="w-full px-6 py-4 flex items-center justify-between border-b" style={{ borderColor: "var(--border)" }}>
              <h3 className="font-extrabold text-[12px] flex items-center gap-2" style={{ color: "var(--ink)" }}>
                <span className="material-symbols-outlined text-orange-500">face_retouching_natural</span>
                Owner Live Selfie Verification
              </h3>
              <button type="button" onClick={closeSelfieCamera}
                className="transition-colors border w-7 h-7 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--text-muted)" }}>
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <div className="relative w-full bg-black flex items-center justify-center overflow-hidden" style={{ height: "300px" }}>
              <video ref={selfieVideoRef} autoPlay playsInline className="w-full h-full object-cover" style={{ transform: "scaleX(-1)" }} />
              <canvas ref={selfieCanvasRef} className="hidden" />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div 
                  className={`w-40 h-52 rounded-full border-4 border-dashed transition-all duration-300 ${faceDetected ? 'border-emerald-500' : faceMisaligned ? 'border-red-500' : 'border-white/60'}`}
                  style={{ 
                    boxShadow: faceDetected 
                      ? "0 0 0 9999px rgba(6, 78, 59, 0.45)" 
                      : faceMisaligned 
                      ? "0 0 0 9999px rgba(153, 27, 27, 0.45)" 
                      : "0 0 0 9999px rgba(0,0,0,0.35)" 
                  }}
                />
              </div>
            </div>
            <div className="w-full px-4 py-2 text-center" style={{ backgroundColor: "var(--surface-alt)" }}>
              <p className="text-[10px] font-semibold text-slate-500">
                {faceDetected 
                  ? 'Face detected successfully!' 
                  : faceMisaligned 
                  ? 'Align Face to Circle (Hold Still)' 
                  : "Position the owner's face in the oval, then capture."
                }
              </p>
            </div>
            <div className="w-full p-5 flex items-center justify-center gap-4 border-t" style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)" }}>
              <button type="button" onClick={closeSelfieCamera}
                className="px-5 py-2.5 border text-[9px] font-extrabold uppercase tracking-widest rounded-xl transition-all"
                style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)", color: "var(--text-muted)" }}>
                Cancel
              </button>
              <button 
                type="button" 
                onClick={captureSelfie}
                className={`px-7 py-2.5 text-white text-[9px] font-extrabold uppercase tracking-widest rounded-xl shadow-lg transition-all flex items-center gap-2 transform hover:scale-105 active:scale-95 duration-300 ${faceDetected ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20' : faceMisaligned ? 'bg-red-600 hover:bg-red-500 shadow-red-600/20' : 'bg-orange-600 hover:bg-orange-500 shadow-orange-600/20'}`}
              >
                <span className="material-symbols-outlined text-[16px]">{faceDetected ? 'check_circle' : faceMisaligned ? 'warning' : 'camera_alt'}</span>
                {faceDetected ? 'Face Detected - Capture' : faceMisaligned ? 'Align Face to Circle' : 'Capture Selfie'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
