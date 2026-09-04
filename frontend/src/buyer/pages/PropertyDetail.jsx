import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Circle, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import QRCode from "react-qr-code";
import { OtpModal } from "../components/OtpModal";
import { ProfileCompletionModal } from "../components/ProfileCompletionModal";
import { PlanSelectionModal } from "../components/PlanSelectionModal";
import { useAuth } from "../../shared/context/AuthContext";
import { SeoHead } from "../../shared/components/SeoHead";
import { getWhatsAppShareLink, getGoogleMapsLink } from "../../shared/qrCodeUtils";
import { handleApiError } from "../../shared/utils/errorHandler";
import { loadRazorpayScript } from "../../shared/utils/razorpayLoader";
import { toast } from "react-toastify";
import { Translate } from "../../shared/components/Translate";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const getAmenityIcon = (name) => {
  const lower = (name || '').toLowerCase();
  if (lower.includes('wifi') || lower.includes('wi-fi') || lower.includes('internet')) return 'wifi';
  if (lower.includes('security') || lower.includes('guard')) return 'shield';
  if (lower.includes('gym') || lower.includes('fitness')) return 'fitness_center';
  if (lower.includes('swimming') || lower.includes('pool')) return 'pool';
  if (lower.includes('clubhouse') || lower.includes('club')) return 'deck';
  if (lower.includes('power') || lower.includes('backup') || lower.includes('generator')) return 'bolt';
  if (lower.includes('lift') || lower.includes('elevator')) return 'elevator';
  if (lower.includes('gas') || lower.includes('pipeline')) return 'propane_tank';
  if (lower.includes('ac') || lower.includes('air conditioning') || lower.includes('air conditioner')) return 'ac_unit';
  if (lower.includes('parking') || lower.includes('garage')) return 'local_parking';
  if (lower.includes('water') || lower.includes('geyser') || lower.includes('hot water')) return 'water_drop';
  if (lower.includes('washroom') || lower.includes('bathroom') || lower.includes('bath')) return 'shower';
  if (lower.includes('housekeeping') || lower.includes('cleaning') || lower.includes('maid')) return 'cleaning_services';
  if (lower.includes('tv') || lower.includes('television')) return 'tv';
  if (lower.includes('fridge') || lower.includes('refrigerator')) return 'kitchen';
  if (lower.includes('laundry') || lower.includes('washing')) return 'local_laundry_service';
  if (lower.includes('balcony')) return 'balcony';
  if (lower.includes('garden') || lower.includes('park') || lower.includes('lawn')) return 'yard';
  if (lower.includes('cctv') || lower.includes('camera')) return 'videocam';
  if (lower.includes('food') || lower.includes('meal') || lower.includes('mess')) return 'restaurant';
  return 'verified';
};

