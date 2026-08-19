import React, { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../shared/context/AuthContext";
import { AdminLayout } from "../components/AdminLayout";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import SignatureCanvas from "react-signature-canvas";
import { useDropzone } from "react-dropzone";
import { get, set, del, keys } from "idb-keyval";
import { loadRazorpayScript } from "../../shared/utils/razorpayLoader";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { STATE_CITY_DATA, MapFlyToHandler } from "../../shared/constants/locationData";

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

const defaultAdminFormData = {
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
  onboarding_payment_method: "",
  target_upi_id: localStorage.getItem("defaultUpiId") || "rentlo@ybl",
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
  amenities: [],
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

export const NewListing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isSubmittedRef = useRef(false);

  const [formData, setFormData] = useState(() => {
    const saved = localStorage.getItem("admin_onboarding_form_data");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { 
          ...defaultAdminFormData, 
          ...parsed,
          pg_room_inventory: {
            ...defaultAdminFormData.pg_room_inventory,
            ...(parsed.pg_room_inventory || {})
          }
        };
      } catch (error) {
        console.error("Failed to parse cached admin_onboarding_form_data:", error);
        localStorage.removeItem("admin_onboarding_form_data");
      }
    }
    return { ...defaultAdminFormData };
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
  const [selectedStateKey, setSelectedStateKey] = useState("karnataka");
  const [selectedCityId, setSelectedCityId] = useState("hubli");
  const [mapCenter, setMapCenter] = useState([15.3647, 75.1240]);
  const [mapZoom, setMapZoom] = useState(13);

  const [offlineDrafts, setOfflineDrafts] = useState([]);
  const [razorpayDetails, setRazorpayDetails] = useState(null);

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

    // Fetch Admin Platform Settings for default UPI ID and Onboarding Fee
    fetch(`${import.meta.env.VITE_API_URL}/properties/platform-settings/`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setPlatformSettings(data);
          setFormData((prev) => ({
            ...prev,
            target_upi_id: data.default_upi_id || "rentlo@ybl",
            onboarding_fee: data.bypass_owner_payment
              ? "0"
              : data.owner_onboarding_fee != null
              ? data.owner_onboarding_fee.toString()
              : "0",
          }));
        }
      })
      .catch((err) => console.error("Failed to fetch platform settings:", err));

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
    // Fetch cities the agent is assigned to
    if (user) {
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
        .catch((err) => console.error(err));
    }
  }, [user]);

  useEffect(() => {
    if (formData.city_id) {
      fetch(
        `${import.meta.env.VITE_API_URL}/properties/cities/${formData.city_id}/localities/`,
      )
        .then((res) => res.json())
        .then((data) => setLocalities(data))
        .catch((err) => console.error(err));

      fetch(
        `${import.meta.env.VITE_API_URL}/properties/cities/${formData.city_id}/registration-config/`,
      )
        .then((res) => res.json())
        .then((data) => setRegConfig(data))
        .catch((err) => console.error(err));
    } else {
      setLocalities([]);
      setRegConfig(null);
    }
  }, [formData.city_id]);

  const [position, setPosition] = useState(() => {
    const saved = localStorage.getItem("admin_onboarding_position");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (error) {
        console.error("Failed to parse cached admin_onboarding_position:", error);
        toast.error("Failed to load cached map location.");
        localStorage.removeItem("admin_onboarding_position");
      }
    }
    return null;
  });

  useEffect(() => {
    if (position) {
      localStorage.setItem("admin_onboarding_position", JSON.stringify(position));
    } else {
      localStorage.removeItem("admin_onboarding_position");
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
            city_name_input: cName,
            state_name_input: sName,
            locality_name_input: lName
          };
          const foundCity = cities.find(c => c.name.toLowerCase() === cName.toLowerCase());
          if (foundCity && !prev.city_id) {
            updated.city_id = foundCity.id.toString();
          }
          return updated;
        });
        toast.success("Address auto-filled from map pin!");
      }
    } catch (e) {
      console.error("Reverse geocoding failed", e);
    }
  };

  const [regConfig, setRegConfig] = useState(null);
  const [files, setFiles] = useState([]);
  const [uploadedMediaList, setUploadedMediaList] = useState(() => {
    try {
      const saved = localStorage.getItem("admin_onboarding_uploaded_media");
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [step, setStep] = useState(() => {
    const saved = localStorage.getItem("admin_onboarding_step");
    if (saved) {
      try {
        const parsed = parseInt(saved, 10);
        if (isNaN(parsed)) throw new Error("Parsed step is NaN");
        return parsed;
      } catch (error) {
        console.error("Failed to parse cached admin_onboarding_step:", error);
        toast.error("Failed to load cached step. Starting from step 1.");
        localStorage.removeItem("admin_onboarding_step");
      }
    }
    return 1;
  });

  useEffect(() => {
    if (isSubmittedRef.current) return;
    const { owner_password, ...safeFormData } = formData;
    localStorage.setItem("admin_onboarding_form_data", JSON.stringify(safeFormData));
  }, [formData]);

  useEffect(() => {
    if (isSubmittedRef.current) return;
    localStorage.setItem("admin_onboarding_step", step.toString());
  }, [step]);

  const handleDiscard = () => {
    if (window.confirm("Are you sure you want to discard your draft? This will clear all entered data.")) {
      localStorage.removeItem("admin_onboarding_form_data");
      localStorage.removeItem("admin_onboarding_step");
      localStorage.removeItem("admin_onboarding_position");
      localStorage.removeItem("admin_onboarding_signature_data");
      localStorage.removeItem("admin_onboarding_uploaded_media");
      setSignatureData(null);
      setUploadedMediaList([]);
      setFormData({ ...defaultAdminFormData, target_upi_id: localStorage.getItem("defaultUpiId") || "rentlo@ybl" });
      setStep(1);
      setFiles([]);
      setPosition(null);
    }
  };
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [consentMethod, setConsentMethod] = useState("signature");
  const [signatureData, setSignatureData] = useState(() => {
    return localStorage.getItem("admin_onboarding_signature_data") || null;
  });
  const sigCanvas = useRef(null);

  useEffect(() => {
    if (step === 4 && consentMethod === "signature" && signatureData && sigCanvas.current) {
      try {
        sigCanvas.current.clear();
        sigCanvas.current.fromDataURL(signatureData);
      } catch (e) {
        console.error("Could not restore admin signature canvas", e);
      }
    }
  }, [step, consentMethod]);

  const [platformSettings, setPlatformSettings] = useState(null);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [selfiePhoto, setSelfiePhoto] = useState(null);
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
  const [ownerAccountExists, setOwnerAccountExists] = useState(null);
  const [ownerAccountDetails, setOwnerAccountDetails] = useState(null);
  const [checkingOwnerPhone, setCheckingOwnerPhone] = useState(false);

  useEffect(() => {
    const phoneClean = (formData.owner_phone || "").replace(/[^0-9]/g, "");
    setOtpVerified(false);
    setOtpSent(false);
    setOtpCode("");
    setSelfiePhoto(null);
    setSelfiePreview(null);
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
            localStorage.setItem("admin_onboarding_uploaded_media", JSON.stringify(updated));
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
        localStorage.setItem("admin_onboarding_uploaded_media", JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
  });

  const handleInputChange = (e) => {
    let { name, value, type } = e.target;
    
    // Global validation rules for maximum length input fields
    const textFields = ["owner_name", "city_name_input", "locality_name_input", "state_name_input", "exact_address", "target_upi_id", "owner_password", "owner_phone"];
    const numericFields = ["price", "carpet_area", "security_deposit", "maintenance_charges", "total_beds", "available_beds", "floor_number", "total_floors", "property_age", "bedrooms", "bathrooms", "balconies"];

    if (textFields.includes(name) && value.length > 0) {
      if (name === "owner_phone") value = value.slice(0, 10);
      else if (name === "owner_name") value = value.slice(0, 50);
      else if (name === "target_upi_id") value = value.slice(0, 50);
      else if (name === "owner_password") value = value.slice(0, 50);
      else if (name === "exact_address") value = value.slice(0, 1000);
      else value = value.slice(0, 100);
    }
    
    if (numericFields.includes(name) && value.length > 0) {
      if (["floor_number", "total_floors", "bedrooms", "bathrooms", "balconies", "property_age"].includes(name)) {
        value = value.slice(0, 3);
      } else {
        value = value.slice(0, 10);
      }
    }

    if (type === "number" && name !== "floor_number") {
      if (value !== "" && parseFloat(value) < 0) {
        value = "0";
      }
    }
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      if (name === "city_id") {
        updated.locality = "";
      }
      if (name === "city_name_input" || name === "locality_name_input" || name === "state_name_input") {
        updated.city_id = "";
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

  const [generatingDescription, setGeneratingDescription] = useState(false);

  const handleGenerateDescription = async () => {
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
        toast.success("AI Property Description auto-generated successfully!");
      } else {
        toast.error("Failed to generate description.");
      }
    } catch (err) {
      toast.error("Error connecting to AI description generator.");
    } finally {
      setGeneratingDescription(false);
    }
  };

  const handleNext = () => {
    if (step === 1) {
      if (!formData.owner_phone?.trim()) {
        toast.warn("Please enter Owner Phone Number.");
        return;
      }
      const verifyMode = platformSettings?.owner_listing_verification_method || "otp";
      const isVerified = verifyMode === "otp" ? otpVerified : !!selfiePhoto;
      if (!isVerified) {
        toast.warn(verifyMode === "otp" ? "Please verify owner phone number via OTP first." : "Please capture the owner live selfie first.");
        return;
      }
      if (!formData.owner_name?.trim()) {
        toast.warn("Please enter Owner Name.");
        return;
      }
      if (!formData.property_type) {
        toast.warn("Please select Property Type.");
        return;
      }
      if (!formData.city_id && !formData.city_name_input) {
        toast.warn("Please pin the exact location on the map to set the City.");
        return;
      }
      if (!formData.locality && !formData.locality_name_input) {
        toast.warn("Please pin the exact location on the map to set the Locality.");
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
    setStep((prev) => prev + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const sendOTP = async () => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/properties/otp/request/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ phone: formData.owner_phone }),
        },
      );
      if (res.ok) {
        const data = await res.json();
        toast.success(`OTP Sent! (Demo code: ${data.demo_code})`);
        setOtpSent(true);
      } else {
        toast.error("Failed to send OTP.");
      }
    } catch (err) {
      toast.error("Network error while sending OTP.");
    }
  };

  const verifyOTP = async () => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/properties/otp/verify/`,
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
    }
  };


  const handleRazorpayPayment = async () => {
    const validationErrors = [];
    if (!formData.property_type) validationErrors.push("Property type is required");
    if (!formData.price || isNaN(formData.price) || Number(formData.price) <= 0) validationErrors.push("Valid monthly price is required");

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
        body: JSON.stringify({ city_id: formData.city_id })
      });
      if (!res.ok) throw new Error("Failed to create order");
      const data = await res.json();
      
      const options = {
        key: data.key_id,
        amount: data.amount,
        currency: "INR",
        name: "Rentlo",
        description: "Property Registration Fee",
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
      toast.error("Could not initialize Razorpay. Please try again.");
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
    if (isSubmitting) return;
    if (!formData.onboarding_payment_method) {
      toast.error("Please select a payment method.");
      return;
    }

    setIsSubmitting(true);
    try {
      let consentProofUrl = "";

      const verifyMode = platformSettings?.owner_listing_verification_method || "otp";
      if (verifyMode === "selfie" && selfiePhoto) {
        try {
          const fetchRes = await fetch(selfiePhoto);
          const selfieBlob = await fetchRes.blob();
          const selfieFormData = new FormData();
          selfieFormData.append("file", selfieBlob, "owner_selfie.jpg");
          const uploadRes = await fetch(
            `${import.meta.env.VITE_API_URL}/media/upload/`,
            {
              method: "POST",
              credentials: "include",
              body: selfieFormData,
            },
          );
          if (uploadRes.ok) {
            const data = await uploadRes.json();
            consentProofUrl = data.full_url;
          }
        } catch (e) {
          console.error("Selfie upload failed", e);
        }
      } else {
        consentProofUrl = "otp_verified_placeholder";
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
          const vnData = await vnRes.json();
          uploadedVoiceNoteUrl = vnData.public_url;
        } else {
          toast.error("Failed to upload voice note. Continuing without it.");
        }
      }

      // Create listing — strip empty optional fields so Django doesn't reject them
      const rawData = { ...formData };
      const numericFields = ['bedrooms', 'bathrooms', 'balconies', 'carpet_area', 'floor_number', 'total_floors', 'property_age', 'security_deposit', 'maintenance_charges', 'price'];
      for (const field of numericFields) {
        if (rawData[field] === '') delete rawData[field];
      }
      const optionalStringFields = ['available_from', 'furnishing_status', 'facing_direction', 'voice_note_url', 'consent_proof_url'];
      for (const field of optionalStringFields) {
        if (rawData[field] === '' || rawData[field] == null) delete rawData[field];
      }

      const payload = {
        ...rawData,
        pg_rules: formData.property_category === 'pg' ? { room_inventory: formData.pg_room_inventory } : rawData.pg_rules,
        exact_lat: position?.lat ? Number(position.lat.toFixed(8)) : undefined,
        exact_lng: position?.lng ? Number(position.lng.toFixed(8)) : undefined,
        consent_proof_url: consentProofUrl || "https://rentlo.in/consent/verified",
        uploaded_media: uploadedMediaList,
        voice_note_url: uploadedVoiceNoteUrl,
        registration_payment_method: formData.onboarding_payment_method === 'razorpay' ? 'razorpay' : formData.onboarding_payment_method === 'qr' ? 'upi' : 'cash',
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
        toast.success("Listing created successfully! Status: Pending Review");
        isSubmittedRef.current = true;
        localStorage.removeItem("admin_onboarding_form_data");
        localStorage.removeItem("admin_onboarding_step");
        localStorage.removeItem("admin_onboarding_position");
        localStorage.removeItem("admin_onboarding_signature_data");
        localStorage.removeItem("admin_onboarding_uploaded_media");
        setUploadedMediaList([]);
        setFormData({ ...defaultAdminFormData, target_upi_id: localStorage.getItem("defaultUpiId") || "rentlo@ybl" });
        setStep(1);
        setPosition(null);
        setFiles([]);
        setMediaUrls([]);
        setVoiceNoteBlob(null);
        setVoiceNoteUrl("");
        setTimeout(() => navigate("/admin"), 2000);
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
    <AdminLayout activeTab="listings">
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
                    className="flex justify-between items-center bg-white/60 backdrop-blur-md p-5 rounded-xl border border-white/80 shadow-sm hover:shadow-md transition-all"
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
            <div className="w-14 h-10 bg-[var(--accent)]/10 rounded-2xl flex items-center justify-center text-[var(--accent)] shadow-sm border border-[var(--accent)]/20 group-hover:scale-110 group-hover:bg-[var(--accent)]/20 transition-all duration-500">
              <span className="material-symbols-outlined text-[32px] group-hover:-translate-y-1 transition-transform duration-500">
                add_business
              </span>
            </div>
            <div>
              <h1 className="text-3xl font-extrabold font-sans text-[var(--ink)] tracking-tight mb-1 drop-shadow-sm">
                Onboard New Property
              </h1>
              <p className="text-[11px] text-[var(--ink-light)] font-medium">
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
          <div className="absolute top-5 left-[6%] right-[6%] h-[2px] bg-slate-200 -z-10 rounded-full"></div>
          <div className="flex justify-between w-full">
            {[
              "Location",
              "Details",
              "Photos",
              "Payment",
            ].map((stepName, idx) => {
              const stepNum = idx + 1;
              const isCompleted = step > stepNum;
              const isActive = step === stepNum;
              return (
                <div
                  key={stepName}
                  className="flex flex-col items-center gap-1 sm:gap-3 relative z-10 w-12 sm:w-20"
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

        <div className="rounded-3xl border shadow-sm p-3.5 sm:p-8 md:p-12 relative overflow-hidden" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
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



                <div className="rounded-2xl p-4 sm:p-8 border shadow-inner" style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)" }}>
                  <h3 className="text-[9px] font-extrabold uppercase tracking-widest mb-6 flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
                    <span className="material-symbols-outlined text-[16px]">
                      info
                    </span>{" "}
                    Property Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    {/* Owner Phone Input (First) */}
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
                      {formData.owner_phone?.replace(/[^0-9]/g, "").length >= 10 && (() => {
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
                  </div>
                </div>

                <fieldset disabled={!(platformSettings?.owner_listing_verification_method === 'selfie' ? !!selfiePhoto : otpVerified)} className="space-y-12 w-full">
                  <div className="rounded-2xl p-4 sm:p-8 border shadow-inner" style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)" }}>
                    <h3 className="text-[9px] font-extrabold uppercase tracking-widest mb-6 flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
                      <span className="material-symbols-outlined text-[16px]">
                        info
                      </span>{" "}
                      Property Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
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
                  </div>
                </div>

                {formData.property_category !== 'pg' && (
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
                )}



                <div className="rounded-2xl p-4 sm:p-8 border shadow-inner mt-6" style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)" }}>
                  <h3 className="text-[9px] font-extrabold uppercase tracking-widest mb-6 flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
                    <span className="material-symbols-outlined text-[16px]">
                      pin_drop
                    </span>{" "}
                    Exact Location
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                    <div className="md:col-span-2">
                      <label className="block text-[9px] font-bold mb-1 uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                        Exact Address *
                      </label>
                      <textarea
                        required
                        rows="2"
                        value={formData.exact_address}
                        onChange={(e) => setFormData({ ...formData, exact_address: e.target.value })}
                        className="w-full rounded-xl border p-4 text-[11px] font-semibold transition-all outline-none resize-none"
                        style={{ backgroundColor: "var(--surface)", color: "var(--ink)", borderColor: "var(--border)" }}
                        placeholder="Pin point the property on the map below to auto-fill this, or type manually"
                      ></textarea>
                    </div>

                    <div className="md:col-span-2 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="block text-[9px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                          Map Location *
                        </label>
                        {!position && (
                          <span className="text-[9px] font-bold text-red-500 bg-red-50 px-3 py-1 rounded-full">
                            Pin Required
                          </span>
                        )}
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

                <div className="rounded-2xl p-4 sm:p-8 border shadow-inner mt-6" style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)" }}>
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
                        value={formData.city_name_input || ""}
                        onChange={handleInputChange}
                        className="w-full h-9 px-3 rounded-xl border outline-none text-[11px] font-bold transition-all shadow-sm"
                        style={{ backgroundColor: "var(--surface)", color: "var(--ink)", borderColor: "var(--border)" }}
                        placeholder="Auto-filled from map or enter manually"
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
                        value={formData.locality_name_input || ""}
                        onChange={handleInputChange}
                        className="w-full h-9 px-3 rounded-xl border outline-none text-[11px] font-bold transition-all shadow-sm"
                        style={{ backgroundColor: "var(--surface)", color: "var(--ink)", borderColor: "var(--border)" }}
                        placeholder="Auto-filled from map or enter manually"
                      />
                    </div>
                  </div>
                </div>
              </fieldset>

                <div className="flex justify-end pt-6 border-t mt-6" style={{ borderColor: "var(--border)" }}>
                  <button
                    onClick={handleNext}
                    className="h-10 px-8 bg-slate-950 hover:bg-slate-900 border border-slate-800/80 text-white text-[11px] font-extrabold uppercase tracking-widest rounded-xl transition-all flex items-center gap-3 shadow-md cursor-pointer"
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
                    <p className="text-[11px] mt-2 font-medium flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                      <span className="material-symbols-outlined text-[13px] text-amber-500">lightbulb</span>
                      Tip: Click "Auto-write with AI ✨" to automatically generate a rich property description based on all your filled specifications, location, price, rules, and amenities above.
                    </p>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-6 border-t mt-6" style={{ borderColor: "var(--border)" }}>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="h-10 px-8 rounded-xl border font-extrabold uppercase tracking-widest transition-all shadow-sm flex items-center gap-2 text-[11px] cursor-pointer"
                    style={{ backgroundColor: "var(--surface-alt)", color: "var(--ink)", borderColor: "var(--border)" }}
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      arrow_back
                    </span>{" "}
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="h-10 px-8 bg-slate-950 hover:bg-slate-900 border border-slate-800/80 text-white text-[11px] font-extrabold uppercase tracking-widest rounded-xl transition-all flex items-center gap-3 shadow-md cursor-pointer"
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
                <div className="mb-1 border-b pb-6" style={{ borderColor: "var(--border)" }}>
                  <h2 className="text-[20px] font-extrabold tracking-tight flex items-center gap-2" style={{ color: "var(--ink)" }}>
                    <span className="material-symbols-outlined text-[24px]" style={{ color: "var(--accent)" }}>
                      perm_media
                    </span>
                    Photos &amp; Audio
                  </h2>
                  <p className="text-[11px] font-medium mt-2" style={{ color: "var(--text-muted)" }}>
                    Upload property photos and record optional audio notes.
                  </p>
                </div>

                <div className="rounded-2xl p-4 sm:p-8 border shadow-inner" style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)" }}>
                  <div className="flex justify-between items-center mb-1">
                    <h3 className="text-[9px] font-extrabold uppercase tracking-widest flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
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
                        ? "border-emerald-500 bg-emerald-500/10 scale-[1.02]"
                        : "hover:border-emerald-500 shadow-sm"
                    }`}
                    style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
                  >
                    <input {...getInputProps()} />
                    <span className="text-[11px] font-extrabold" style={{ color: "var(--ink)" }}>
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

                <div className="rounded-2xl p-4 sm:p-8 border shadow-inner mt-6" style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)" }}>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-[9px] font-extrabold uppercase tracking-widest flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
                      <span className="material-symbols-outlined text-[16px]">
                        mic
                      </span>{" "}
                      Audio Note (Optional)
                    </h3>
                  </div>

                  {!audioURL ? (
                    <div className="flex flex-col items-center justify-center p-4 sm:p-8 border rounded-xl shadow-sm" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
                      <button
                        type="button"
                        onClick={isRecording ? stopRecording : startRecording}
                        className={`w-16 h-16 rounded-full flex items-center justify-center transition-all cursor-pointer ${isRecording ? "bg-red-100 text-red-600 animate-pulse ring-4 ring-red-100" : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 shadow-sm"}`}
                      >
                        <span className="material-symbols-outlined text-[32px]">
                          {isRecording ? "stop" : "mic"}
                        </span>
                      </button>
                      <p className="mt-4 text-[11px] font-bold" style={{ color: "var(--text-muted)" }}>
                        {isRecording
                          ? "Recording..."
                          : "Click to record an audio note for the property"}
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-4 sm:p-8 border border-slate-200 rounded-xl bg-white shadow-sm gap-4">
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

                <div className="flex justify-between items-center pt-6 border-t mt-6" style={{ borderColor: "var(--border)" }}>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="h-10 px-8 rounded-xl border font-extrabold uppercase tracking-widest transition-all shadow-sm flex items-center gap-2 text-[11px] cursor-pointer"
                    style={{ backgroundColor: "var(--surface-alt)", color: "var(--ink)", borderColor: "var(--border)" }}
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      arrow_back
                    </span>{" "}
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="h-10 px-8 bg-slate-950 hover:bg-slate-900 border border-slate-800/80 text-white text-[11px] font-extrabold uppercase tracking-widest rounded-xl transition-all flex items-center gap-3 shadow-md cursor-pointer"
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
              <div className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="mb-1 border-b pb-6" style={{ borderColor: "var(--border)" }}>
                  <h2 className="text-[20px] font-extrabold tracking-tight flex items-center gap-2" style={{ color: "var(--ink)" }}>
                    <span className="material-symbols-outlined text-[24px]" style={{ color: "var(--accent)" }}>
                      payments
                    </span>
                    Onboarding Payment
                  </h2>
                  <p className="text-[11px] font-medium mt-2" style={{ color: "var(--text-muted)" }}>
                    Collect the listing fee from the owner to complete
                    onboarding.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="block text-[9px] font-bold uppercase tracking-widest ml-1" style={{ color: "var(--text-muted)" }}>
                        Onboarding Fee (₹)
                      </label>
                      <div className="w-full h-12 px-4 rounded-xl border flex items-center justify-between shadow-sm" style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)" }}>
                        <span className="text-[18px] font-extrabold" style={{ color: "var(--ink)" }}>
                          ₹{formData.onboarding_fee || "0"}
                        </span>
                        <span className="text-[11px] font-bold uppercase tracking-widest flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                          <span className="material-symbols-outlined text-[16px]">lock</span>
                          Set in Admin Settings
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {(() => {
                        const userRoles = user?.roles || [user?.role];
                        const role = userRoles.includes('admin') ? 'admin' : 'agent';
                        const activeGateway = role === 'admin' ? regConfig?.admin_payment_gateway : regConfig?.agent_payment_gateway;
                        return (
                          <>
                            <label className="block text-[9px] font-bold uppercase tracking-widest ml-1" style={{ color: "var(--text-muted)" }}>
                              Payment Method
                            </label>

                            {activeGateway === 'razorpay' ? (
                              <button
                                onClick={() =>
                                  setFormData((p) => ({
                                    ...p,
                                    onboarding_payment_method: "razorpay",
                                  }))
                                }
                                className="w-full h-12 px-6 rounded-xl border transition-all flex items-center gap-3 cursor-pointer shadow-sm"
                                style={{
                                  backgroundColor: formData.onboarding_payment_method === "razorpay" ? "var(--surface-alt)" : "var(--surface)",
                                  borderColor: formData.onboarding_payment_method === "razorpay" ? "var(--accent)" : "var(--border)",
                                  color: "var(--ink)"
                                }}
                              >
                                <span className="material-symbols-outlined text-[20px] text-[#3366cc]">
                                  shield_lock
                                </span>
                                <span className="text-[11px] font-extrabold tracking-widest uppercase" style={{ color: "var(--ink)" }}>
                                  Razorpay Checkout
                                </span>
                              </button>
                            ) : (
                              <button
                                onClick={() =>
                                  setFormData((p) => ({
                                    ...p,
                                    onboarding_payment_method: "qr",
                                  }))
                                }
                                className="w-full h-12 px-6 rounded-xl border transition-all flex items-center gap-3 cursor-pointer shadow-sm"
                                style={{
                                  backgroundColor: formData.onboarding_payment_method === "qr" ? "var(--surface-alt)" : "var(--surface)",
                                  borderColor: formData.onboarding_payment_method === "qr" ? "var(--accent)" : "var(--border)",
                                  color: "var(--ink)"
                                }}
                              >
                                <span className="material-symbols-outlined text-[20px]" style={{ color: "var(--ink)" }}>
                                  qr_code_scanner
                                </span>
                                <span className="text-[11px] font-extrabold tracking-widest uppercase" style={{ color: "var(--ink)" }}>
                                  UPI QR Code
                                </span>
                              </button>
                            )}
                          </>
                        );
                      })()}

                      <button
                        onClick={() =>
                          setFormData((p) => ({
                            ...p,
                            onboarding_payment_method: "cash",
                          }))
                        }
                        className={`w-full h-10 px-6 rounded-xl border transition-all flex items-center gap-3 ${formData.onboarding_payment_method === "cash" ? "bg-orange-50 border-orange-500 shadow-sm ring-2 ring-orange-500/20" : "bg-white border-slate-200 hover:bg-slate-50 shadow-sm"}`}
                      >
                        <span className="material-symbols-outlined text-[20px] text-emerald-600">
                          payments
                        </span>
                        <span className="text-[9px] font-extrabold text-slate-800 tracking-widest uppercase">
                          Cash Collected
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-2xl border border-slate-100 shadow-inner p-4 sm:p-8 flex flex-col items-center justify-center min-h-[300px]">
                    {!formData.onboarding_payment_method && (
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest text-center">
                        Select a payment method
                        <br />
                        to continue.
                      </p>
                    )}

                    {formData.onboarding_payment_method === "razorpay" && (
                      <div className="flex flex-col items-center text-center animate-in zoom-in duration-300 w-full max-w-xs">
                        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center border border-blue-100 mb-4 shadow-inner">
                          <span className="material-symbols-outlined text-[32px] text-blue-600">
                            lock
                          </span>
                        </div>
                        <h3 className="text-[16px] font-extrabold text-slate-900 mb-1">
                          Secure Payment
                        </h3>
                        <p className="text-[9px] text-slate-500 mb-6">
                          Hand the device to the owner so they can pay securely via Credit Card, NetBanking, or UPI.
                        </p>
                        
                        <button
                          type="button"
                          onClick={handleRazorpayPayment}
                          className="w-full h-9 bg-[#3366cc] hover:bg-[#2b56ad] text-white text-[9px] font-bold uppercase tracking-widest rounded-xl transition-colors shadow-lg flex items-center justify-center gap-2"
                        >
                          <span className="material-symbols-outlined text-[20px]">payment</span>
                          Open Razorpay
                        </button>
                        
                        <p className="text-[9px] text-slate-400 mt-4">
                          The property will automatically submit once payment succeeds.
                        </p>
                      </div>
                    )}

                    {formData.onboarding_payment_method === "qr" && (
                      <div className="flex flex-col items-center text-center animate-in zoom-in duration-300 w-full max-w-xs">
                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-4">
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
                              `upi://pay?pa=${formData.target_upi_id}&pn=Rentlo&am=${formData.onboarding_fee || 0}&cu=INR`
                            )}`}
                            alt="UPI QR Code"
                            className="w-48 h-48 rounded-lg"
                          />
                        </div>
                        <p className="text-[11px] font-bold text-slate-800">
                          Ask owner to scan and pay{" "}
                          <span className="text-orange-600">
                            ₹{formData.onboarding_fee || 0}
                          </span>
                        </p>
                        <p className="text-[9px] font-semibold text-slate-500 mt-1">
                          UPI ID: <span className="font-mono text-slate-800 font-bold">{formData.target_upi_id}</span>
                        </p>
                        <p className="text-[9px] text-slate-400 mt-1">
                          Mark as paid after receiving SMS confirmation.
                        </p>
                      </div>
                    )}

                    {formData.onboarding_payment_method === "cash" && (
                      <div className="flex flex-col items-center text-center animate-in zoom-in duration-300">
                        <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center border border-emerald-100 mb-4 shadow-inner">
                          <span className="material-symbols-outlined text-[40px] text-emerald-500">
                            done_all
                          </span>
                        </div>
                        <h3 className="text-[16px] font-extrabold text-slate-900 mb-1">
                          Cash Verification
                        </h3>
                        <p className="text-[9px] text-slate-500 text-center max-w-[200px] mb-4">
                          Ensure you have physically collected{" "}
                          <strong className="text-slate-800">
                            ₹{formData.onboarding_fee || 0}
                          </strong>{" "}
                          before submitting.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center pt-6 border-t mt-6" style={{ borderColor: "var(--border)" }}>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="h-10 px-8 rounded-xl border font-extrabold uppercase tracking-widest transition-all shadow-sm flex items-center gap-2 text-[11px] cursor-pointer"
                    style={{ backgroundColor: "var(--surface-alt)", color: "var(--ink)", borderColor: "var(--border)" }}
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      arrow_back
                    </span>{" "}
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={
                      isSubmitting || !formData.onboarding_payment_method || formData.onboarding_payment_method === 'razorpay'
                    }
                    className="h-10 px-10 bg-slate-950 hover:bg-slate-900 border border-slate-800/80 text-white text-[11px] font-extrabold uppercase tracking-widest rounded-xl transition-all flex items-center gap-3 shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="material-symbols-outlined animate-spin text-[20px]">
                          progress_activity
                        </span>{" "}
                        Creating Listing...
                      </>
                    ) : (
                      <>
                        Complete & Submit{" "}
                        <span className="material-symbols-outlined text-[24px]">
                          check_circle
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showCameraModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden max-w-lg w-full shadow-2xl flex flex-col items-center animate-in zoom-in duration-200">
            <div className="w-full px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-white font-extrabold text-[12px] flex items-center gap-2">
                <span className="material-symbols-outlined text-orange-500">photo_camera</span>
                Live Camera Capture
              </h3>
              <button
                type="button"
                onClick={closeCamera}
                className="text-slate-400 hover:text-white p-1 rounded-full transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
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

            <div className="w-full p-6 bg-slate-900 flex items-center justify-center gap-4 border-t border-slate-800">
              <button
                type="button"
                onClick={closeCamera}
                className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[9px] font-extrabold uppercase tracking-widest rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={capturePhotoFromCamera}
                className="px-8 py-3 bg-orange-600 hover:bg-orange-500 text-white text-[9px] font-extrabold uppercase tracking-widest rounded-xl shadow-lg shadow-orange-600/30 transition-all flex items-center gap-2 transform hover:scale-105 active:scale-95"
              >
                <span className="material-symbols-outlined text-[18px]">photo_camera</span>
                Capture Photo
              </button>
            </div>
          </div>
        </div>
      )}

      {showSelfieCamera && (
        <div className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden max-w-md w-full shadow-2xl flex flex-col items-center animate-in zoom-in duration-300">
            <div className="w-full px-6 py-4 border-b border-slate-800/80 flex items-center justify-between">
              <h3 className="text-white font-extrabold text-[12px] flex items-center gap-2 uppercase tracking-wider">
                <span className="material-symbols-outlined text-orange-500 text-[18px]">face</span>
                Capture Owner Selfie
              </h3>
              <button type="button" onClick={closeSelfieCamera} className="text-slate-400 hover:text-white p-1 rounded-full transition-colors cursor-pointer">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="relative w-full h-[360px] bg-black flex items-center justify-center overflow-hidden">
              <video
                ref={selfieVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover scale-x-[-1]"
              />
              <canvas ref={selfieCanvasRef} className="hidden" />
              
              {/* Selfie Frame Guide Overlay */}
              <div className="absolute inset-0 border-[32px] border-slate-950/50 pointer-events-none flex items-center justify-center">
                <div 
                  className={`w-[200px] h-[260px] rounded-[110px] border-2 border-dashed transition-all duration-300 ${faceDetected ? 'border-emerald-500' : faceMisaligned ? 'border-red-500' : 'border-orange-500'}`}
                  style={{ 
                    boxShadow: faceDetected 
                      ? "0 0 0 9999px rgba(6, 78, 59, 0.45)" 
                      : faceMisaligned 
                      ? "0 0 0 9999px rgba(153, 27, 27, 0.45)" 
                      : "0 0 0 9999px rgba(15,23,42,0.6)" 
                  }}
                >
                  <div className={`absolute top-[35%] left-1/2 -translate-x-1/2 w-4 h-1 rounded transition-colors duration-300 ${faceDetected ? 'bg-emerald-500/60' : faceMisaligned ? 'bg-red-500/60' : 'bg-orange-500/60'}`}></div>
                  <div className={`absolute top-[52%] left-1/2 -translate-x-1/2 w-10 h-0.5 rounded transition-colors duration-300 ${faceDetected ? 'bg-emerald-500/60' : faceMisaligned ? 'bg-red-500/60' : 'bg-orange-500/60'}`}></div>
                </div>
              </div>
            </div>

            <div className="w-full p-5 bg-slate-900 flex items-center justify-center gap-3 border-t border-slate-800/60">
              <button type="button" onClick={closeSelfieCamera} className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[9px] font-extrabold uppercase tracking-widest rounded-xl transition-all cursor-pointer">
                Cancel
              </button>
              <button 
                type="button" 
                onClick={captureSelfie} 
                className={`px-6 py-2.5 text-white text-[9px] font-extrabold uppercase tracking-widest rounded-xl shadow-lg transition-all flex items-center gap-1.5 cursor-pointer duration-300 ${faceDetected ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20' : faceMisaligned ? 'bg-red-600 hover:bg-red-500 shadow-red-600/20' : 'bg-orange-600 hover:bg-orange-500 shadow-orange-600/20'}`}
              >
                <span className="material-symbols-outlined text-[16px]">{faceDetected ? 'check_circle' : faceMisaligned ? 'warning' : 'photo_camera'}</span>
                {faceDetected ? 'Face Detected - Capture' : faceMisaligned ? 'Align Face to Circle' : 'Capture Selfie'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};