export const PropertyDetail = () => {
  const { id } = useParams();
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [paymentFailed, setPaymentFailed] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [showBuyerUpiModal, setShowBuyerUpiModal] = useState(false);
  const [buyerUpiConfig, setBuyerUpiConfig] = useState(null);
  const [buyerUtr, setBuyerUtr] = useState("");
  const [buyerUtrSubmitting, setBuyerUtrSubmitting] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackUnlockId, setFeedbackUnlockId] = useState(null);
  const [feedbackAccurate, setFeedbackAccurate] = useState(null);
  const [feedbackReason, setFeedbackReason] = useState("already_rented");
  const [feedbackNote, setFeedbackNote] = useState("");
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackResultMsg, setFeedbackResultMsg] = useState("");
  const [unlockSuccess, setUnlockSuccess] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [show3DTour, setShow3DTour] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [mobileSlideIndex, setMobileSlideIndex] = useState(0);

  // Auto-slide every 3 seconds for mobile photo slideshow
  useEffect(() => {
    const mediaCount = (property?.media || []).length;
    if (mediaCount <= 1) return;

    const timer = setInterval(() => {
      setMobileSlideIndex((prev) => (prev + 1) % mediaCount);
    }, 3000);

    return () => clearInterval(timer);
  }, [property?.media]);
  const [similarProperties, setSimilarProperties] = useState([]);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [visitSlots, setVisitSlots] = useState([]);
  const [platformSettings, setPlatformSettings] = useState(null);
  const [bookingSlot, setBookingSlot] = useState(null);
  const [bookingNote, setBookingNote] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [showQrModal, setShowQrModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [userSub, setUserSub] = useState(null);

  const amenitiesList = React.useMemo(() => {
    if (!property) return [];
    let items = [];
    const collect = (val) => {
      if (!val) return;
      if (Array.isArray(val)) {
        items.push(...val);
      } else if (typeof val === 'string') {
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed)) items.push(...parsed);
          else items.push(val);
        } catch (e) {
          items.push(...val.split(',').map(s => s.trim()).filter(Boolean));
        }
      }
    };
    collect(property.amenities);
    collect(property.pg_amenities);
    return Array.from(new Set(items.filter(Boolean)));
  }, [property?.amenities, property?.pg_amenities]);

  const navigate = useNavigate();
  const { user, loading: authLoading, checkAuth } = useAuth();

  useEffect(() => {
    if (user) {
      fetch(`${import.meta.env.VITE_API_URL}/my-subscription/`, { credentials: "include" })
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) setUserSub(data); })
        .catch(err => console.error(err));
    } else {
      setUserSub(null);
    }
  }, [user]);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  const executeAction = (type, href) => {
    if (type === "chat") {
      navigate(`/chat/${property.id}`);
    } else if (type === "lease") {
      navigate(`/property/${property.id}/lease`);
    } else if (type === "phone" && href) {
      window.location.href = href;
    }
  };

  const handleProtectedAction = (e, type, href) => {
    e.preventDefault();
    if (!user) {

      setPendingAction({ type, href });
      setShowLoginModal(true);
      return;
    }
    if (!user.first_name || !user.phone) {
      setPendingAction({ type, href });
      setShowProfileModal(true);
      return;
    }
    executeAction(type, href);
  };

  const handleProfileSuccess = () => {
    setShowProfileModal(false);
    setShowLoginModal(false);
    if (!pendingAction) return;
    executeAction(pendingAction.type, pendingAction.href);
    setPendingAction(null);
  };

  const handleSlotClick = (slot) => {
    if (!user) {
      setShowOtpModal(true);
      return;
    }
    setBookingSlot(slot);
  };

  useEffect(() => {
    const handleScroll = () => {
      const totalScroll = document.documentElement.scrollTop;
      const windowHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const scroll = totalScroll / windowHeight;
      setScrollProgress(scroll);
    };
    window.addEventListener('scroll', handleScroll);
    // Clear any stale payment error on fresh page load
    setPaymentFailed(false);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);


  const handleBuyerUpiSubmit = async () => {
    setBuyerUtrSubmitting(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/properties/${id}/unlock/verify/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          payment_method: 'upi',
          utr: buyerUtr,
          property_id: id
        })
      });
      if (res.ok) {
        const fullData = await res.json();
        setShowBuyerUpiModal(false);
        setProperty((prev) =>
          prev
            ? {
                ...prev,
                is_unlocked: true,
                exact_lat: fullData.exact_lat,
                exact_lng: fullData.exact_lng,
                display_lat: fullData.exact_lat,
                display_lng: fullData.exact_lng,
                owner_name_display: fullData.owner_name,
                owner_phone_display: fullData.owner_phone,
                unlock_id: fullData.unlock_id,
              }
            : null,
        );
        toast.success("Payment UTR submitted and instantly verified! You now have full access to owner details.");
        setUnlockSuccess(true);
        if (fullData.unlock_id) {
          setFeedbackUnlockId(fullData.unlock_id);
          setTimeout(() => setShowFeedbackModal(true), 3000);
        }
      } else {
        let errData;
        try {
          errData = await res.json();
        } catch (e) {
          errData = { detail: `Server error: ${res.status}` };
        }
        handleApiError(res, errData, "Failed to verify UTR. Please double-check your 12-digit UPI transaction number.");
      }
    } catch (err) {
      handleApiError(null, err, "Unable to connect to server while verifying UTR.");
    } finally {
      setBuyerUtrSubmitting(false);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackUnlockId || feedbackAccurate === null) return;
    setFeedbackLoading(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/unlocks/${feedbackUnlockId}/feedback/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            is_accurate: feedbackAccurate,
            reason: !feedbackAccurate ? feedbackReason : "",
            note: feedbackNote,
          }),
          credentials: "include",
        },
      );
      const data = await res.json();
      if (res.ok) {
        setFeedbackResultMsg(data.detail || "Feedback submitted successfully!");
        setFeedbackSubmitted(true);
        setTimeout(() => setShowFeedbackModal(false), 2500);
      } else {
        toast.error(data.detail || "Failed to submit feedback.");
      }
    } catch {
      toast.error("Network error submitting feedback.");
    } finally {
      setFeedbackLoading(false);
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    setLoading(true);
    
    const controller = new AbortController();
    const signal = controller.signal;

    const fetchProp = async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_URL}/properties/public/${id}/?_t=${Date.now()}`,
          { credentials: "include", signal },
        );
        if (res.ok) setProperty(await res.json());
        else setError(`Fetch failed with status ${res.status}`);
      } catch (err) {
        if (err.name === 'AbortError') return;
        setError(`Exception: ${err.message}`);
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    };
    
    const fetchSimilar = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/properties/public/${id}/similar/`, { signal });
        if (res.ok) {
          setSimilarProperties(await res.json());
        }
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error("Failed to fetch similar properties", err);
      }
    };

    fetchProp();
    fetchSimilar();

    // Fetch platform settings
    fetch(`${import.meta.env.VITE_API_URL}/properties/platform-settings/`, { signal })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (!signal.aborted && data) setPlatformSettings(data); })
      .catch((err) => { if (err.name !== 'AbortError') console.error(err); });

    // Fetch visit slots
    fetch(`${import.meta.env.VITE_API_URL}/visits/property/${id}/slots/`, { credentials: "include", signal })
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (!signal.aborted) setVisitSlots(data); })
      .catch((err) => { if (err.name !== 'AbortError') console.error(err); });
      
    return () => controller.abort();
  }, [id, user, authLoading]);

  const handleUnlock = async (name, phone) => {
    setUnlocking(true);
    setPaymentFailed(false);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/properties/${id}/unlock/initiate/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ guest_phone: phone })
        },
      );
      if (res.ok) {
        const data = await res.json();
        
        if (data.instant_unlocked) {
          setProperty((prev) =>
            prev
              ? {
                  ...prev,
                  is_unlocked: true,
                  exact_lat: data.exact_lat,
                  exact_lng: data.exact_lng,
                  display_lat: data.exact_lat,
                  display_lng: data.exact_lng,
                  owner_name_display: data.owner_name,
                  owner_phone_display: data.owner_phone,
                  unlock_id: data.unlock_id,
                }
              : null,
          );
          setUnlockSuccess(true);
          if (data.credits_remaining !== undefined) {
            setUserSub((prev) => prev ? { ...prev, credits_remaining: data.credits_remaining } : prev);
          }
          setUnlocking(false);
          if (data.unlock_id) {
            setFeedbackUnlockId(data.unlock_id);
            setTimeout(() => setShowFeedbackModal(true), 3000);
          }
          return;
        }

        if (data.payment_gateway === 'upi') {
          setBuyerUpiConfig(data);
          setShowBuyerUpiModal(true);
          setUnlocking(false);
          return;
        }

        const options = {
          key: data.key_id || data.razorpay_key_id,
          amount: data.amount,
          currency: data.currency,
          name: "Rentlo",
          description: "Unlock Property Details",
          order_id: data.order_id,
          prefill: { name: name || "", contact: phone || "" },
          theme: { color: "#C77D3B" },
          modal: { ondismiss: () => setUnlocking(false) },
          handler: async (response) => {
            try {
              const vRes = await fetch(
                `${import.meta.env.VITE_API_URL}/properties/${id}/unlock/verify/`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_signature: response.razorpay_signature,
                    guest_phone: phone
                  }),
                },
              );
              if (vRes.ok) {
                const fullData = await vRes.json();
                setProperty((prev) =>
                  prev
                    ? {
                        ...prev,
                        is_unlocked: true,
                        exact_lat: fullData.exact_lat,
                        exact_lng: fullData.exact_lng,
                        display_lat: fullData.exact_lat,
                        display_lng: fullData.exact_lng,
                        owner_name_display: fullData.owner_name,
                        owner_phone_display: fullData.owner_phone,
                        unlock_id: fullData.unlock_id,
                      }
                    : null,
                );
                setUnlocking(false);
                setUnlockSuccess(true);
                if (fullData.unlock_id) {
                  setFeedbackUnlockId(fullData.unlock_id);
                  setTimeout(() => setShowFeedbackModal(true), 3000);
                }
              } else {
                setPaymentFailed(true);
                setUnlocking(false);
              }
            } catch {
              setPaymentFailed(true);
              setUnlocking(false);
            }
          },
        };
        await loadRazorpayScript();
        if (!window.Razorpay) {
          toast.error("Unable to load Razorpay SDK. Please check your internet connection.");
          setUnlocking(false);
          return;
        }
        const rzp = new window.Razorpay(options);
        rzp.on("payment.failed", () => {
          setUnlocking(false);
          setPaymentFailed(true);
        });
        rzp.open();
      } else {
        if (res.status === 403 || res.status === 401) {
          setShowOtpModal(true);
          setUnlocking(false);
        } else {
          setPaymentFailed(true);
          setUnlocking(false);
        }
      }
    } catch {
      setPaymentFailed(true);
      setUnlocking(false);
    }
  };


  if (loading)
    return (
      <div className="w-full max-w-[1600px] mx-auto px-4 md:px-10 py-12 flex flex-col gap-10 min-h-screen">
        <div className="w-full h-[480px] rounded-card skeleton-box"></div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-8 flex flex-col gap-6 md:gap-8">
            <div className="h-16 w-3/4 skeleton-box rounded-lg"></div>
            <div className="flex gap-4">
               <div className="h-12 w-1/4 skeleton-box rounded-lg"></div>
               <div className="h-12 w-1/4 skeleton-box rounded-lg"></div>
               <div className="h-12 w-1/4 skeleton-box rounded-lg"></div>
            </div>
            <div className="h-6 w-full skeleton-box rounded-lg"></div>
            <div className="h-6 w-full skeleton-box rounded-lg"></div>
            <div className="h-6 w-5/6 skeleton-box rounded-lg"></div>
          </div>
          <div className="lg:col-span-4">
            <div className="h-64 w-full skeleton-box rounded-card"></div>
          </div>
        </div>
      </div>
    );
  if (error || !property)
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center font-sans"
        style={{ backgroundColor: "var(--bg)", color: "var(--danger)" }}
      >
        <span className="text-xl font-bold">Property not found</span>
        <span className="text-sm mt-2">{typeof error === 'string' ? error : 'Property is null'}</span>
      </div>
    );

  const isUnlocked = property.is_unlocked;

  const fetchVisitSlots = async () => {
    try {
      const r = await fetch(`${import.meta.env.VITE_API_URL}/visits/property/${id}/slots/`, {
        credentials: "include",
      });
      if (r.ok) setVisitSlots(await r.json());
    } catch {}
  };

  const bookSlot = async (slotId) => {
    setBookingLoading(true);
    try {
      const r = await fetch(`${import.meta.env.VITE_API_URL}/visits/slots/${slotId}/book/`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          note: bookingNote
        }),
      });
      if (r.ok) {
        toast.success("Visit slot booked successfully!");
        setBookingSlot(null);
        setBookingNote("");
        fetchVisitSlots();
      } else {
        const err = await r.json().catch(() => ({}));
        handleApiError(r, err, "Failed to book visit slot. Please try another slot.");
      }
    } catch (err) {
      handleApiError(null, err, "Unable to connect to server while booking slot.");
    } finally {
      setBookingLoading(false);
    }
  };

  const renderGalleryGrid = () => {
    const media = property.media || [];
    const count = media.length;

    if (count === 0) {
      return (
        <div
          className="w-full h-[300px] sm:h-[400px] rounded-3xl flex items-center justify-center border border-slate-200"
          style={{ backgroundColor: "var(--surface)" }}
        >
          <span className="material-symbols-outlined text-[40px] text-text-muted opacity-50">home_work</span>
        </div>
      );
    }

    const openGallery = (index) => {
      setCurrentImageIndex(index);
      setShowGallery(true);
    };

    return (
      <div className="w-full">
        {/* ─── Mobile Auto-Sliding Carousel (md:hidden) ─── */}
        <div
          className="md:hidden relative w-full h-[36vh] sm:h-[45vh] rounded-3xl overflow-hidden shadow-md border border-slate-200/80 bg-slate-950 cursor-pointer select-none group"
          onClick={() => openGallery(mobileSlideIndex)}
        >
          {media.map((item, idx) => (
            <div
              key={item.id || idx}
              className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                mobileSlideIndex === idx ? "opacity-100 z-10" : "opacity-0 pointer-events-none z-0"
              }`}
            >
              <img
                src={item.image_url}
                alt={`Property Photo ${idx + 1}`}
                loading={idx === 0 ? "eager" : "lazy"}
                decoding={idx === 0 ? "sync" : "async"}
                className="w-full h-full object-cover"
              />
            </div>
          ))}
        </div>

        {/* ─── Desktop Multi-Grid (hidden md:grid) ─── */}
        {count === 1 ? (
          <div
            className="hidden md:block w-full h-[45vh] lg:h-[55vh] overflow-hidden cursor-pointer group rounded-3xl border border-slate-200 shadow-xs"
            onClick={() => openGallery(0)}
          >
            <img
              src={media[0].image_url}
              alt="Main"
              loading="eager"
              decoding="sync"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </div>
        ) : count === 2 ? (
          <div className="hidden md:grid grid-cols-2 gap-2 h-[45vh] lg:h-[55vh] overflow-hidden cursor-pointer rounded-3xl border border-slate-200 shadow-xs">
            <div className="overflow-hidden group" onClick={() => openGallery(0)}>
              <img src={media[0].image_url} loading="eager" decoding="sync" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
            </div>
            <div className="overflow-hidden group" onClick={() => openGallery(1)}>
              <img src={media[1].image_url} loading="lazy" decoding="async" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
            </div>
          </div>
        ) : count === 3 ? (
          <div className="hidden md:grid grid-cols-4 grid-rows-2 gap-2 h-[45vh] lg:h-[55vh] overflow-hidden cursor-pointer rounded-3xl border border-slate-200/80 shadow-xs">
            <div className="col-span-2 row-span-2 overflow-hidden group" onClick={() => openGallery(0)}>
              <img src={media[0].image_url} loading="eager" decoding="sync" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
            </div>
            <div className="col-span-2 row-span-1 overflow-hidden group" onClick={() => openGallery(1)}>
              <img src={media[1].image_url} loading="lazy" decoding="async" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
            </div>
            <div className="col-span-2 row-span-1 overflow-hidden group" onClick={() => openGallery(2)}>
              <img src={media[2].image_url} loading="lazy" decoding="async" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
            </div>
          </div>
        ) : (
          <div className="hidden md:grid grid-cols-4 grid-rows-2 gap-2 h-[48vh] lg:h-[58vh] overflow-hidden cursor-pointer rounded-3xl border border-slate-200/80 shadow-xs">
            {/* Main image: Left 50% width */}
            <div className="col-span-2 row-span-2 overflow-hidden group" onClick={() => openGallery(0)}>
              <img src={media[0].image_url} loading="eager" decoding="sync" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
            </div>
            {/* Small 1 */}
            <div className="col-span-1 row-span-1 overflow-hidden group" onClick={() => openGallery(1)}>
              <img src={media[1].image_url} loading="lazy" decoding="async" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
            </div>
            {/* Small 2 */}
            <div className="col-span-1 row-span-1 overflow-hidden group" onClick={() => openGallery(2)}>
              <img src={media[2].image_url} loading="lazy" decoding="async" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
            </div>
            {/* Small 3 */}
            <div className="col-span-1 row-span-1 overflow-hidden group" onClick={() => openGallery(3)}>
              <img src={media[3].image_url} loading="lazy" decoding="async" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
            </div>
            {/* Small 4 / Show More Overlay */}
            <div className="col-span-1 row-span-1 overflow-hidden relative group" onClick={() => openGallery(4)}>
              <img src={media[4].image_url} loading="lazy" decoding="async" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
              {count > 5 && (
                <div
                  className="absolute inset-0 flex items-center justify-center flex-col transition-all hover:bg-black/40 duration-300"
                  style={{ backgroundColor: "rgba(11,12,14,0.55)", backdropFilter: "blur(4px)" }}
                >
                  <span className="material-symbols-outlined text-[26px] mb-1 text-white">photo_library</span>
                  <span className="text-[13px] font-black tracking-wide text-white">+{count - 5} Photos</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="w-full flex flex-col font-sans pb-28 md:pb-0"
      style={{ backgroundColor: "var(--bg)", color: "var(--ink)" }}
    >
      <SeoHead
        title={`${property.title} — ₹${Number(property.price || 0).toLocaleString('en-IN')} | Rentlo`}
        description={`${property.property_type ? property.property_type.toUpperCase() : 'Property'} for rent in ${property.locality_name || 'India'}. ${property.description ? property.description.substring(0, 140) : ''}... Contact owner directly on Rentlo with Zero Brokerage.`}
        keywords={`Rentlo, ${property.title}, ${property.property_type} rent, property in ${property.locality_name || 'India'}, zero brokerage`}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "SingleFamilyResidence",
          "name": property.title,
          "description": property.description,
          "address": {
            "@type": "PostalAddress",
            "addressLocality": property.locality_name || "India",
            "addressCountry": "IN"
          },
          "offers": {
            "@type": "Offer",
            "price": property.price,
            "priceCurrency": "INR"
          }
        }}
      />
      <div className="progress-bar" style={{ width: `${scrollProgress * 100}%` }}></div>
      {/* Cinematic Hero Gallery */}
      <div className="w-full max-w-[1600px] mx-auto px-4 md:px-10 mt-6 animate-in fade-in duration-300">
         {renderGalleryGrid()}
      </div>
      <main className="flex-grow w-full max-w-[1600px] mx-auto px-4 md:px-10 py-6 md:py-12 grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-10 relative z-10">
        {/* ─── Left: Details ─── */}
        <div className="lg:col-span-8 flex flex-col gap-10">

          {property.virtual_tour_url && (
            <button 
              onClick={() => setShow3DTour(true)}
              className="mt-4 w-full h-14 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg hover:scale-[1.01]"
            >
              <span className="material-symbols-outlined text-[20px]">360</span>
              View 3D Virtual Tour
            </button>
          )}

          {/* Title & Info */}
          <div className="flex flex-col gap-5">
            <div className="flex flex-col md:flex-row justify-between items-start gap-4">
              <h1
                className="font-display font-semibold leading-tight tracking-tight capitalize"
                style={{
                  fontSize: "clamp(22px, 3.5vw, 36px)",
                  color: "var(--ink)",
                }}
              >
                <Translate>{property.display_title || property.property_type}</Translate>
              </h1>
              {property.property_category !== 'pg' && !property.property_type?.includes('pg') && (
                <div className="text-right flex-shrink-0">
                  <span
                    className="font-display font-semibold leading-none"
                    style={{
                      fontSize: "clamp(24px,3.5vw,40px)",
                      color: "var(--ink)",
                    }}
                  >
                    &#8377;{parseFloat(property.price || 0).toLocaleString('en-IN')}
                    <span className="text-[12px] font-bold text-[var(--text-muted)] ml-1">/mo</span>
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold"
                style={{
                  backgroundColor: "var(--surface)",
                  color: "var(--text-muted)",
                  border: "1px solid var(--border)",
                }}
              >
                <span
                  className="material-symbols-outlined text-[18px]"
                  style={{ color: "var(--accent)" }}
                >
                  location_on
                </span>
                <Translate>
                  {property.locality_details
                    ? `${property.locality_details.name}, ${property.locality_details.city_name}`
                    : "Unknown Location"}
                </Translate>
              </div>
              
              {property.display_address && (
                <div
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold"
                  style={{
                    backgroundColor: "var(--surface)",
                    color: property.is_unlocked ? "var(--ink)" : "var(--text-muted)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <span
                    className="material-symbols-outlined text-[18px]"
                    style={{ color: property.is_unlocked ? "var(--accent)" : "var(--text-muted)" }}
                  >
                    {property.is_unlocked ? "home_pin" : "lock"}
                  </span>
                  <Translate>{property.display_address}</Translate>
                </div>
              )}
              {property.built_up_area && (
                <span
                  className="px-3 py-2.5 rounded-xl text-[13px] font-semibold flex items-center gap-1.5 bg-accent-soft/10 text-accent border border-accent-soft/20"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    square_foot
                  </span>{" "}
                  {property.built_up_area} sq.ft.
                </span>
              )}
              {property.bedrooms && (
                <span
                  className="px-3 py-2.5 rounded-xl text-[13px] font-semibold flex items-center gap-1.5 bg-accent-soft/10 text-accent border border-accent-soft/20"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    bed
                  </span>{" "}
                  {property.bedrooms} Bed
                </span>
              )}
              {property.bathrooms && (
                <span
                  className="px-3 py-2.5 rounded-xl text-[13px] font-semibold flex items-center gap-1.5 bg-accent-soft/10 text-accent border border-accent-soft/20"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    shower
                  </span>{" "}
                  {property.bathrooms} Bath
                </span>
              )}

              {/* WhatsApp / Social Share Action Button */}
              <button
                type="button"
                onClick={() => {
                  const title = property.display_title || property.title || "Verified Property";
                  const price = parseFloat(property.price || 0).toLocaleString("en-IN");
                  const loc = property.locality_details ? `${property.locality_details.name}, ${property.locality_details.city_name}` : "Hubli-Dharwad";
                  const shareUrl = `${window.location.origin}/property/${property.id}`;
                  const text = `🏠 Check out this verified property on Rentlo (Zero Brokerage):\n*${title}*\n📍 ${loc}\n💰 ₹${price}/month\n\n👉 View details & photos: ${shareUrl}`;

                  if (navigator.share) {
                    navigator.share({
                      title: title,
                      text: text,
                      url: shareUrl,
                    }).catch(() => {});
                  } else {
                    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
                  }
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-black uppercase tracking-wider bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 shadow-xs transition-all cursor-pointer active:scale-95 ml-auto"
                title="Share this listing on WhatsApp"
              >
                <span className="material-symbols-outlined text-[18px] text-emerald-600">share</span>
                <span>Share on WhatsApp</span>
              </button>
              {property.property_category === 'pg' && (
                <div className="flex flex-col gap-2 w-full mt-1">
                  {property.pg_gender && (
                    <span className="px-4 py-2.5 rounded-xl text-[13px] font-black flex items-center gap-2 border w-fit bg-black text-white border-black shadow-2xs">
                      <span className="material-symbols-outlined text-[18px] text-white">
                        {property.pg_gender === 'boys' ? 'male' : property.pg_gender === 'girls' ? 'female' : 'group'}
                      </span>
                      {property.pg_gender === 'boys' ? 'Boys PG Only 👦' : property.pg_gender === 'girls' ? 'Girls PG Only 👧' : 'Co-Living (Both Boys & Girls) 👫'}
                    </span>
                  )}
                  <span
                    className={`px-4 py-2.5 rounded-xl text-[13px] font-extrabold flex items-center gap-2 border w-fit ${
                      property.food_preference === 'no_food'
                        ? 'bg-[var(--border)] text-[var(--ink)] border-slate-300'
                        : 'bg-white text-black border-slate-300'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {property.food_preference === 'no_food' ? 'no_meals' : property.food_preference === 'veg' ? 'eco' : 'restaurant'}
                    </span>{" "}
                    {property.food_preference === 'no_food'
                      ? 'Rent Excludes Food'
                      : property.food_preference === 'veg'
                      ? 'Rent Includes Veg Food 🍱'
                      : 'Rent Includes Food (Veg & Non-Veg) 🍱'}
                  </span>

                  {property.food_preference !== 'no_food' && (
                    <div className="flex items-center gap-2 flex-wrap text-[12px] font-extrabold text-black bg-white px-4 py-2 rounded-xl border border-slate-300 w-fit">
                      <span className="material-symbols-outlined text-[16px] text-black">schedule</span>
                      <span>Included Meals:</span>
                      {(Array.isArray(property.pg_food_provided) && property.pg_food_provided.length > 0
                        ? property.pg_food_provided
                        : ["Morning (Breakfast)", "Afternoon (Lunch)", "Night (Dinner)"]
                      ).map((m) => (
                        <span key={m} className="bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200 flex items-center gap-1">
                          {m.includes('Morning') || m.includes('Breakfast') ? '🌅 Morning' : m.includes('Afternoon') || m.includes('Lunch') ? '☀️ Afternoon' : '🌙 Night'}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Amenities directly on top */}
              {amenitiesList && amenitiesList.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap w-full mt-2 pt-3 border-t border-slate-200">
                  <span className="text-[12px] font-black text-[var(--ink)] flex items-center gap-1 mr-1">
                    <span className="material-symbols-outlined text-[18px] text-[var(--accent)]">
                      verified
                    </span>
                    Amenities:
                  </span>
                  {amenitiesList.map((amenity) => (
                    <span
                      key={amenity}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12.5px] font-bold shadow-2xs transition-colors"
                      style={{
                        backgroundColor: "var(--surface)",
                        color: "var(--ink)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <span className="material-symbols-outlined text-[16px]" style={{ color: "var(--accent)" }}>
                        {getAmenityIcon(amenity)}
                      </span>
                      {amenity}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          {/* PG Room Sharing Per-Room Pricing Breakdown */}
          {(property.property_category === 'pg' || property.property_type === 'pg' || property.property_type === 'pg_hostel' || property.property_type?.startsWith('pg') || property.pg_rules?.room_inventory) && (
            <div className="p-6 rounded-card border border-slate-200 bg-white space-y-4 shadow-sm">
              {(() => {
                const inv = property.pg_rules?.room_inventory;
                let totalInvOpenBeds = 0;
                let hasActiveInv = false;
                if (inv && typeof inv === 'object') {
                  Object.values(inv).forEach(item => {
                    if (item && item.enabled) {
                      hasActiveInv = true;
                      totalInvOpenBeds += (Number(item.available_beds) || 0);
                    }
                  });
                }
                const displayFreeBeds = hasActiveInv ? totalInvOpenBeds : (property.available_beds || 0);

                return (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-[15px] sm:text-[16px] text-[var(--ink)] flex items-center gap-2">
                        <span className="material-symbols-outlined text-black text-[22px]">meeting_room</span>
                        PG Room Sharing Options &amp; Bed Availability
                      </h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-black px-3 py-1 rounded-full border uppercase tracking-wider flex items-center gap-1.5 shadow-xs ${displayFreeBeds > 0 ? 'text-white bg-black border-black' : 'text-black bg-white border-slate-300'}`}>
                        <span className={`w-2 h-2 rounded-full ${displayFreeBeds > 0 ? 'bg-indigo-600 animate-pulse' : 'bg-slate-500'}`}></span>
                        {displayFreeBeds} Free Beds Available
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
                {(() => {
                  const inv = property.pg_rules?.room_inventory;
                  const types = [
                    { key: "single", label: "Single Private Room", icon: "bed", beds: 1 },
                    { key: "double", label: "Double Sharing", icon: "king_bed", beds: 2 },
                    { key: "triple", label: "Triple Sharing", icon: "hotel", beds: 3 },
                    { key: "four_plus", label: "4+ Bed Sharing", icon: "single_bed", beds: 4 },
                  ];

                  if (inv && typeof inv === 'object') {
                    const cards = types.map(t => {
                      const item = inv[t.key];
                      if (!item || !item.enabled) return null;
                      const totBeds = (Number(item.rooms) || 0) * (Number(item.beds_per_room) || t.beds);
                      const avail = Number(item.available_beds) || 0;
                      const isFree = avail > 0;
                      return (
                        <div key={t.key} className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 shadow-xs ${isFree ? 'bg-[var(--surface)] border-emerald-200 hover:border-emerald-400' : 'bg-[var(--surface-alt)] border-[var(--border)] opacity-80'}`}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="material-symbols-outlined text-black text-[20px]">{t.icon}</span>
                              <span className="text-[12px] font-black text-[var(--ink)]">{t.label}</span>
                            </div>
                          </div>
                          <div>
                            <div className="text-[19px] font-black text-[var(--ink)]">
                              ₹{Number(item.rent || property.price || 0).toLocaleString('en-IN')}
                              <span className="text-[10px] font-bold text-[var(--text-muted)]"> / bed/mo</span>
                            </div>
                            <div className="mt-2 flex items-center justify-between text-[11px] font-extrabold border-t pt-2 border-[var(--border-subtle)]">
                              <span className="text-[var(--text-muted)]">{totBeds} Beds Total ({item.rooms || 0} Rms)</span>
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${isFree ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-red-600 bg-slate-50 border-red-200'}`}>
                                {isFree ? `${avail} Open Beds` : 'Fully Occupied'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }).filter(Boolean);

                    if (cards.length > 0) return cards;
                  }

                  // Default dynamic single card reflecting exact property total & available beds
                  const isDouble = property.pg_sharing_type === 'double' || property.property_type === 'pg_double';
                  const isTriple = property.pg_sharing_type === 'triple' || property.property_type === 'pg_triple';
                  const bedsPerRoom = isDouble ? 2 : isTriple ? 3 : 1;
                  const label = isDouble ? "Double Sharing Room" : isTriple ? "Triple Sharing Room" : "Single Private Room";
                  const icon = isDouble ? "king_bed" : isTriple ? "hotel" : "bed";
                  const availBeds = property.available_beds || 0;
                  const hasAvail = availBeds > 0;

                  return (
                    <div className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 shadow-xs ${hasAvail ? 'bg-[var(--surface)] border-emerald-200' : 'bg-[var(--surface-alt)] border-[var(--border)] opacity-80'}`}>
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-black text-[20px]">{icon}</span>
                        <span className="text-[12px] font-black text-[var(--ink)]">{label}</span>
                      </div>
                      <div>
                        <div className="text-[19px] font-black text-[var(--ink)]">
                          ₹{Number(property.price || 0).toLocaleString('en-IN')}
                          <span className="text-[10px] font-bold text-[var(--text-muted)]"> / bed/mo</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-[11px] font-extrabold border-t pt-2 border-[var(--border-subtle)]">
                          <span className="text-[var(--text-muted)]">{property.total_beds || bedsPerRoom} Beds Total</span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${hasAvail ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-red-600 bg-slate-50 border-red-200'}`}>
                            {hasAvail ? `${availBeds} Open Beds` : 'Fully Occupied'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Detailed Stats Grid */}
          <div
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 p-4 md:p-8 rounded-card"
            style={{
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
            }}
          >
            {property.furnishing_status && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold text-text-muted uppercase tracking-widest">Furnishing</span>
                <span className="font-semibold text-[15px] text-ink capitalize">{property.furnishing_status.replace('-', ' ')}</span>
              </div>
            )}
            
            {property.carpet_area && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold text-text-muted uppercase tracking-widest">Carpet Area</span>
                <span className="font-semibold text-[15px] text-ink">{property.carpet_area} sq.ft</span>
              </div>
            )}

            {property.balconies !== null && property.balconies !== undefined && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold text-text-muted uppercase tracking-widest">Balconies</span>
                <span className="font-semibold text-[15px] text-ink">{property.balconies}</span>
              </div>
            )}

            {property.floor_number !== null && property.floor_number !== undefined && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold text-text-muted uppercase tracking-widest">Floor</span>
                <span className="font-semibold text-[15px] text-ink">{property.floor_number} {property.total_floors ? `of ${property.total_floors}` : ''}</span>
              </div>
            )}

            {property.facing_direction && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold text-text-muted uppercase tracking-widest">Facing</span>
                <span className="font-semibold text-[15px] text-ink capitalize">{property.facing_direction}</span>
              </div>
            )}

            {property.property_age !== null && property.property_age !== undefined && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold text-text-muted uppercase tracking-widest">Age</span>
                <span className="font-semibold text-[15px] text-ink">{property.property_age} Years</span>
              </div>
            )}
            
            {property.security_deposit && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold text-text-muted uppercase tracking-widest">Deposit</span>
                <span className="font-semibold text-[15px] text-ink">&#8377;{parseFloat(property.security_deposit).toLocaleString('en-IN')}</span>
              </div>
            )}
            
            {property.maintenance_charges && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold text-text-muted uppercase tracking-widest">Maintenance</span>
                <span className="font-semibold text-[15px] text-ink">&#8377;{parseFloat(property.maintenance_charges).toLocaleString('en-IN')}/m</span>
              </div>
            )}
            
            {property.preferred_tenants && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold text-text-muted uppercase tracking-widest">Tenants Allowed</span>
                <span className="font-semibold text-[15px] text-ink capitalize">
                  {property.preferred_tenants === 'only_boys'
                    ? 'Boys Only'
                    : property.preferred_tenants === 'only_girls'
                    ? 'Girls Only'
                    : property.preferred_tenants.replace('_', ' ')}
                </span>
              </div>
            )}
            
            {property.food_preference && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold text-text-muted uppercase tracking-widest">Food Preference</span>
                <span className="font-semibold text-[15px] text-ink capitalize">
                  {property.food_preference === 'veg_only'
                    ? 'Veg Only'
                    : property.food_preference === 'non_veg_allowed'
                    ? 'Non-Veg Allowed'
                    : 'Any Food'}
                </span>
              </div>
            )}
            
            {property.pet_policy && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold text-text-muted uppercase tracking-widest">Pet Policy</span>
                <span className="font-semibold text-[15px] text-ink capitalize">{property.pet_policy.replace('_', ' ')}</span>
              </div>
            )}
            
            {property.available_from && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold text-text-muted uppercase tracking-widest">Available From</span>
                <span className="font-semibold text-[15px] text-ink">{new Date(property.available_from).toLocaleDateString('en-GB')}</span>
              </div>
            )}
          </div>

          {/* Description */}
          {property.description && (
            <div
              className="p-8 rounded-card"
              style={{
                backgroundColor: "var(--surface)",
                border: "1px solid var(--border)",
              }}
            >
              <h2
                className="font-display font-semibold text-[22px] mb-4 tracking-tight"
                style={{ color: "var(--ink)" }}
              >
                About this property
              </h2>
              <p
                className="text-[15px] leading-relaxed whitespace-pre-wrap"
                style={{ color: "var(--text-muted)" }}
              >
                <Translate>{property.description}</Translate>
              </p>
            </div>
          )}


        </div>

        {/* ─── Right: Sticky Panel ─── */}
        <div className="lg:col-span-4">
          <div className="sticky top-[100px] flex flex-col gap-6">
            {isUnlocked ? (
              /* UNLOCKED PANEL */
              <div
                className="rounded-card p-7 flex flex-col gap-6"
                style={{
                  backgroundColor: "var(--card)",
                  border: "1px solid rgba(0,0,0,0.06)",
                }}
              >
                {/* Success banner */}
                {unlockSuccess && (
                  <div
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-[13px] font-semibold"
                    style={{
                      backgroundColor: "rgba(61,131,97,0.1)",
                      color: "var(--success)",
                      border: "1px solid rgba(61,131,97,0.2)",
                    }}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      check_circle
                    </span>
                    Property unlocked successfully!
                  </div>
                )}
                {/* Owner */}
                <div
                  className="flex items-center gap-4 pb-6 border-b"
                  style={{ borderColor: "rgba(0,0,0,0.07)" }}
                >
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: "var(--nav-active-bg)" }}
                  >
                    <span
                      className="material-symbols-outlined text-[28px]"
                      style={{ color: "var(--accent)" }}
                    >
                      person
                    </span>
                  </div>
                  <div>
                    <h3
                      className="font-display font-semibold text-[20px] mb-1 leading-tight"
                      style={{ color: "var(--ink)" }}
                    >
                      {property.owner_name_display}
                    </h3>
                    <div
                      className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest"
                      style={{ color: "var(--success)" }}
                    >
                      <span className="material-symbols-outlined text-[14px]">
                        verified_user
                      </span>{" "}
                      Verified Owner
                    </div>
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label
                    className="block text-[10px] font-bold uppercase tracking-widest mb-2.5"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Direct Contact
                  </label>
                  <div
                    className="flex items-center justify-between p-4 rounded-xl"
                    style={{
                      backgroundColor: "rgba(0,0,0,0.03)",
                      border: "1px solid rgba(0,0,0,0.06)",
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="material-symbols-outlined text-[20px]"
                        style={{ color: "var(--accent)" }}
                      >
                        phone_iphone
                      </span>
                      <div>
                        <p
                          className="font-semibold text-[17px] leading-none mb-0.5"
                          style={{ color: "var(--ink)" }}
                        >
                          {property.owner_phone_display}
                        </p>
                        <p
                          className="text-[10px] font-bold uppercase tracking-widest"
                          style={{ color: "var(--text-muted)" }}
                        >
                          Primary Mobile
                        </p>
                      </div>
                    </div>
                    <a
                      href={`tel:${property.owner_phone_display}`}
                      onClick={(e) => handleProtectedAction(e, "phone", `tel:${property.owner_phone_display}`)}
                      className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-200"
                      style={{
                        backgroundColor: "rgba(61,131,97,0.12)",
                        color: "var(--success)",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor =
                          "var(--success)";
                        e.currentTarget.style.color = "white";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor =
                          "rgba(61,131,97,0.12)";
                        e.currentTarget.style.color = "var(--success)";
                      }}
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        call
                      </span>
                    </a>
                  </div>
                </div>

                {/* Lease Agreement Flow (Issued by Owner, Downloaded by Buyer) */}
                <div className="mt-5">
                  {property.status === "rented" || property.has_issued_lease ? (
                    <div className="p-3.5 rounded-xl border border-indigo-600/30 bg-black/10">
                      <div className="flex items-center gap-2 text-[12px] font-extrabold text-[var(--accent)] dark:text-emerald-400 mb-1">
                        <span className="material-symbols-outlined text-[18px]">verified</span>
                        Official Lease Agreement Issued
                      </div>
                      <p className="text-[11px] text-text-muted mb-3 font-medium">
                        The property owner has finalized the rental agreement for this property.
                      </p>
                      <Link
                        to={`/property/${property.id}/lease`}
                        className="w-full h-10 rounded-xl text-[13px] font-bold flex items-center justify-center gap-2 bg-[var(--accent)] hover:bg-[var(--accent-soft)] text-white shadow-sm transition-all"
                      >
                        <span className="material-symbols-outlined text-[16px]">description</span>
                        View / Download Lease Agreement
                      </Link>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10">
                      <div className="flex items-center gap-2 text-[12px] font-bold text-amber-700 dark:text-amber-400">
                        <span className="material-symbols-outlined text-[16px]">history_edu</span>
                        Official Lease Agreement
                      </div>
                      <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5 font-medium">
                        The property owner will issue your official digital lease agreement once rental terms are finalized and marked rented.
                      </p>
                    </div>
                  )}
                </div>

                {/* Web Chat with Owner Button */}
                <div className="mt-3">
                  <Link
                    to={`/chat/${property.id}`}
                    onClick={(e) => handleProtectedAction(e, "chat")}
                    className="w-full h-12 rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                    style={{
                      background: "linear-gradient(135deg, var(--accent), var(--accent-soft))",
                      color: "white",
                    }}
                  >
                    <span className="material-symbols-outlined text-[20px]">chat</span>
                    Message the Owner
                  </Link>
                </div>

                {/* WhatsApp Direct Chat (Only shown if owner has registered WhatsApp) */}
                {property.owner_has_whatsapp !== false && (
                  <div className="mt-3">
                    <a
                      href={getWhatsAppShareLink(property.owner_phone_display, property.owner_name_display, property.property_type, property.locality_details?.name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full h-12 rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2 transition-all duration-200 hover:-translate-y-0.5 shadow-sm"
                      style={{
                        backgroundColor: "#25D366",
                        color: "white",
                      }}
                    >
                      <span className="material-symbols-outlined text-[20px]">chat</span>
                      WhatsApp Direct Chat
                    </a>
                  </div>
                )}

                {/* Google Maps Direction */}
                <div className="mt-3">
                  <a
                    href={getGoogleMapsLink(property.display_lat, property.display_lng, property.display_address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full h-12 rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2 transition-all duration-200 hover:-translate-y-0.5"
                    style={{
                      backgroundColor: "rgba(66, 133, 244, 0.12)",
                      color: "#1a73e8",
                      border: "1px solid rgba(66, 133, 244, 0.3)",
                    }}
                  >
                    <span className="material-symbols-outlined text-[20px]">directions</span>
                    Navigate on Google Maps
                  </a>
                </div>

                {/* Share Listing Button */}
                <div className="mt-3">
                  <button
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({
                          title: property.property_type,
                          text: `Check out this ${property.property_type} in ${property.locality_details?.name || 'Hubli-Dharwad'} on Rentlo!`,
                          url: window.location.href,
                        }).catch(() => {});
                      } else {
                        navigator.clipboard.writeText(window.location.href);
                        toast.success("Listing link copied to clipboard!");
                      }
                    }}
                    className="w-full h-12 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2 transition-all"
                    style={{
                      backgroundColor: "var(--surface)",
                      color: "var(--ink)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <span className="material-symbols-outlined text-[18px]">share</span>
                    Share Listing
                  </button>
                </div>

                {/* Visit Slots & Inspection Scheduling */}
                <div className="mt-5 p-4 rounded-2xl border border-slate-200/90 bg-slate-50/80">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[18px]">calendar_month</span>
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">Property Visit & Viewing</h4>
                        <p className="text-[10.5px] text-slate-500">In-person physical inspection</p>
                      </div>
                    </div>
                    {Array.isArray(visitSlots) && visitSlots.length > 0 && (
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 border border-emerald-200">
                        {visitSlots.length} {visitSlots.length === 1 ? 'Slot' : 'Slots'} Open
                      </span>
                    )}
                  </div>

                  {Array.isArray(visitSlots) && visitSlots.length > 0 ? (
                    <div className="space-y-2">
                      {visitSlots.map((slot) => (
                        <div
                          key={slot.id}
                          className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white shadow-xs"
                        >
                          <div>
                            <p className="text-[13px] font-bold text-slate-900">
                              {new Date(slot.slot_date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                            </p>
                            <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                              <span className="material-symbols-outlined text-[14px]">schedule</span>
                              {new Date(`1970-01-01T${slot.slot_time}`).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              {slot.is_full && " · Full"}
                            </p>
                          </div>
                          {slot.my_booking ? (
                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                              slot.my_booking.status === "approved" ? "bg-emerald-100 text-emerald-700 border border-emerald-200" : "bg-amber-100 text-amber-700 border border-amber-200"
                            }`}>
                              {slot.my_booking.status}
                            </span>
                          ) : slot.is_full ? (
                            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-400 uppercase">Full</span>
                          ) : (
                            <button
                              onClick={() => {
                                setBookingSlot(slot);
                                setBookingNote("Hi, I will come with my spouse to inspect the property.");
                              }}
                              className="text-xs font-black px-3.5 py-1.5 rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-xs cursor-pointer"
                            >
                              Book Slot
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs text-slate-600 mb-3 leading-relaxed font-medium">
                        No pre-scheduled open slots yet. You can chat directly with the owner to coordinate a convenient visit timing.
                      </p>
                      <button
                        type="button"
                        onClick={(e) => handleProtectedAction(e, "chat")}
                        className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">chat</span>
                        Request Visit via Direct Chat
                      </button>
                    </div>
                  )}
                </div>

                {/* Booking Confirm Modal */}
                {bookingSlot && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}>
                    <div className="rounded-3xl p-8 w-full max-w-sm border border-border bg-surface shadow-2xl">
                      <h3 className="text-[18px] font-extrabold mb-1" style={{ color: "var(--ink)" }}>Confirm Booking</h3>
                      <p className="text-[13px] mb-4" style={{ color: "var(--text-muted)" }}>
                        {new Date(bookingSlot.slot_date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })} at{" "}
                        {new Date(`1970-01-01T${bookingSlot.slot_time}`).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                      
                      <div className="mb-2">
                        <label className="text-[11px] font-bold uppercase tracking-widest block mb-1.5" style={{ color: "var(--text-muted)" }}>
                          Note for Owner (Editable)
                        </label>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          <button
                            type="button"
                            onClick={() => setBookingNote("Hi, I will come with my spouse to inspect the flat.")}
                            className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-accent-soft/10 text-accent border border-accent-soft/20 hover:bg-accent-soft/20 transition-all cursor-pointer"
                          >
                            👫 With Spouse
                          </button>
                          <button
                            type="button"
                            onClick={() => setBookingNote("Hi, I will come with my family to inspect the flat.")}
                            className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-[var(--border)] text-[var(--ink)] border border-[var(--border)] hover:bg-slate-200 transition-all cursor-pointer dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                          >
                            👨‍👩‍👧‍👦 With Family
                          </button>
                          <button
                            type="button"
                            onClick={() => setBookingNote("Hi, I will come alone to inspect the flat.")}
                            className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-[var(--border)] text-[var(--ink)] border border-[var(--border)] hover:bg-slate-200 transition-all cursor-pointer dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                          >
                            👤 Solo Visit
                          </button>
                        </div>
                      </div>

                      <textarea
                        value={bookingNote}
                        onChange={(e) => setBookingNote(e.target.value)}
                        placeholder="Type or edit your note for the owner..."
                        className="w-full h-24 p-3 rounded-xl border border-border text-[13px] outline-none focus:border-accent resize-none mb-4 font-medium bg-surface-alt text-ink"
                      />
                      {!user && (
                        <div className="flex flex-col gap-3 mb-4">
                          <input
                            type="text"
                            required
                            placeholder="Your Full Name"
                            value={guestName}
                            onChange={(e) => setGuestName(e.target.value)}
                            className="w-full h-11 p-3 rounded-xl border border-border text-[13px] outline-none focus:border-accent bg-surface-alt text-ink"
                          />
                          <input
                            type="tel"
                            required
                            placeholder="Your Phone Number"
                            value={guestPhone}
                            onChange={(e) => setGuestPhone(e.target.value)}
                            className="w-full h-11 p-3 rounded-xl border border-border text-[13px] outline-none focus:border-accent bg-surface-alt text-ink"
                          />
                        </div>
                      )}
                      <div className="flex gap-3">
                        <button
                          onClick={() => setBookingSlot(null)}
                          className="flex-1 h-11 bg-[var(--border)] hover:bg-slate-200 text-[var(--ink)] font-bold rounded-xl text-[13px] cursor-pointer dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => {
                            if (!user && (!guestName || guestPhone.length < 10)) {
                              toast.error("Please provide your full name and a valid 10-digit mobile number.");
                              return;
                            }
                            bookSlot(bookingSlot.id);
                          }}
                          disabled={bookingLoading}
                          className="flex-1 h-11 bg-accent hover:opacity-90 text-white font-bold rounded-xl text-[13px] flex items-center justify-center cursor-pointer disabled:opacity-40"
                        >
                          {bookingLoading ? "Booking..." : "Confirm Booking"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Map & Google Maps Navigation */}
                {(() => {
                  const mapLat = property.display_lat || property.exact_lat;
                  const mapLng = property.display_lng || property.exact_lng;
                  const googleMapsUrl = mapLat && mapLng ? `https://www.google.com/maps/search/?api=1&query=${mapLat},${mapLng}` : null;

                  return (
                    <div>
                      <div className="flex items-center justify-between mb-2.5">
                        <label
                          className="block text-[10px] font-bold uppercase tracking-widest"
                          style={{ color: "var(--text-muted)" }}
                        >
                          Exact Location
                        </label>
                        {mapLat && mapLng && (
                          <span className="text-[var(--accent)] font-extrabold text-[11px] flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">pin_drop</span>
                            GPS Pinpointed
                          </span>
                        )}
                      </div>
                      
                      {mapLat && mapLng ? (
                        <div className="flex flex-col gap-3">
                          <div
                            className="rounded-2xl overflow-hidden shadow-sm border border-[var(--border)]"
                            style={{ height: "220px" }}
                          >
                            <MapContainer
                              center={[parseFloat(mapLat), parseFloat(mapLng)]}
                              zoom={15}
                              style={{ height: "100%", width: "100%" }}
                            >
                              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                              <Marker position={[parseFloat(mapLat), parseFloat(mapLng)]} />
                            </MapContainer>
                          </div>

                          {/* Google Maps Pin & Directions Link */}
                          <a
                            href={googleMapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full h-12 rounded-xl text-[13px] font-extrabold tracking-wide flex items-center justify-center gap-2 text-white bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5"
                          >
                            <span className="material-symbols-outlined text-[20px]">near_me</span>
                            Open Location in Google Maps 🧭
                          </a>
                        </div>
                      ) : (
                        <div
                          className="w-full h-[180px] rounded-2xl border border-dashed border-slate-300 flex flex-col items-center justify-center text-center p-4"
                          style={{ backgroundColor: "var(--surface)" }}
                        >
                          <span className="material-symbols-outlined text-[32px] text-slate-300 mb-2">
                            map
                          </span>
                          <p className="text-[13px] font-bold text-[var(--text-muted)]">Location coordinates not set</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">Owner did not pin exact GPS coordinates for this listing.</p>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            ) : (
              /* LOCKED PANEL — signature moment */
              <>
                {/* The vault card */}
                <div
                  className="rounded-card p-7 flex flex-col gap-5 text-center relative overflow-hidden grain"
                  style={{
                    backgroundColor: "var(--surface)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  {/* Ambient radial glow — positioned behind lock icon */}
                  <div
                    className="absolute left-1/2 top-1/4 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full pointer-events-none"
                    style={{
                      background:
                        "radial-gradient(ellipse at center, var(--shadow-accent-glow) 0%, transparent 70%)",
                      filter: "blur(20px)",
                    }}
                  />

                  {/* Lock icon with ambient pulse */}
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto relative z-10 animate-pulse-glow"
                    style={{
                      backgroundColor: "var(--nav-active-bg)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <span
                      className="material-symbols-outlined text-[30px]"
                      style={{ color: "var(--accent)" }}
                      data-weight="fill"
                    >
                      lock
                    </span>
                  </div>

                  <div className="relative z-10">
                    <h3
                      className="font-display font-semibold text-[24px] mb-2 tracking-tight"
                      style={{ color: "var(--ink)" }}
                    >
                      Unlock Owner Details
                    </h3>
                    <p
                      className="text-[14px] leading-relaxed"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Get direct access to the owner's contact, exact location,
                      and verified documents.
                    </p>
                  </div>

                  {paymentFailed && (
                    <div
                      className="px-4 py-3 rounded-xl text-[13px] font-medium relative z-10"
                      style={{
                        backgroundColor: "rgba(178,58,58,0.12)",
                        color: "var(--danger)",
                        border: "1px solid rgba(178,58,58,0.2)",
                      }}
                    >
                      Payment failed or cancelled. Please try again.
                    </div>
                  )}

                  {/* Feature list */}
                  <div
                    className="p-5 rounded-xl relative z-10"
                    style={{
                      backgroundColor: "var(--surface-alt)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div className="flex justify-between items-center mb-4">
                      <span
                        className="text-[11px] font-bold uppercase tracking-widest"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Unlock Fee
                      </span>
                      <span
                        className="font-display font-semibold text-[28px] leading-none"
                        style={{ color: "var(--ink)" }}
                      >
                        &#8377;
                        {property.unlock_fee != null
                          ? Number(property.unlock_fee).toFixed(0)
                          : 99}
                      </span>
                    </div>
                    <ul className="text-left text-[13px] font-medium space-y-2.5">
                      {[
                        "Instant Call Access",
                        "100% Secure Payment",
                        "Exact Map Location",
                      ].map((feat) => (
                        <li key={feat} className="flex items-center gap-2.5">
                          <span
                            className="material-symbols-outlined text-[16px]"
                            style={{ color: "var(--accent)" }}
                          >
                            check_circle
                          </span>
                          <span style={{ color: "var(--text-muted)" }}>
                            {feat}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {userSub && userSub.has_active_pass && userSub.credits_remaining > 0 ? (
                    <div className="space-y-3 relative z-10">
                      <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
                        <div className="flex items-center justify-center gap-1.5 text-emerald-800 font-extrabold text-[13px]">
                          <span className="material-symbols-outlined text-[18px]">stars</span>
                          {userSub.credits_remaining} Active Pass Credit{userSub.credits_remaining === 1 ? "" : "s"} Available!
                        </div>
                        <p className="text-[11px] text-emerald-700 font-medium mt-0.5">
                          Use 1 credit to unlock owner contact & exact map location instantly.
                        </p>
                      </div>

                      <button
                        onClick={() => handleUnlock()}
                        disabled={unlocking}
                        className="w-full rounded-xl text-[14px] font-extrabold flex items-center justify-center gap-2 text-white bg-black hover:bg-slate-900 shadow-md hover:scale-[1.01] transition-all"
                        style={{ height: "52px" }}
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          {unlocking ? "hourglass_empty" : "bolt"}
                        </span>
                        {unlocking ? "Unlocking..." : "1-Click Instant Unlock (₹0 Extra Cost)"}
                      </button>

                      <button
                        onClick={() => setShowPlanModal(true)}
                        className="w-full text-center text-[12px] font-extrabold text-amber-700 hover:underline py-1 block"
                      >
                        Need more unlocks? Choose a new plan →
                      </button>
                    </div>
                  ) : property.status === "under_negotiation" ? (
                    <div className="p-5 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-center relative z-10">
                      <div className="w-12 h-12 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center mx-auto mb-2">
                        <span className="material-symbols-outlined text-[26px]">pause_circle</span>
                      </div>
                      <h4 className="text-[15px] font-extrabold text-purple-400 mb-1">Under Active Negotiation</h4>
                      <p className="text-[12px] font-medium text-purple-300/80">
                        The owner is currently negotiating token/lease terms with a buyer. Contact unlocks are temporarily paused.
                      </p>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowPlanModal(true)}
                      disabled={unlocking}
                      className="w-full h-13 rounded-xl text-[14px] font-semibold btn-shimmer flex items-center justify-center gap-2 relative z-10 disabled:opacity-50 transition-transform duration-200 hover:-translate-y-0.5 bg-black text-white hover:bg-slate-900 shadow-md"
                      style={{
                        height: "52px",
                      }}
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {unlocking ? "hourglass_empty" : "credit_card"}
                      </span>
                      {unlocking ? "Processing…" : "Pay to Unlock"}
                    </button>
                  )}
                </div>

                {/* Blurred map */}
                <div
                  className="rounded-card overflow-hidden relative"
                  style={{ height: "220px" }}
                >
                  <div
                    className="absolute top-0 left-0 right-0 z-20 px-4 py-3 flex items-center gap-2"
                    style={{
                      background:
                        "linear-gradient(to bottom, rgba(11,12,14,0.8), transparent)",
                    }}
                  >
                    <p
                      className="text-[12px] font-semibold uppercase tracking-widest"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Approximate Location
                    </p>
                  </div>
                  <div
                    className="absolute inset-0 z-10"
                    style={{ filter: "blur(7px)", opacity: 0.55 }}
                  >
                    <MapContainer
                      center={[
                        property.display_lat || 12.9716,
                        property.display_lng || 77.5946,
                      ]}
                      zoom={13}
                      style={{ height: "100%", width: "100%" }}
                      zoomControl={false}
                      dragging={false}
                      scrollWheelZoom={false}
                    >
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      <Circle
                        center={[
                          property.display_lat || 12.9716,
                          property.display_lng || 77.5946,
                        ]}
                        radius={800}
                        pathOptions={{
                          color: "#C77D3B",
                          fillColor: "#C77D3B",
                          fillOpacity: 0.18,
                        }}
                      />
                    </MapContainer>
                  </div>
                  <div className="absolute inset-0 z-30 flex items-center justify-center">
                    <div
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-bold uppercase tracking-widest"
                      style={{
                        backgroundColor: "rgba(21,22,25,0.9)",
                        color: "var(--accent-soft)",
                        border: "1px solid var(--border)",
                        backdropFilter: "blur(8px)",
                      }}
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        lock
                      </span>
                      Map Locked
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      {/* Similar Properties (Full Width Section) */}
      {Array.isArray(similarProperties) && similarProperties.length > 0 && (
        <section className="w-full max-w-[1600px] mx-auto px-4 md:px-10 py-16 border-t" style={{ borderColor: "var(--border)" }}>
          <h2 className="font-display font-semibold text-[28px] mb-8" style={{ color: "var(--ink)" }}>
            Similar Properties You Might Like
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {similarProperties.map((prop, i) => (
              <Link
                key={prop.id}
                to={`/property/${prop.id}`}
                className="group rounded-card overflow-hidden flex flex-col cursor-pointer border shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                style={{
                  backgroundColor: "var(--card)",
                  borderColor: "var(--border)",
                }}
              >
                <div
                  className="relative h-52 overflow-hidden"
                  style={{ backgroundColor: "var(--surface-alt)" }}
                >
                  {prop.media?.length > 0 ? (
                    <img
                      src={
                        prop.media[0].thumbnail_url || prop.media[0].image_url
                      }
                      alt="Property"
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.05]"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center text-text-muted"
                    >
                      <span className="material-symbols-outlined text-[48px] opacity-30">
                        home_work
                      </span>
                    </div>
                  )}
                  <div
                    className="absolute top-3 left-3 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest"
                    style={{
                      backgroundColor: "var(--nav-active-bg)",
                      color: "var(--accent)",
                      backdropFilter: "blur(8px)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    {prop.property_type}
                  </div>
                </div>
                <div className="p-5 flex flex-col flex-grow">
                  <div className="mb-2">
                    <span
                      className="font-display font-semibold text-[24px] leading-none"
                      style={{ color: "var(--ink)" }}
                    >
                      &#8377;{parseFloat(prop.price).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span
                      className="material-symbols-outlined text-[15px]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      location_on
                    </span>
                    <span
                      className="text-[13px] font-medium truncate"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {prop.locality_details
                        ? `${prop.locality_details.name}, ${prop.locality_details.city_name}`
                        : "Unknown Location"}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Photo Gallery Modal */}
      {showGallery && property.media?.length > 0 && (
        <div
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
          style={{
            backgroundColor: "rgba(11,12,14,0.95)",
            backdropFilter: "blur(10px)",
          }}
          onClick={() => setShowGallery(false)}
        >
          {/* Close button */}
          <button
            onClick={() => setShowGallery(false)}
            className="absolute top-6 right-6 w-12 h-12 rounded-full flex items-center justify-center bg-[var(--surface)]/10 hover:bg-[var(--surface)]/20 text-white transition-colors z-50"
          >
            <span className="material-symbols-outlined text-[24px]">close</span>
          </button>
          
          {/* Main Image */}
          <div className="relative w-full max-w-6xl px-16 flex-1 flex items-center justify-center min-h-0 py-10">
             {/* Left Nav */}
             {property.media.length > 1 && (
               <button
                 onClick={(e) => { e.stopPropagation(); setCurrentImageIndex((prev) => (prev === 0 ? property.media.length - 1 : prev - 1)); }}
                 className="absolute left-4 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full flex items-center justify-center bg-[var(--surface)]/10 hover:bg-[var(--surface)]/20 text-white transition-colors"
               >
                 <span className="material-symbols-outlined text-[32px]">chevron_left</span>
               </button>
             )}

             <img
               src={property.media[currentImageIndex].image_url}
               alt="Gallery"
               className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
               onClick={(e) => e.stopPropagation()}
             />

             {/* Right Nav */}
             {property.media.length > 1 && (
               <button
                 onClick={(e) => { e.stopPropagation(); setCurrentImageIndex((prev) => (prev === property.media.length - 1 ? 0 : prev + 1)); }}
                 className="absolute right-4 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full flex items-center justify-center bg-[var(--surface)]/10 hover:bg-[var(--surface)]/20 text-white transition-colors"
               >
                 <span className="material-symbols-outlined text-[32px]">chevron_right</span>
               </button>
             )}
          </div>
          
          {/* Thumbnails */}
          {Array.isArray(property.media) && property.media.length > 1 && (
            <div className="w-full max-w-4xl overflow-x-auto pb-8 px-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-center gap-3">
                {property.media.map((m, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentImageIndex(idx)}
                    className={`shrink-0 h-20 w-28 rounded-xl overflow-hidden border-2 transition-all ${currentImageIndex === idx ? 'border-accent scale-105 opacity-100 shadow-lg' : 'border-transparent opacity-50 hover:opacity-100'}`}
                  >
                    <img src={m.thumbnail_url || m.image_url} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}


      {showBuyerUpiModal && buyerUpiConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[var(--surface)] rounded-3xl p-8 max-w-md w-full shadow-2xl relative">
            <button
              onClick={() => setShowBuyerUpiModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[var(--border)] flex items-center justify-center text-[var(--text-muted)] hover:bg-slate-200 transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
            <h3 className="text-xl font-bold text-[var(--ink)] mb-2">Unlock Property</h3>
            <p className="text-sm text-[var(--text-muted)] mb-6">Pay ₹{buyerUpiConfig.amount} to view owner contact details.</p>
            
            <div className="flex justify-center mb-6">
              <div className="p-4 bg-[var(--surface)] border-2 border-[var(--border-subtle)] rounded-2xl shadow-sm">
                <QRCode value={`upi://pay?pa=${buyerUpiConfig.upi_merchant_id}&pn=Rentlo&am=${buyerUpiConfig.amount}&cu=INR`} size={160} />
              </div>
            </div>
            
            <a 
              href={`upi://pay?pa=${buyerUpiConfig.upi_merchant_id}&pn=Rentlo&am=${buyerUpiConfig.amount}&cu=INR`}
              className="w-full h-12 bg-slate-900 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors mb-6"
            >
              <span className="material-symbols-outlined text-[20px]">touch_app</span>
              Pay via GPay / PhonePe
            </a>
            
            <div className="space-y-3">
              <label className="block text-[13px] font-bold text-[var(--ink)] uppercase tracking-wider">
                Enter 12-Digit UTR Number
              </label>
              <input
                type="text"
                value={buyerUtr}
                onChange={(e) => setBuyerUtr(e.target.value.replace(/[^0-9]/g, ""))}
                maxLength={12}
                placeholder="e.g. 312345678901"
                className="w-full h-12 bg-[var(--surface-alt)] border border-[var(--border)] rounded-xl px-4 text-[14px] font-medium outline-none focus:border-orange-500 transition-colors"
              />
              <button
                onClick={handleBuyerUpiSubmit}
                disabled={buyerUtrSubmitting || buyerUtr.length !== 12}
                className="w-full h-12 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl disabled:opacity-50 transition-colors mt-2"
              >
                {buyerUtrSubmitting ? "Submitting..." : "Submit Payment UTR"}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {showOtpModal && (
        <OtpModal
          title="Unlock Owner Details"
          subtitle="Sign in or enter your mobile number to unlock direct owner contact & location."
          onSuccess={(name, phone) => {
            setShowOtpModal(false);
            handleUnlock(name, phone);
          }}
          onClose={() => setShowOtpModal(false)}
        />
      )}

      {showFeedbackModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{
            backgroundColor: "rgba(11,12,14,0.8)",
            backdropFilter: "blur(10px)",
          }}
        >
          <div
            className="w-full max-w-sm rounded-card p-8"
            style={{
              backgroundColor: "var(--surface)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <h3
              className="font-display font-bold text-[20px] mb-1.5 text-center tracking-tight"
              style={{ color: "var(--ink)" }}
            >
              {feedbackAccurate === false ? "Report Listing Dispute" : "Contact Details Verification"}
            </h3>
            <p
              className="text-[12px] text-center mb-5 font-medium"
              style={{ color: "var(--text-muted)" }}
            >
              {feedbackAccurate === false
                ? "Select the issue below. Admin will review within our 2-hour SLA for credit refund."
                : "Did you reach the direct owner successfully?"}
            </p>
            {!feedbackSubmitted ? (
              <>
                <div className="flex gap-3 mb-4">
                  {[
                    { val: true, icon: "thumb_up", label: "Yes, Owner Active" },
                    { val: false, icon: "report_problem", label: "No, Issue Found" },
                  ].map((opt) => (
                    <button
                      key={String(opt.val)}
                      onClick={() => setFeedbackAccurate(opt.val)}
                      className="flex-1 h-11 rounded-xl flex items-center justify-center gap-2 text-[12px] font-bold transition-all duration-200 cursor-pointer shadow-xs"
                      style={{
                        backgroundColor:
                          feedbackAccurate === opt.val
                            ? opt.val
                              ? "var(--success)"
                              : "#ef4444"
                            : "rgba(0,0,0,0.04)",
                        color:
                          feedbackAccurate === opt.val
                            ? "white"
                            : "var(--text-muted)",
                        border: feedbackAccurate === opt.val ? "none" : "1px solid var(--border)",
                      }}
                    >
                      <span className="material-symbols-outlined text-[17px]">
                        {opt.icon}
                      </span>{" "}
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* If issue reported: Show Dispute Reason Dropdown / Buttons */}
                {feedbackAccurate === false && (
                  <div className="space-y-3 mb-4 animate-in fade-in duration-200">
                    <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 block">
                      Dispute Reason (SLA Protected)
                    </label>
                    <div className="grid grid-cols-1 gap-2">
                      {[
                        { id: "already_rented", label: "🏡 Already Rented Out by Owner" },
                        { id: "wrong_number", label: "📵 Wrong / Inactive / Switched-Off Phone" },
                        { id: "broker_demanding_commission", label: "💼 Broker Demanding Brokerage (Policy Violation)" },
                        { id: "fake_photos_or_price", label: "⚠️ Fake Photos / Rent Price Mismatch" },
                        { id: "other", label: "📝 Other Issue" },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setFeedbackReason(item.id)}
                          className={`w-full text-left px-3.5 py-2.5 rounded-xl text-[12px] font-bold border transition-all flex items-center justify-between cursor-pointer ${
                            feedbackReason === item.id
                              ? "bg-rose-50 border-rose-400 text-rose-800 shadow-xs"
                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <span>{item.label}</span>
                          {feedbackReason === item.id && (
                            <span className="material-symbols-outlined text-rose-600 text-[16px]">check_circle</span>
                          )}
                        </button>
                      ))}
                    </div>

                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-800 text-[11px] font-medium flex items-start gap-2">
                      <span className="material-symbols-outlined text-amber-600 text-[16px] shrink-0 mt-0.5">verified_user</span>
                      <span>
                        <strong>100% Refund Guarantee:</strong> Upon Admin review, <strong>+1 unlock credit</strong> will be automatically credited back to your pass.
                      </span>
                    </div>
                  </div>
                )}

                <textarea
                  value={feedbackNote}
                  onChange={(e) => setFeedbackNote(e.target.value)}
                  placeholder={
                    feedbackAccurate === false
                      ? "Describe the issue (e.g. called owner, they said rented on Sunday)..."
                      : "Optional comments about this property..."
                  }
                  className="w-full rounded-xl p-3 text-[12px] mb-4 resize-none outline-none transition-all duration-200 font-medium"
                  rows={2}
                  style={{
                    backgroundColor: "var(--surface-alt)",
                    color: "var(--ink)",
                    border: "1px solid var(--border)",
                  }}
                />

                <button
                  onClick={handleSubmitFeedback}
                  disabled={feedbackLoading || feedbackAccurate === null}
                  className="w-full h-11 rounded-xl text-[13px] font-extrabold disabled:opacity-50 cursor-pointer transition-all shadow-sm flex items-center justify-center gap-2"
                  style={{
                    backgroundColor: "var(--accent)",
                    color: "#ffffff",
                  }}
                >
                  {feedbackLoading ? (
                    <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                  ) : (
                    <span className="material-symbols-outlined text-[16px]">send</span>
                  )}
                  {feedbackLoading ? "Submitting…" : feedbackAccurate === false ? "Submit Dispute for Refund" : "Submit Feedback"}
                </button>
                <button
                  onClick={() => setShowFeedbackModal(false)}
                  className="w-full mt-2 h-9 text-[12px] font-bold cursor-pointer"
                  style={{ color: "var(--text-muted)" }}
                >
                  Skip
                </button>
              </>
            ) : (
              <div className="text-center py-6 animate-in zoom-in-95 duration-300">
                <span
                  className="material-symbols-outlined text-[48px] mb-3 block text-emerald-600"
                >
                  check_circle
                </span>
                <p className="text-[15px] font-bold text-slate-800 mb-1">
                  {feedbackAccurate === false ? "Dispute Submitted Under SLA" : "Feedback Received"}
                </p>
                <p className="text-[12px] text-slate-500 font-medium px-2">{feedbackResultMsg}</p>
              </div>
            )}
          </div>
        </div>
      )}
      {/* 3D Tour Modal */}
      {show3DTour && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md animate-fade-in">
          <button
            className="absolute top-6 right-6 w-12 h-12 flex items-center justify-center bg-[var(--surface)]/10 text-white rounded-full hover:bg-[var(--surface)]/20 transition-all z-10"
            onClick={() => setShow3DTour(false)}
          >
            <span className="material-symbols-outlined text-[24px]">close</span>
          </button>
          <div className="w-[90vw] h-[80vh] rounded-3xl overflow-hidden bg-black shadow-2xl relative">
            <iframe 
              src={property.virtual_tour_url} 
              className="w-full h-full border-0"
              allowFullScreen
              allow="xr-spatial-tracking"
            ></iframe>
          </div>
        </div>
      )}

      {/* Profile Completion Modal */}
      <ProfileCompletionModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        onSuccess={handleProfileSuccess}
        user={user}
        checkAuth={checkAuth}
      />

      {/* Login Modal for Protected Actions */}
      {showLoginModal && (
        <OtpModal
          title="Sign in to Continue"
          subtitle="Enter your mobile number to connect with the owner or manage your listings."
          onSuccess={async () => {
            setShowLoginModal(false);
            await checkAuth(); // Make sure user state is updated
            handleProfileSuccess(); // Resume action
          }}
          onClose={() => setShowLoginModal(false)}
        />
      )}

      {/* Printable Signboard QR Code Modal (100% Free) */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-[var(--surface)] rounded-3xl p-8 w-full max-w-sm flex flex-col items-center text-center shadow-2xl relative">
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-[var(--border)] text-[var(--text-muted)] hover:text-[var(--ink)] flex items-center justify-center transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>

            <div className="w-14 h-14 rounded-2xl bg-amber-50 text-black flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-[32px]">qr_code_2</span>
            </div>

            <h3 className="text-[20px] font-bold text-[var(--ink)] mb-1">Printable Signboard QR</h3>
            <p className="text-[12px] text-[var(--text-muted)] mb-5">
              Print or scan this QR code on field signboards to open instant property details on Rentlo.
            </p>

            <div className="p-4 bg-[var(--surface)] border-2 border-slate-900 rounded-2xl shadow-sm mb-6 flex items-center justify-center">
              <QRCode value={window.location.href} size={180} />
            </div>

            <button
              onClick={() => window.print()}
              className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md"
            >
              <span className="material-symbols-outlined text-[20px]">print</span>
              Print QR Signboard
            </button>
          </div>
        </div>
      )}

      {/* Plan Selection Modal */}
      <PlanSelectionModal
        isOpen={showPlanModal}
        onClose={() => setShowPlanModal(false)}
        propertyId={property?.id}
        onSuccessUnlock={(fullData) => {
          setProperty((prev) =>
            prev
              ? {
                  ...prev,
                  is_unlocked: true,
                  exact_lat: fullData.exact_lat,
                  exact_lng: fullData.exact_lng,
                  display_lat: fullData.exact_lat,
                  display_lng: fullData.exact_lng,
                  owner_name_display: fullData.owner_name,
                  owner_phone_display: fullData.owner_phone,
                  unlock_id: fullData.unlock_id,
                }
              : null
          );
          setUnlockSuccess(true);
        }}
      />

      {!isUnlocked && !showPlanModal && !showOtpModal && !showQrModal && !showFeedbackModal && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-2xl border-t border-slate-200 dark:border-slate-800 px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))] flex items-center justify-between gap-4 shadow-[0_-10px_35px_rgba(0,0,0,0.15)]">
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Unlock Fee</span>
            <span className="text-[22px] font-black text-slate-950 dark:text-white leading-tight">
              ₹{property.unlock_fee != null ? Number(property.unlock_fee).toFixed(0) : 99}
            </span>
          </div>
          <button
            onClick={() => {
              if (userSub && userSub.has_active_pass && userSub.credits_remaining > 0) {
                handleUnlock();
              } else {
                setShowPlanModal(true);
              }
            }}
            disabled={unlocking}
            className="flex-1 h-12 rounded-2xl text-[14px] font-extrabold flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white shadow-lg shadow-indigo-500/25 transition-all active:scale-[0.98] cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">
              {unlocking ? "hourglass_empty" : (userSub && userSub.has_active_pass && userSub.credits_remaining > 0 ? "bolt" : "lock_open")}
            </span>
            {unlocking
              ? "Processing..."
              : (userSub && userSub.has_active_pass && userSub.credits_remaining > 0
                ? "1-Click Unlock"
                : "Pay to Unlock")}
          </button>
        </div>
      )}

    </div>
  );
};
