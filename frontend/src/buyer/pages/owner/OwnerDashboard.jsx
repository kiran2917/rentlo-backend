import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useAuth } from "../../../shared/context/AuthContext";
import { toast } from "react-toastify";
import { loadRazorpayScript } from "../../../shared/utils/razorpayLoader";
import { PropertyImageSlideshow } from "../../../shared/components/PropertyImageSlideshow";
import { Translate } from "../../../shared/components/Translate";

export const OwnerDashboard = () => {
  const { user } = useAuth();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [ownerCredits, setOwnerCredits] = useState({ has_active_credits: false, total_credits_remaining: 0, active_passes: [] });
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [buyingPassLoading, setBuyingPassLoading] = useState(false);
  const [selectedPassCategory, setSelectedPassCategory] = useState(null);
  const [platformSettings, setPlatformSettings] = useState(null);
  
  const [showUpiModal, setShowUpiModal] = useState(false);
  const [upiOrderData, setUpiOrderData] = useState(null);
  const [utrNumber, setUtrNumber] = useState("");
  const [isVerifyingUtr, setIsVerifyingUtr] = useState(false);
  const [successPassId, setSuccessPassId] = useState(null);

  const [editingBedProp, setEditingBedProp] = useState(null);
  const [bedForm, setBedForm] = useState({ total_beds: 0, available_beds: 0 });
  const [updatingBeds, setUpdatingBeds] = useState(false);
  const [relistTarget, setRelistTarget] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);

  const [editingProp, setEditingProp] = useState(null);
  const [activeEditTab, setActiveEditTab] = useState("pricing");
  const [editForm, setEditForm] = useState({
    price: "",
    security_deposit: "",
    maintenance_charges: "",
    maintenance_included_in_rent: false,
    available_from: "",
    lock_in_period_months: "",
    lease_term_months: "",
    description: "",
    bedrooms: "",
    bathrooms: "",
    balconies: "",
    carpet_area: "",
    super_built_up_area: "",
    floor_number: "",
    total_floors: "",
    facing_direction: "",
    property_age: "",
    furnishing_status: "unfurnished",
    preferred_tenants: "anyone",
    food_preference: "no_preference",
    pet_policy: "allowed",
    gated_security: false,
    power_backup: "None",
    water_supply: "Both",
    covered_parking_spots: "",
    open_parking_spots: "",
    pg_gender: "coed",
    amenities: [],
    media: []
  });
  const [newUploadedMedia, setNewUploadedMedia] = useState([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleEditClick = (prop) => {
    setEditingProp(prop);
    setEditForm({
      price: prop.price || "",
      security_deposit: prop.security_deposit || "",
      maintenance_charges: prop.maintenance_charges || "",
      maintenance_included_in_rent: prop.maintenance_included_in_rent || false,
      available_from: prop.available_from ? prop.available_from.substring(0, 10) : "",
      lock_in_period_months: prop.lock_in_period_months || "",
      lease_term_months: prop.lease_term_months || "",
      description: prop.description || "",
      bedrooms: prop.bedrooms || "",
      bathrooms: prop.bathrooms || "",
      balconies: prop.balconies || "",
      carpet_area: prop.carpet_area || "",
      super_built_up_area: prop.super_built_up_area || "",
      floor_number: prop.floor_number || "",
      total_floors: prop.total_floors || "",
      facing_direction: prop.facing_direction || "",
      property_age: prop.property_age || "",
      furnishing_status: prop.furnishing_status || "unfurnished",
      preferred_tenants: prop.preferred_tenants || "anyone",
      food_preference: prop.food_preference || "no_preference",
      pet_policy: prop.pet_policy || "allowed",
      gated_security: prop.gated_security || false,
      power_backup: prop.power_backup || "None",
      water_supply: prop.water_supply || "Both",
      covered_parking_spots: prop.covered_parking_spots || "",
      open_parking_spots: prop.open_parking_spots || "",
      pg_gender: prop.pg_gender || "coed",
      amenities: prop.amenities || [],
      media: prop.media || []
    });
    setNewUploadedMedia([]);
    setActiveEditTab("pricing");
  };

  const handleMediaDelete = async (mediaId) => {
    if (!window.confirm("Are you sure you want to delete this photo? This will instantly trigger admin review for safety.")) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/properties/media/${mediaId}/`, {
        method: "DELETE",
        credentials: "include"
      });
      if (res.ok) {
        toast.success("Photo deleted successfully. Review pending.");
        setEditForm(prev => ({
          ...prev,
          media: prev.media.filter(m => m.id !== mediaId)
        }));
      } else {
        toast.error("Failed to delete photo.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error deleting photo.");
    }
  };

  const handleNewMediaDelete = (index) => {
    setNewUploadedMedia(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleMediaUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setUploadingMedia(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append("file", file);
        
        const res = await fetch(`${import.meta.env.VITE_API_URL}/media/upload/`, {
          method: "POST",
          credentials: "include",
          body: formData
        });
        
        if (res.ok) {
          const data = await res.json();
          const newMediaItem = {
            image_url: data.full_url,
            medium_url: data.medium_url,
            thumbnail_url: data.thumbnail_url,
            image_hash: data.image_hash
          };
          setNewUploadedMedia(prev => [...prev, newMediaItem]);
        } else {
          toast.error(`Failed to upload ${file.name}`);
        }
      }
      toast.success("Photos uploaded successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Error uploading photos.");
    } finally {
      setUploadingMedia(false);
      e.target.value = ""; // reset input
    }
  };

  const handleSaveEdits = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    
    const priceChanged = Number(editForm.price) !== Number(editingProp.price);
    const photosAdded = newUploadedMedia.length > 0;
    
    const payload = {
      price: editForm.price,
      security_deposit: editForm.security_deposit ? Number(editForm.security_deposit) : null,
      maintenance_charges: editForm.maintenance_charges ? Number(editForm.maintenance_charges) : null,
      maintenance_included_in_rent: editForm.maintenance_included_in_rent,
      available_from: editForm.available_from || null,
      lock_in_period_months: editForm.lock_in_period_months ? Number(editForm.lock_in_period_months) : null,
      lease_term_months: editForm.lease_term_months ? Number(editForm.lease_term_months) : null,
      description: editForm.description,
      bedrooms: editForm.bedrooms ? Number(editForm.bedrooms) : null,
      bathrooms: editForm.bathrooms ? Number(editForm.bathrooms) : null,
      balconies: editForm.balconies ? Number(editForm.balconies) : null,
      carpet_area: editForm.carpet_area ? Number(editForm.carpet_area) : null,
      super_built_up_area: editForm.super_built_up_area ? Number(editForm.super_built_up_area) : null,
      floor_number: editForm.floor_number ? Number(editForm.floor_number) : null,
      total_floors: editForm.total_floors ? Number(editForm.total_floors) : null,
      facing_direction: editForm.facing_direction || null,
      property_age: editForm.property_age || null,
      furnishing_status: editForm.furnishing_status,
      preferred_tenants: editForm.preferred_tenants,
      food_preference: editForm.food_preference,
      pet_policy: editForm.pet_policy,
      gated_security: editForm.gated_security,
      power_backup: editForm.power_backup,
      water_supply: editForm.water_supply,
      covered_parking_spots: editForm.covered_parking_spots ? Number(editForm.covered_parking_spots) : null,
      open_parking_spots: editForm.open_parking_spots ? Number(editForm.open_parking_spots) : null,
      pg_gender: editForm.pg_gender,
      amenities: editForm.amenities,
    };
    
    if (photosAdded) {
      payload.uploaded_media = newUploadedMedia;
    }
    
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/properties/${editingProp.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        if (priceChanged || photosAdded) {
          toast.success("🎉 Edits saved! Because you changed rent/photos, listing is set to 'Pending Review' for admin approval.");
        } else {
          toast.success("✅ Edits saved and live instantly!");
        }
        setEditingProp(null);
        fetchProperties();
      } else {
        const errData = await res.json().catch(() => ({}));
        toast.error(errData.detail || "Failed to save edits.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error saving edits.");
    } finally {
      setIsSaving(false);
    }
  };

  const fetchProperties = () => {
    setLoading(true);
    fetch(`${import.meta.env.VITE_API_URL}/properties/my-properties/`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => setProperties(Array.isArray(data) ? data : []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));

    fetch(`${import.meta.env.VITE_API_URL}/properties/owner-credits/`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setOwnerCredits(data);
      })
      .catch((err) => console.error("Could not fetch owner credits:", err));

    fetch(`${import.meta.env.VITE_API_URL}/properties/platform-settings/`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setPlatformSettings(data);
      })
      .catch((err) => console.error("Could not fetch platform settings:", err));
  };

  useEffect(() => {
    fetchProperties();
  }, []);

  const handleStatusUpdate = async (propertyId, newStatus) => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/properties/${propertyId}/`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ status: newStatus }),
        }
      );
      if (res.ok) {
        const messages = {
          under_negotiation: "⏸️ Property put Under Negotiation. New unlocks paused.",
          rented: "🏠 Property marked as Rented!",
          live: "✅ Property is now Live & open for new buyers!",
        };
        toast.success(messages[newStatus] || `Status updated to ${newStatus}`);
        setProperties((prev) =>
          prev.map((p) =>
            p.id === propertyId ? { ...p, status: newStatus } : p
          )
        );
      } else {
        const errorData = await res.json().catch(() => ({}));
        if (res.status === 402) {
          toast.error(errorData.detail || "No active listing credits remaining.");
          if (errorData.category) {
            setSelectedPassCategory(errorData.category);
          }
          setShowCreditsModal(true);
        } else {
          toast.error(errorData.detail || "Failed to update property status.");
        }
      }
    } catch {
      toast.error("Network error. Please try again.");
    }
  };
  
  const handleRelistClick = (property) => {
    const prop_cat = property.property_category;
    const prop_type = property.property_type;
    let target_cat = 'residential';
    if (prop_cat === 'pg' || ['apartment', 'flat', 'pg_hostel', 'pg_single', 'pg_double', 'pg_triple', 'pg', 'hostel'].includes(prop_type)) {
      target_cat = 'apartment';
    } else if (prop_cat === 'commercial' || ['shop', 'office', 'warehouse', 'showroom', 'industrial', 'commercial_building'].includes(prop_type)) {
      target_cat = 'commercial';
    }

    const hasCredits = ownerCredits?.active_passes?.some(pass => 
      pass.credits_remaining > 0 && (pass.category === 'all' || pass.category === target_cat)
    ) || (ownerCredits?.total_credits_remaining > 0);

    if (!hasCredits) {
      toast.error(`No active listing credits remaining for ${target_cat.toUpperCase()}. Please buy a pass to relist.`);
      setSelectedPassCategory(target_cat);
      setShowCreditsModal(true);
      return;
    }

    setRelistTarget(property);
  };

  const handlePGOccupancy = async (propId, action, customPayload = {}) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/properties/${propId}/update-occupancy/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action, ...customPayload }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(`PG bed status updated! Free beds: ${data.available_beds}`);
        setProperties((prev) =>
          prev.map((p) => (p.id === propId ? {
            ...p,
            available_beds: data.available_beds ?? p.available_beds,
            total_beds: data.total_beds ?? p.total_beds,
            pg_rules: data.pg_rules || p.pg_rules,
          } : p))
        );
        return true;
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || "Failed to update PG occupancy");
        return false;
      }
    } catch (e) {
      toast.error("Error updating PG occupancy: " + e.message);
      return false;
    }
  };

  const CATEGORY_PLANS = {
    residential: {
      label: "Residential House / Villa / Flat",
      shortLabel: "Residential",
      icon: "home",
      badge: "Ind. House, Villa, Plots",
      description: "For independent houses, villas, builder floors, family apartments & plots",
      plans: [
        {
          id: "single",
          name: "Single Listing Pass",
          credits: 1,
          price: platformSettings ? Number(platformSettings.owner_residential_fee) : 99,
          originalPrice: null,
          badge: "Standard",
          features: ["1 Residential Listing Credit", "Valid Until Rented (Never Expires)", "Direct Owner WhatsApp Contact", "Exact Map Pin Navigation", "Instant Buyer Inquiries"],
        },
        {
          id: "3pack",
          name: "3-Pack Starter Pass",
          credits: 3,
          price: platformSettings ? Number(platformSettings.owner_residential_3pack_price) : 259,
          originalPrice: platformSettings ? Math.round(Number(platformSettings.owner_residential_fee) * 3) : 297,
          badge: "MOST POPULAR",
          saveBadge: platformSettings && Number(platformSettings.owner_residential_fee) > 0 ? `Save ${Math.round((1 - (Number(platformSettings.owner_residential_3pack_price) / (Number(platformSettings.owner_residential_fee) * 3))) * 100)}%` : "Save 13%",
          highlight: true,
          features: ["3 Residential Listing Credits", "Valid Until Rented (Never Expires)", "WhatsApp Tenant Broadcast", "Verified Owner Ribbon", "Credits Never Expire"],
        },
        {
          id: "6pack",
          name: "6-Pack VIP Pass",
          credits: 6,
          price: platformSettings ? Number(platformSettings.owner_residential_6pack_price) : 499,
          originalPrice: platformSettings ? Math.round(Number(platformSettings.owner_residential_fee) * 6) : 594,
          badge: "BEST VALUE",
          saveBadge: platformSettings && Number(platformSettings.owner_residential_fee) > 0 ? `Save ${Math.round((1 - (Number(platformSettings.owner_residential_6pack_price) / (Number(platformSettings.owner_residential_fee) * 6))) * 100)}%` : "Save 16%",
          features: ["6 Residential Listing Credits", "Valid Until Rented (Never Expires)", "Top Search Placement Badge", "Free Rental Agreement Drafts", "High-Priority Verification"],
        },
        {
          id: "10pack",
          name: "10-Pack Builder Pass",
          credits: 10,
          price: platformSettings ? Number(platformSettings.owner_residential_10pack_price) : 859,
          originalPrice: platformSettings ? Math.round(Number(platformSettings.owner_residential_fee) * 10) : 990,
          badge: "PRO BUILDER",
          saveBadge: platformSettings && Number(platformSettings.owner_residential_fee) > 0 ? `Save ${Math.round((1 - (Number(platformSettings.owner_residential_10pack_price) / (Number(platformSettings.owner_residential_fee) * 10))) * 100)}%` : "Save 14%",
          features: ["10 Residential Listing Credits", "Valid Until Rented (Never Expires)", "Featured Property Ribbon", "Dedicated Account Manager", "Bulk Multi-Unit Import"],
        },
      ],
    },
    apartment: {
      label: "Apartment & PG / Co-Living",
      shortLabel: "Apartment & PG",
      icon: "apartment",
      badge: "Flats, PG, Hostels",
      description: "For gated apartments, PG rooms, hostels & shared co-living spaces",
      plans: [
        {
          id: "single",
          name: "Single Listing Pass",
          credits: 1,
          price: platformSettings ? Number(platformSettings.owner_apt_pg_fee) : 149,
          originalPrice: null,
          badge: "Standard",
          features: ["1 Apartment/PG Listing Credit", `Listing active for ${platformSettings?.validity_apt_pg_1pack_days || platformSettings?.validity_apt_pg_days || 60} days`, "Room & Bed Capacity Tracker", "Direct Student/Working Lead Chat", "Instant Contact Access"],
        },
        {
          id: "3pack",
          name: "3-Pack Starter Pass",
          credits: 3,
          price: platformSettings ? Number(platformSettings.owner_apt_pg_3pack_price) : 349,
          originalPrice: platformSettings ? Math.round(Number(platformSettings.owner_apt_pg_fee) * 3) : 447,
          badge: "MOST POPULAR",
          saveBadge: platformSettings && Number(platformSettings.owner_apt_pg_fee) > 0 ? `Save ${Math.round((1 - (Number(platformSettings.owner_apt_pg_3pack_price) / (Number(platformSettings.owner_apt_pg_fee) * 3))) * 100)}%` : "Save 22%",
          highlight: true,
          features: ["3 Apartment/PG Credits", `Listings active for ${platformSettings?.validity_apt_pg_3pack_days || 60} days each`, "Realtime Bed Occupancy Sync", "WhatsApp Buyer Broadcast", "Zero Commission Tag"],
        },
        {
          id: "6pack",
          name: "6-Pack VIP Pass",
          credits: 6,
          price: platformSettings ? Number(platformSettings.owner_apt_pg_6pack_price) : 649,
          originalPrice: platformSettings ? Math.round(Number(platformSettings.owner_apt_pg_fee) * 6) : 894,
          badge: "VIP VALUE",
          saveBadge: platformSettings && Number(platformSettings.owner_apt_pg_fee) > 0 ? `Save ${Math.round((1 - (Number(platformSettings.owner_apt_pg_6pack_price) / (Number(platformSettings.owner_apt_pg_fee) * 6))) * 100)}%` : "Save 27%",
          features: ["6 Apartment/PG Credits", `Listings active for ${platformSettings?.validity_apt_pg_6pack_days || 90} days each`, "Top Search Placement Badge", "Free Rental Agreement Drafts", "High-Priority Verification"],
        },
        {
          id: "10pack",
          name: "10-Pack Hostel Pass",
          credits: 10,
          price: platformSettings ? Number(platformSettings.owner_apt_pg_10pack_price) : 999,
          originalPrice: platformSettings ? Math.round(Number(platformSettings.owner_apt_pg_fee) * 10) : 1490,
          badge: "HOSTEL OWNER",
          saveBadge: platformSettings && Number(platformSettings.owner_apt_pg_fee) > 0 ? `Save ${Math.round((1 - (Number(platformSettings.owner_apt_pg_10pack_price) / (Number(platformSettings.owner_apt_pg_fee) * 10))) * 100)}%` : "Save 33%",
          features: ["10 Apartment/PG Credits", `Listings active for ${platformSettings?.validity_apt_pg_10pack_days || 180} days each`, "Full Hostel Inventory Management", "Unlimited Bed Status Edits", "Dedicated Support"],
        },
      ],
    },
    commercial: {
      label: "Commercial Space & Shop",
      shortLabel: "Commercial",
      icon: "store",
      badge: "Shop, Office, Warehouse",
      description: "For retail shops, office spaces, warehouses, showrooms & industrial spaces",
      plans: [
        {
          id: "single",
          name: "Single Commercial Pass",
          credits: 1,
          price: platformSettings ? Number(platformSettings.owner_commercial_fee) : 199,
          originalPrice: null,
          badge: "Standard",
          features: ["1 Commercial Property Submission", "Valid Until Rented (Never Expires)", "Office/Seating Details Tag", "Direct Corporate Business Leads", "Full Search Indexing"],
        },
        {
          id: "3pack",
          name: "3-Pack Starter Pass",
          credits: 3,
          price: platformSettings ? Number(platformSettings.owner_commercial_3pack_price) : 449,
          originalPrice: platformSettings ? Math.round(Number(platformSettings.owner_commercial_fee) * 3) : 597,
          badge: "MOST POPULAR",
          saveBadge: platformSettings && Number(platformSettings.owner_commercial_fee) > 0 ? `Save ${Math.round((1 - (Number(platformSettings.owner_commercial_3pack_price) / (Number(platformSettings.owner_commercial_fee) * 3))) * 100)}%` : "Save 25%",
          features: ["3 Commercial Property Submissions", "Valid Until Rented (Never Expires)", "Priority Corporate Listing Badge", "Zero Brokerage Guaranteed"],
        },
        {
          id: "6pack",
          name: "6-Pack VIP Pass",
          credits: 6,
          price: platformSettings ? Number(platformSettings.owner_commercial_6pack_price) : 799,
          originalPrice: platformSettings ? Math.round(Number(platformSettings.owner_commercial_fee) * 6) : 1194,
          badge: "BEST VALUE",
          saveBadge: platformSettings && Number(platformSettings.owner_commercial_fee) > 0 ? `Save ${Math.round((1 - (Number(platformSettings.owner_commercial_6pack_price) / (Number(platformSettings.owner_commercial_fee) * 6))) * 100)}%` : "Save 33%",
          features: ["6 Commercial Property Submissions", "Valid Until Rented (Never Expires)", "Top Search Placement Badge", "Free Commercial Agreement Drafts"],
        },
        {
          id: "10pack",
          name: "10-Pack Builder Pass",
          credits: 10,
          price: platformSettings ? Number(platformSettings.owner_commercial_10pack_price) : 1199,
          originalPrice: platformSettings ? Math.round(Number(platformSettings.owner_commercial_fee) * 10) : 1990,
          badge: "PRO BUILDER",
          saveBadge: platformSettings && Number(platformSettings.owner_commercial_fee) > 0 ? `Save ${Math.round((1 - (Number(platformSettings.owner_commercial_10pack_price) / (Number(platformSettings.owner_commercial_fee) * 10))) * 100)}%` : "Save 40%",
          features: ["10 Commercial Property Submissions", "Valid Until Rented (Never Expires)", "Featured Commercial Ribbon", "Dedicated Account Manager"],
        },
      ],
    },
  };

  const handleUpiSubmit = async (e) => {
    e.preventDefault();
    if (!utrNumber || utrNumber.length < 8) {
      toast.error("Please enter a valid UTR number.");
      return;
    }
    setIsVerifyingUtr(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/properties/owner-passes/verify/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          plan_id: upiOrderData.plan_id,
          category: selectedPassCategory,
          credits_count: upiOrderData.credits_count,
          payment_method: 'upi',
          utr: utrNumber
        })
      });
      const verifyData = await res.json();
      if (res.ok) {
        if (verifyData.pass_id) {
          setSuccessPassId(verifyData.pass_id);
        } else {
          toast.success(`🎉 ${verifyData.detail || "Pass activated successfully!"}`);
        }
        setShowUpiModal(false);
        fetchProperties();
      } else {
        toast.error(verifyData.detail || "Payment verification failed");
      }
    } catch (err) {
      toast.error("Verification error: " + err.message);
    } finally {
      setIsVerifyingUtr(false);
    }
  };

  const handleBuyPass = async (planId, passCategory = selectedPassCategory) => {
    setBuyingPassLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/properties/owner-passes/initiate/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ plan_id: planId, category: passCategory }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to initiate pass order.");
      }

      const data = await res.json();

      if (data.bypassed) {
        if (data.pass_id) {
          setSuccessPassId(data.pass_id);
        } else {
          toast.success(`🎉 Pass activated! ${data.detail || "Credits added."}`);
        }
        fetchProperties();
        return;
      }

      if (data.payment_gateway === 'upi') {
        setUpiOrderData(data);
        setShowUpiModal(true);
        return;
      }

      const loaded = await loadRazorpayScript();
      if (!loaded) {
        toast.error("Razorpay SDK failed to load. Check your internet connection.");
        return;
      }

      const options = {
        key: data.key_id,
        amount: data.amount,
        currency: "INR",
        name: "Rentlo Owner Listing Pass",
        description: `Listing Pass Refill (${data.credits_count} Credits - ${passCategory.toUpperCase()})`,
        order_id: data.order_id,
        handler: async (response) => {
          try {
            const verifyRes = await fetch(`${import.meta.env.VITE_API_URL}/properties/owner-passes/verify/`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                order_id: response.razorpay_order_id,
                payment_id: response.razorpay_payment_id,
                signature: response.razorpay_signature,
                plan_id: planId,
                category: passCategory,
                credits_count: data.credits_count,
              }),
            });

            if (verifyRes.ok) {
              const verifyData = await verifyRes.json();
              if (verifyData.pass_id) {
                setSuccessPassId(verifyData.pass_id);
              } else {
                toast.success(`🎉 ${verifyData.detail}`);
              }
              fetchProperties();
            } else {
              toast.error("Payment verification failed. If money was deducted, credits will be added automatically.");
            }
          } catch (e) {
            toast.error("Verification error: " + e.message);
          }
        },
        prefill: {
          name: user?.first_name || user?.username,
          email: user?.email,
          contact: user?.phone,
        },
        theme: { color: "#10b981" },
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.open();
    } catch (err) {
      toast.error(err.message || "Failed to purchase pass");
    } finally {
      setBuyingPassLoading(false);
    }
  };

  const statusConfig = {
    live: {
      label: "🟢 Live",
      color: "bg-black/15 text-slate-800 dark:text-black border border-indigo-600/30",
    },
    under_negotiation: {
      label: "⏸ Under Negotiation",
      color: "bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/30",
    },
    rented: {
      label: "🏠 Rented",
      color: "bg-blue-500/15 text-blue-600 dark:text-blue-300 border border-blue-500/30",
    },
    pending_review: {
      label: "⏳ Pending Review",
      color: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30",
    },
    rejected: {
      label: "❌ Rejected",
      color: "bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30",
    },
    draft: {
      label: "📝 Draft",
      color: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/30",
    },
  };

  // KPI Calculations
  const totalProperties = properties.length;
  const liveCount = properties.filter((p) => p.status === "live").length;
  const totalUnlocks = properties.reduce(
    (acc, p) => acc + (p.unlock_count || 0),
    0
  );
  const inTalksCount = properties.filter(
    (p) => p.status === "under_negotiation" || p.status === "rented"
  ).length;

  // Filtered properties
  const filteredProperties = properties.filter((prop) => {
    if (selectedStatusFilter === "all" && prop.status === "rejected") {
      return false;
    }
    if (selectedStatusFilter !== "all" && prop.status !== selectedStatusFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const title = `${prop.bedrooms ? prop.bedrooms + " BHK " : ""}${prop.property_type}`.toLowerCase();
      const locality = (prop.locality_details?.name || "").toLowerCase();
      const city = (prop.locality_details?.city_name || "").toLowerCase();
      return (
        title.includes(q) ||
        locality.includes(q) ||
        city.includes(q) ||
        String(prop.id).includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome Banner & Action Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r bg-slate-50 border border-indigo-600/20 p-6 md:p-6 rounded-3xl shadow-sm relative overflow-hidden">
        <div className="space-y-1 relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-black/10 border border-indigo-600/20 text-indigo-600 text-xs font-bold tracking-wide uppercase mb-1">
            <span className="material-symbols-outlined text-sm">real_estate_agent</span>
            <Translate>Owner Console</Translate>
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-ink">
            <Translate>Welcome back,</Translate> {user?.first_name || user?.username || "Owner"} 👋
          </h2>
          <p className="text-[13.5px] text-text-muted max-w-xl">
            <Translate>Manage your rental listings, monitor buyer unlock inquiries, track visit slots, and update negotiation statuses in real-time.</Translate>
          </p>
        </div>

        <div className="flex items-center gap-4 relative z-10">
          <button
            type="button"
            onClick={() => setShowCreditsModal(true)}
            className="px-4 py-4 bg-gradient-to-r bg-slate-100 border border-indigo-600/30 hover:border-indigo-600/60 text-black rounded-2xl text-sm font-black shadow-sm transition-all flex items-center gap-2 cursor-pointer hover:-translate-y-0.5"
          >
            <span className="material-symbols-outlined text-xl text-slate-800">stars</span>
            {ownerCredits?.total_credits_remaining > 0 ? (
              <>
                {ownerCredits.total_credits_remaining} <Translate>Listing Credit</Translate>
                {ownerCredits.total_credits_remaining === 1 ? "" : "s"}
              </>
            ) : (
              <Translate>Buy Listing Pass</Translate>
            )}
          </button>

          <Link
            to="/owner/new-listing"
            className="px-4 py-4 bg-slate-950 hover:bg-slate-900 border border-slate-800/80 text-white rounded-2xl text-[13.5px] font-extrabold shadow-md transition-all duration-200 flex items-center gap-2 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">add_circle</span>
            <Translate>Post New Property</Translate>
          </Link>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Total Properties",
            value: totalProperties,
            icon: "home_work",
            color: "text-slate-800 bg-slate-50 border-slate-200 shadow-none",
          },
          {
            label: "Live Listings",
            value: liveCount,
            icon: "verified",
            color: "text-slate-800 bg-slate-50 border-slate-200 shadow-none",
          },
          {
            label: "Buyer Unlocks",
            value: totalUnlocks,
            icon: "contacts",
            color: "text-slate-800 bg-slate-50 border-slate-200 shadow-none",
          },
          {
            label: "In Talks / Rented",
            value: inTalksCount,
            icon: "handshake",
            color: "text-slate-800 bg-slate-50 border-slate-200 shadow-none",
          },
        ].map((kpi, idx) => (
          <div
            key={idx}
            className="bg-surface border border-border p-4 rounded-2xl flex items-center justify-between hover-lift shadow-sm hover:shadow-lg transition-all duration-300 group cursor-pointer"
          >
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
                <Translate>{kpi.label}</Translate>
              </span>
              <p className="text-2xl md:text-3xl font-extrabold text-ink group-hover:text-slate-800 transition-colors">
                {kpi.value}
              </p>
            </div>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-md transition-transform duration-300 group-hover:scale-110 ${kpi.color}`}>
              <span className="material-symbols-outlined text-2xl">{kpi.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Tabs & Search Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0 custom-scrollbar">
          {[
            { id: "all", label: "All Properties" },
            { id: "live", label: "🟢 Live" },
            { id: "under_negotiation", label: "⏸ Under Negotiation" },
            { id: "rented", label: "🏠 Rented" },
            { id: "pending_review", label: "⏳ Pending Review" },
            { id: "rejected", label: "🔴 Rejected Listings" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedStatusFilter(tab.id)}
              className={`px-4 py-2 rounded-xl text-[12.5px] font-bold whitespace-nowrap transition-all duration-200 cursor-pointer flex-shrink-0 ${
                selectedStatusFilter === tab.id
                  ? "bg-black text-white shadow-md shadow-slate-900/20"
                  : "bg-surface border border-border text-text-muted hover:text-ink hover:bg-surface-alt"
              }`}
            >
              <Translate>{tab.label}</Translate>
            </button>
          ))}
        </div>

        {/* Quick Search */}
        <div className="relative w-full sm:w-64">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-lg text-text-muted pointer-events-none">
            search
          </span>
          <input
            type="text"
            placeholder="Search properties or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-4 py-2 h-10 rounded-xl bg-surface border border-border text-[12.5px] font-medium outline-none focus:border-indigo-600 transition-colors"
          />
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex flex-col justify-center items-center py-24 gap-4">
          <div className="w-10 h-10 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
          <p className="text-sm font-medium text-text-muted">Fetching your listings...</p>
        </div>
      ) : filteredProperties.length === 0 ? (
        <div className="bg-surface border border-border rounded-3xl p-12 flex flex-col items-center justify-center text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-black/10 text-indigo-600 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-[36px]">real_estate_agent</span>
          </div>
          <h3 className="text-xl font-bold text-ink mb-2">No properties found</h3>
          <p className="text-sm text-text-muted max-w-md mb-6">
            {selectedStatusFilter !== "all" || searchQuery
              ? "No properties match your active filter criteria."
              : "You haven't listed any properties yet. Post your first listing to start connecting with buyers."}
          </p>
          <Link
            to="/owner/new-listing"
            className="px-6 py-4 bg-slate-900 text-white rounded-2xl text-sm font-bold shadow-md shadow-black/10 hover:shadow-lg transition-all"
          >
            List Your First Property
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
          {filteredProperties.map((prop) => {
            const sc =
              statusConfig[prop.status] || {
                label: prop.status,
                color: "bg-slate-500/15 text-slate-500 border border-slate-500/30",
              };
            const unlockCount = prop.unlock_count || 0;

            return (
              <div
                key={prop.id}
                className="group bg-surface border border-border rounded-3xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col"
              >
                {/* Image Header Container */}
                <div className="h-52 bg-surface-alt relative overflow-hidden">
                  <PropertyImageSlideshow media={prop.media} propertyType={prop.property_type} />

                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none" />

                  {/* Status Badge */}
                  <div
                    className={`absolute top-4 left-4 px-4 py-1 rounded-xl text-[10.5px] font-bold tracking-wide backdrop-blur-md shadow-md ${sc.color}`}
                  >
                    <Translate>{sc.label}</Translate>
                  </div>

                  {/* Contact Unlocks Badge */}
                  {unlockCount > 0 && (
                    <div className="absolute top-4 right-4 flex items-center gap-2 px-4 py-1 bg-gradient-to-r from-orange-500 to-amber-500 backdrop-blur-md text-white rounded-xl text-[10.5px] font-extrabold shadow-lg">
                      <span className="material-symbols-outlined text-sm">contacts</span>
                      {unlockCount} <Translate>{unlockCount === 1 ? "buyer" : "buyers"} contacted</Translate>
                    </div>
                  )}

                  {/* Bottom Image Overlay Details */}
                  <div className="absolute bottom-4 left-4 right-4 text-white flex items-end justify-between">
                    <div>
                      <p className="text-2xl font-black drop-shadow-md">
                        ₹{parseFloat(prop.price).toLocaleString("en-IN")}
                        <span className="text-xs font-normal text-white/80">/mo</span>
                      </p>
                    </div>
                    <span className="text-xs font-bold px-2 py-1 rounded-md bg-black/50 backdrop-blur text-white/90 border border-white/20">
                      ID #{prop.id}
                    </span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 flex flex-col flex-1 gap-4">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-base font-bold text-ink capitalize line-clamp-1">
                        <Translate>{prop.bedrooms ? `${prop.bedrooms} BHK ` : ""}{String(prop.property_type).replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</Translate>
                      </h4>
                      {prop.status === "live" && prop.expires_at && (() => {
                        const diffTime = new Date(prop.expires_at) - new Date();
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        if (diffDays > 0) {
                          return (
                            <span 
                              className={`px-2 py-1 rounded-lg text-xs font-extrabold tracking-wide whitespace-nowrap shrink-0 ${
                                diffDays <= 10 
                                  ? "bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 animate-pulse" 
                                  : "bg-black/10 text-indigo-600 border border-indigo-600/20"
                              }`}
                            >
                              ⏳ {diffDays} {diffDays === 1 ? "Day" : "Days"} Left
                            </span>
                          );
                        } else {
                          return (
                            <span className="px-2 py-1 rounded-lg text-xs font-extrabold tracking-wide bg-indigo-500/15 text-indigo-500 border border-indigo-500/30 whitespace-nowrap shrink-0">
                              Expired ⚠️
                            </span>
                          );
                        }
                      })()}
                    </div>
                    <p className="text-xs text-text-muted flex items-center gap-1 mt-1">
                      <span className="material-symbols-outlined text-sm text-indigo-600">location_on</span>
                      <Translate>{prop.locality_details?.name || "Locality"}</Translate>, <Translate>{prop.locality_details?.city_name || "City"}</Translate>
                    </p>
                  </div>

                  {/* Contextual Status Info Alert Cards */}
                  {(prop.property_category === "pg" ||
                    prop.property_type === "pg" ||
                    prop.property_type === "pg_hostel" ||
                    (prop.property_type && prop.property_type.startsWith("pg"))) && (
                    <div className="p-4 rounded-2xl bg-white text-black shadow-md border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <span className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-2">
                          <span className="material-symbols-outlined text-base">hotel</span>
                          PG / Hostel Room Tracker
                        </span>
                      </div>

                      {/* Visual Bed Occupancy & Resident Tracker */}
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-xs font-extrabold text-slate-400 flex items-center gap-1">
                          <span className="material-symbols-outlined text-base text-black">group</span>
                          Occupied: <strong className="text-black">{Math.max(0, (prop.total_beds || 0) - (prop.available_beds || 0))} Persons</strong>
                        </span>
                        <span className="text-xs font-black px-2 py-1 rounded-full bg-slate-100 text-black border border-slate-200">
                          {prop.available_beds || 0} / {prop.total_beds || 0} Beds Available
                        </span>
                      </div>

                      {/* Visual Occupancy Progress Bar */}
                      {prop.total_beds > 0 && (
                        <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden border border-slate-300">
                          <div
                            className="bg-indigo-600 h-full transition-all duration-300"
                            style={{
                              width: `${Math.min(
                                100,
                                Math.max(
                                  0,
                                  Math.round(
                                    ((prop.total_beds - (prop.available_beds || 0)) / prop.total_beds) * 100
                                  )
                                )
                              )}%`,
                            }}
                          />
                        </div>
                      )}

                      {/* Room Sharing Specific Quick Bed Controls */}
                      {(() => {
                        const inv = prop.pg_rules?.room_inventory;
                        const types = [
                          { key: "single", label: "Single Private Room", icon: "bed", beds: 1 },
                          { key: "double", label: "Double Sharing", icon: "king_bed", beds: 2 },
                          { key: "triple", label: "Triple Sharing", icon: "hotel", beds: 3 },
                          { key: "four_plus", label: "4+ Bed Sharing", icon: "single_bed", beds: 4 },
                        ];

                        const enabledTypes = inv && typeof inv === 'object'
                          ? types.filter(t => inv[t.key] && inv[t.key].enabled)
                          : [];

                        if (enabledTypes.length > 0) {
                          return (
                            <div className="space-y-2 pt-2 border-t border-slate-800">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                                  Mark Bed Check-In / Check-Out
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingBedProp(prop);
                                    const existingInv = prop.pg_rules?.room_inventory || {};
                                    const defaultPrice = Number(prop.price) || 5000;
                                    const defaultAvail = Number(prop.available_beds) || 0;
                                    const defaultTotal = Number(prop.total_beds) || 1;

                                    setBedForm({
                                      total_beds: defaultTotal,
                                      available_beds: defaultAvail,
                                      room_inventory: {
                                        single: existingInv.single || { enabled: true, rooms: Math.max(1, defaultTotal), beds_per_room: 1, available_beds: defaultAvail, rent: defaultPrice },
                                        double: existingInv.double || { enabled: false, rooms: 0, beds_per_room: 2, available_beds: 0, rent: Math.round(defaultPrice * 0.8) },
                                        triple: existingInv.triple || { enabled: false, rooms: 0, beds_per_room: 3, available_beds: 0, rent: Math.round(defaultPrice * 0.7) },
                                        four_plus: existingInv.four_plus || { enabled: false, rooms: 0, beds_per_room: 4, available_beds: 0, rent: Math.round(defaultPrice * 0.6) },
                                      }
                                    });
                                  }}
                                  className="text-xs font-extrabold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-sm">edit_note</span>
                                  Configure Inventory
                                </button>
                              </div>

                              <div className="space-y-1.5">
                                {enabledTypes.map((t) => {
                                  const item = inv[t.key];
                                  const openBeds = Number(item.available_beds) || 0;
                                  const totBeds = (Number(item.rooms) || 0) * (Number(item.beds_per_room) || t.beds);
                                  return (
                                    <div key={t.key} className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-all">
                                      <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-lg text-black">{t.icon}</span>
                                        <div>
                                          <div className="text-xs font-black text-black">{t.label}</div>
                                          <div className="text-[9.5px] font-extrabold text-slate-400">
                                            <span className={openBeds > 0 ? "text-black font-black" : "text-red-400 font-black"}>{openBeds} Open</span> / {totBeds} Total Beds
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => handlePGOccupancy(prop.id, "rent_bed", { room_type: t.key })}
                                          disabled={openBeds <= 0}
                                          className="px-2 py-1 rounded-lg bg-black hover:bg-black text-white text-[9.5px] font-black flex items-center gap-1 disabled:opacity-30 transition-all cursor-pointer shadow-xs"
                                          title={`Mark 1 bed rented under ${t.label}`}
                                        >
                                          <span className="material-symbols-outlined text-sm">person_add</span>
                                          + Rent
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handlePGOccupancy(prop.id, "vacate_bed", { room_type: t.key })}
                                          disabled={openBeds >= totBeds}
                                          className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[9.5px] font-black flex items-center gap-1 disabled:opacity-30 transition-all cursor-pointer shadow-xs"
                                          title={`Mark 1 bed vacated under ${t.label}`}
                                        >
                                          <span className="material-symbols-outlined text-sm">person_remove</span>
                                          - Vacate
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        }

                        // Fallback controls if no custom room_inventory setup yet
                        return (
                          <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-800">
                            <button
                              type="button"
                              onClick={() => handlePGOccupancy(prop.id, "rent_bed")}
                              disabled={prop.available_beds <= 0}
                              className="px-2 py-2 rounded-xl bg-black hover:bg-black text-white text-xs font-black flex items-center justify-center gap-1 transition-all disabled:opacity-40 cursor-pointer shadow-xs"
                              title="Record 1 resident check-in (marks 1 bed rented)"
                            >
                              <span className="material-symbols-outlined text-sm">person_add</span>
                              + Resident Came
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePGOccupancy(prop.id, "vacate_bed")}
                              className="px-2 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-black flex items-center justify-center gap-1 transition-all cursor-pointer shadow-xs"
                              title="Record 1 resident check-out (marks 1 bed free)"
                            >
                              <span className="material-symbols-outlined text-sm">person_remove</span>
                              - Resident Left
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingBedProp(prop);
                                const existingInv = prop.pg_rules?.room_inventory || {};
                                const defaultPrice = Number(prop.price) || 5000;
                                const defaultAvail = Number(prop.available_beds) || 0;
                                const defaultTotal = Number(prop.total_beds) || 1;

                                setBedForm({
                                  total_beds: defaultTotal,
                                  available_beds: defaultAvail,
                                  room_inventory: {
                                    single: existingInv.single || { enabled: true, rooms: Math.max(1, defaultTotal), beds_per_room: 1, available_beds: defaultAvail, rent: defaultPrice },
                                    double: existingInv.double || { enabled: false, rooms: 0, beds_per_room: 2, available_beds: 0, rent: Math.round(defaultPrice * 0.8) },
                                    triple: existingInv.triple || { enabled: false, rooms: 0, beds_per_room: 3, available_beds: 0, rent: Math.round(defaultPrice * 0.7) },
                                    four_plus: existingInv.four_plus || { enabled: false, rooms: 0, beds_per_room: 4, available_beds: 0, rent: Math.round(defaultPrice * 0.6) },
                                  }
                                });
                              }}
                              className="px-2 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-black border border-orange-500/30 text-xs font-extrabold flex items-center justify-center gap-1 transition-all cursor-pointer shadow-xs"
                              title="Edit total & available bed capacity"
                            >
                              <span className="material-symbols-outlined text-sm">edit_note</span>
                              Edit Beds
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {prop.status === "live" && unlockCount > 0 && (
                    <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200 text-orange-600 dark:text-black">
                      <p className="text-[11.5px] font-semibold flex items-start gap-2 leading-relaxed">
                        <span className="material-symbols-outlined text-base flex-shrink-0 mt-1 text-black">notifications_active</span>
                        <span>
                          <strong>{unlockCount} {unlockCount === 1 ? "buyer has" : "buyers have"} unlocked your contact details.</strong> Click <em>"I'm In Talks"</em> when negotiating to pause new unlocks.
                        </span>
                      </p>
                    </div>
                  )}

                  {prop.status === "under_negotiation" && (
                    <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-300">
                      <p className="text-[11.5px] font-semibold flex items-start gap-2 leading-relaxed">
                        <span className="material-symbols-outlined text-base flex-shrink-0 mt-1 text-purple-500">pause_circle</span>
                        <span>
                          Unlocks are currently <strong>paused</strong> for negotiation. Mark it <strong>Rented</strong> when finalized, or <strong>Reopen</strong> if talks fall through.
                        </span>
                      </p>
                    </div>
                  )}

                  {prop.status === "rented" && (
                    <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-300">
                      <p className="text-[11.5px] font-semibold flex items-start gap-2 leading-relaxed">
                        <span className="material-symbols-outlined text-base flex-shrink-0 mt-1 text-blue-500">check_circle</span>
                        <span>
                          Property is marked as rented. Click <strong>Relist</strong> whenever it becomes available again.
                        </span>
                      </p>
                    </div>
                  )}

                  {prop.status === "rejected" && (
                    <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-600 dark:text-indigo-300">
                      <p className="text-[11.5px] font-semibold flex items-start gap-2 leading-relaxed">
                        <span className="material-symbols-outlined text-base flex-shrink-0 mt-1 text-indigo-500">cancel</span>
                        <span>
                          <strong>Listing Rejected by Moderation:</strong> {prop.rejection_reason || "Admin requested corrections to listing details."}
                        </span>
                      </p>
                    </div>
                  )}

                  {prop.status === "expired" && (
                    <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700">
                      <p className="text-[11.5px] font-semibold flex items-start gap-2 leading-relaxed">
                        <span className="material-symbols-outlined text-base flex-shrink-0 mt-1 text-red-500">timer_off</span>
                        <span>
                          <strong>Listing Expired.</strong> Your PG pass validity ran out. Click <strong>Renew &amp; Go Live</strong> below — it will use 1 credit from your active pass to relist immediately.
                        </span>
                      </p>
                    </div>
                  )}

                  {/* Action Buttons Section */}
                  <div className="mt-auto pt-4 border-t border-border space-y-2">
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => handleEditClick(prop)}
                        className="w-full px-4 py-2 rounded-xl bg-slate-900/10 hover:bg-slate-900/20 text-slate-800 dark:text-slate-200 border border-slate-900/20 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm mb-1"
                      >
                        <span className="material-symbols-outlined text-base">edit</span>
                        Edit Listing Details
                      </button>
                      {/* Live → Under Negotiation */}
                      {prop.status === "live" && (
                        <button
                          onClick={() => setStatusTarget({ id: prop.id, status: "under_negotiation" })}
                          className="w-full px-4 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-300 border border-purple-500/30 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                        >
                          <span className="material-symbols-outlined text-base">handshake</span>
                          I'm In Talks — Pause Unlocks
                        </button>
                      )}

                      {/* Under Negotiation → Mark Rented OR Reopen */}
                      {prop.status === "under_negotiation" && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => setStatusTarget({ id: prop.id, status: "rented" })}
                            className="flex-1 px-4 py-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-300 border border-blue-500/30 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                          >
                            <span className="material-symbols-outlined text-base">home</span>
                            Deal Done — Rented
                          </button>
                          <button
                            onClick={() => handleStatusUpdate(prop.id, "live")}
                            className="flex-1 px-4 py-2 rounded-xl bg-slate-500/10 hover:bg-slate-500/20 text-slate-600 dark:text-slate-300 border border-slate-500/30 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                          >
                            <span className="material-symbols-outlined text-base">replay</span>
                            Deal Fell Through
                          </button>
                        </div>
                      )}

                      {/* Live → Mark Rented directly */}
                      {prop.status === "live" && (
                        <button
                          onClick={() => setStatusTarget({ id: prop.id, status: "rented" })}
                          className="w-full px-4 py-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-300 border border-blue-500/30 text-[11.5px] font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-base">key</span>
                          Mark as Rented
                        </button>
                      )}

                      {/* Rented → Relist */}
                      {prop.status === "rented" && (
                        <button
                          onClick={() => handleRelistClick(prop)}
                          className="w-full px-4 py-2 rounded-xl bg-black/10 hover:bg-black/20 text-slate-800 dark:text-black border border-indigo-600/30 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                        >
                          <span className="material-symbols-outlined text-base">restart_alt</span>
                          Relist — Available Again
                        </button>
                      )}

                      {/* Expired → Relist (pass validity ran out) */}
                      {prop.status === "expired" && (
                        <button
                          onClick={() => handleRelistClick(prop)}
                          className="w-full px-4 py-2 rounded-xl text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                          style={{ backgroundColor: "#000000" }}
                        >
                          <span className="material-symbols-outlined text-base">autorenew</span>
                          Renew &amp; Go Live Again
                        </button>
                      )}

                      {/* Lease Agreement Shortcut (ONLY shown AFTER property is rented) */}
                      {prop.status === "rented" && (
                        <Link
                          to={`/property/${prop.id}/lease`}
                          className="w-full px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                        >
                          <span className="material-symbols-outlined text-base">description</span>
                          Draft Official Lease Agreement
                        </Link>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs font-medium text-text-muted">Status: {sc.label}</span>
                      <Link
                        to={`/property/${prop.id}`}
                        className="text-xs font-extrabold text-indigo-600 hover:underline flex items-center gap-1"
                      >
                        View listing
                        <span className="material-symbols-outlined text-sm">arrow_forward</span>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Owner Passes & Credits Management Modal */}
      {showCreditsModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-6 overflow-y-auto pt-14 pb-20 sm:items-center sm:py-8" style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
          <div className="rounded-3xl max-w-5xl w-full p-4 sm:p-8 shadow-2xl relative max-h-[85vh] sm:max-h-[90vh] overflow-y-auto scrollbar-none animate-in fade-in zoom-in-95 duration-200" style={{ backgroundColor: "var(--surface)", color: "var(--ink)", border: "1px solid var(--border)" }}>
            {/* Header */}
            <div className="flex items-center justify-between pb-6 border-b" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br bg-black flex items-center justify-center text-slate-950 shadow-lg shadow-black/10">
                  <span className="material-symbols-outlined text-3xl font-black">workspace_premium</span>
                </div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2" style={{ color: "var(--ink)" }}>
                    Owner Listing Passes & Refills
                  </h3>
                  <p className="text-xs sm:text-sm font-medium" style={{ color: "var(--text-muted)" }}>
                    Choose property category and select refill credit passes with zero brokerage.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreditsModal(false)}
                className="w-10 h-10 rounded-2xl flex items-center justify-center transition-colors cursor-pointer border" style={{ backgroundColor: "var(--surface-alt)", color: "var(--text-muted)", borderColor: "var(--border)" }}
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Current Balance & Active Credits Banner */}
            <div className="my-6 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden" style={{ background: "#000000", boxShadow: "0 4px 24px rgba(0,0,0,0.25)" }}>
              <div className="relative z-10 space-y-2">
                  <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full text-xs font-black uppercase tracking-wider" style={{ backgroundColor: "rgba(255,255,255,0.2)", color: "#fff" }}>
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                  Active Balance
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-black text-white">
                    {ownerCredits?.total_credits_remaining || 0}
                  </span>
                  <span className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.85)" }}>
                    Listing Credit{(ownerCredits?.total_credits_remaining || 0) === 1 ? "" : "s"} Remaining
                  </span>
                </div>

                {/* Category Pass Breakdown Badges */}
                {ownerCredits?.active_passes && ownerCredits.active_passes.length > 0 ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {ownerCredits.active_passes.map((pass) => {
                      const cat = (pass.category || "all").toLowerCase();
                      const catLabel =
                        cat === "residential"
                          ? "Residential Pass"
                          : cat === "apartment" || cat === "pg"
                          ? "Apartment & PG Pass"
                          : cat === "commercial"
                          ? "Commercial Pass"
                          : "All-Category Pass";
                      const icon =
                        cat === "residential"
                          ? "home"
                          : cat === "commercial"
                          ? "store"
                          : cat === "apartment" || cat === "pg"
                          ? "apartment"
                          : "stars";
                      return (
                        <div
                          key={pass.id}
                          className="px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2" style={{ backgroundColor: "rgba(255,255,255,0.2)", color: "#fff" }}
                        >
                          <span className="material-symbols-outlined text-base text-white">{icon}</span>
                          <span>{catLabel}:</span>
                          <span className="font-black text-white">
                            {pass.credits_remaining} / {pass.credits_total} Credits
                          </span>
                          <button
                            onClick={() => window.open(`${import.meta.env.VITE_API_URL}/owner-passes/${pass.id}/receipt/`, "_blank")}
                            className="ml-2 bg-black/20 hover:bg-black/40 text-white p-1 rounded-lg transition-colors flex items-center justify-center"
                            title="Download Receipt"
                          >
                            <span className="material-symbols-outlined text-[14px]">download</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.85)" }}>
                    No active pass credits available. Select a category below to refill listing credits!
                  </p>
                )}
              </div>

              <Link
                to="/owner/new-listing"
                onClick={() => setShowCreditsModal(false)}
                className="px-4 py-4 bg-gradient-to-r bg-white hover:bg-slate-200 text-black text-xs font-black uppercase tracking-wider rounded-2xl transition-all shadow-lg shadow-black/10 flex items-center justify-center gap-2 cursor-pointer shrink-0 border border-slate-300"
              >
                <span className="material-symbols-outlined text-lg">add_circle</span>
                Publish Listing Now
              </Link>
            </div>

            {/* Category Selector Tabs */}
            {!selectedPassCategory && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider flex items-center gap-2" style={{ color: "#0F172A" }}>
                    <span className="material-symbols-outlined text-black text-xl">category</span>
                    Select Property Category For Refill Plans:
                  </h4>
                  <span className="text-xs font-bold" style={{ color: "#64748B" }}>
                    Prices dynamically customized per property category
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {Object.keys(CATEGORY_PLANS).map((catKey) => {
                    const catObj = CATEGORY_PLANS[catKey];
                    const isSelected = selectedPassCategory === catKey;
                    return (
                      <button
                        key={catKey}
                        type="button"
                        onClick={() => setSelectedPassCategory(catKey)}
                        className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative flex flex-col justify-between ${
                          isSelected
                            ? "border-2 shadow-md ring-2"
                            : "hover:border-slate-300"
                        }`}
                        style={isSelected ? { backgroundColor: "#ffffff", borderColor: "#000000", boxShadow: "0 4px 16px rgba(0,0,0,0.15)", ringColor: "rgba(0,0,0,0.3)" } : { backgroundColor: "#f8fafc", borderColor: "#e2e8f0", color: "#475569" }}
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`material-symbols-outlined text-xl ${
                                isSelected ? "text-slate-800" : "text-slate-400"
                              }`}
                            >
                              {catObj.icon}
                            </span>
                            <span className="font-black text-sm" style={{ color: isSelected ? "#000000" : "#0F172A" }}>{catObj.shortLabel}</span>
                          </div>
                          {isSelected && (
                            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 shadow-xs shadow-black/10"></span>
                          )}
                        </div>
                        <p className="text-xs leading-relaxed line-clamp-2 opacity-80">{catObj.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Available Refill Passes Store */}
            {selectedPassCategory && (
              <div className="mt-8 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4" style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <div className="flex flex-col items-start gap-2 w-full">
                    <button
                      type="button"
                      onClick={() => setSelectedPassCategory(null)}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-xs font-extrabold uppercase tracking-widest text-slate-700 transition-all cursor-pointer shadow-sm hover:scale-102 w-fit"
                    >
                      <span className="material-symbols-outlined text-base font-black">arrow_back</span>
                      Back
                    </button>
                    <div className="flex items-start gap-2 pt-1">
                      <span className="material-symbols-outlined text-black text-xl shrink-0 mt-1">shopping_bag</span>
                      <h4 className="text-sm font-black uppercase tracking-wider leading-snug" style={{ color: "#0F172A" }}>
                        {CATEGORY_PLANS[selectedPassCategory]?.label} Listing Passes
                      </h4>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-black bg-black/10 px-2 py-1 rounded-full border border-indigo-600/20 w-fit self-end sm:self-auto">
                    ⚡ Instant Activation
                  </span>
                </div>

                {/* 4 Plan Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {CATEGORY_PLANS[selectedPassCategory]?.plans.map((plan) => (
                    <div
                      key={plan.id}
                      className={`p-4 rounded-3xl border transition-all duration-300 flex flex-col justify-between relative ${
                        plan.highlight
                          ? "border-2"
                          : "hover:border-slate-300"
                      }`}
                      style={plan.highlight ? { backgroundColor: "#ffffff", borderColor: "#000000", boxShadow: "0 8px 32px rgba(0,0,0,0.15)" } : { backgroundColor: "#f8fafc", borderColor: "#e2e8f0" }}
                    >
                      {plan.badge && (
                        <div className="flex items-center justify-between gap-1 mb-2">
                          <span className="px-2 py-1 rounded-full text-xs font-black uppercase tracking-wider" style={{ backgroundColor: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0" }}>
                            {plan.badge}
                          </span>
                          {plan.saveBadge && (
                            <span className="px-2 py-1 rounded-full text-xs font-black uppercase tracking-wider" style={{ backgroundColor: "#dcfce7", color: "#059669", border: "1px solid #bbf7d0" }}>
                              {plan.saveBadge}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="space-y-3">
                        <h5 className="text-base font-black" style={{ color: "#0F172A" }}>{plan.name}</h5>

                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-black" style={{ color: "#0F172A" }}>₹{plan.price}</span>
                          {plan.originalPrice && (
                            <span className="text-xs line-through font-bold" style={{ color: "#94a3b8" }}>
                              ₹{plan.originalPrice}
                            </span>
                          )}
                          <span className="text-xs font-medium ml-auto" style={{ color: "#64748b" }}>
                            ({plan.credits} {plan.credits === 1 ? "Credit" : "Credits"})
                          </span>
                        </div>

                        <ul className="space-y-2 pt-2" style={{ borderTop: "1px solid #e2e8f0" }}>
                          {plan.features.map((feat, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs font-medium leading-tight" style={{ color: "#475569" }}>
                              <span className="material-symbols-outlined text-sm text-black shrink-0 mt-1">
                                check_circle
                              </span>
                              <span>{feat}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <button
                        type="button"
                        disabled={buyingPassLoading}
                        onClick={() => handleBuyPass(plan.id, selectedPassCategory)}
                        className={`w-full mt-4 py-4 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 ${
                          plan.highlight
                            ? "shadow-md"
                            : ""
                        } disabled:opacity-50`}
                        style={plan.highlight ? { backgroundColor: "#000000", color: "#FFFFFF", border: "none" } : { backgroundColor: "#FFFFFF", color: "#000000", border: "1px solid #000000" }}
                      >
                        {buyingPassLoading ? (
                          <>
                            <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                            Processing...
                          </>
                        ) : (
                          `Buy ${plan.credits} ${plan.credits === 1 ? "Credit" : "Credits"}`
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer Trust Badges */}
            <div className="mt-8 pt-4 flex flex-wrap items-center justify-between gap-4 text-xs font-bold" style={{ borderTop: "1px solid #e2e8f0", color: "#64748b" }}>
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-black">bolt</span> Instant Credit Activation
              </span>
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-black">all_inclusive</span> Credits Never Expire
              </span>
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-black">verified_user</span> 100% Secure Razorpay Checkout
              </span>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Edit Bed Capacity & Room Inventory Configurator Modal */}
      {editingBedProp && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto animate-fade-in" style={{ backgroundColor: "rgba(0,0,0,0.45)" }}>
          <div className="rounded-3xl p-6 max-w-xl w-full shadow-2xl space-y-5 my-8 max-h-[90vh] overflow-y-auto scrollbar-thin border" style={{ backgroundColor: "var(--surface)", color: "var(--ink)", borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-black text-2xl">hotel</span>
                <div>
                  <h3 className="font-extrabold text-lg" style={{ color: "var(--ink)" }}>Configure Room Sharing & Bed Tracker</h3>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>Listing #{editingBedProp.id} • Customize room types, room counts, and per-bed rents.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingBedProp(null)}
                className="transition-colors border w-8 h-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--text-muted)" }}
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setUpdatingBeds(true);
                const inv = bedForm.room_inventory || {};

                // Calculate summary totals across enabled room types
                let calcTotal = 0;
                let calcAvail = 0;
                const roomTypes = ["single", "double", "triple", "four_plus"];
                const bedsMap = { single: 1, double: 2, triple: 3, four_plus: 4 };

                roomTypes.forEach((key) => {
                  if (inv[key]?.enabled) {
                    const rms = Number(inv[key].rooms) || 0;
                    const bpr = Number(inv[key].beds_per_room) || bedsMap[key];
                    const openBeds = Number(inv[key].available_beds) || 0;
                    calcTotal += rms * bpr;
                    calcAvail += openBeds;
                  }
                });

                // Fallback to manual form values if no room type enabled
                const finalTotal = calcTotal > 0 ? calcTotal : Number(bedForm.total_beds) || 0;
                const finalAvail = calcTotal > 0 ? calcAvail : Number(bedForm.available_beds) || 0;

                const ok = await handlePGOccupancy(editingBedProp.id, "update_inventory", {
                  room_inventory: inv,
                  total_beds: finalTotal,
                  available_beds: finalAvail,
                });

                setUpdatingBeds(false);
                if (ok) setEditingBedProp(null);
              }}
              className="space-y-5"
            >
              {/* Room Categories Configurator */}
              <div className="space-y-3">
                <label className="block text-xs font-black text-black uppercase tracking-wider">
                  Room Types Available in this Property
                </label>

                {[
                  { key: "single", label: "Single Private Room", defaultBeds: 1, icon: "bed" },
                  { key: "double", label: "Double Sharing", defaultBeds: 2, icon: "king_bed" },
                  { key: "triple", label: "Triple Sharing", defaultBeds: 3, icon: "hotel" },
                  { key: "four_plus", label: "4+ Bed Sharing", defaultBeds: 4, icon: "single_bed" },
                ].map((type) => {
                  const item = bedForm.room_inventory?.[type.key] || {
                    enabled: false,
                    rooms: 0,
                    beds_per_room: type.defaultBeds,
                    available_beds: 0,
                    rent: 0,
                  };

                  return (
                    <div
                      key={type.key}
                      className="p-4 rounded-2xl border transition-all"
                      style={{
                        backgroundColor: item.enabled ? "color-mix(in srgb, var(--accent) 5%, var(--surface))" : "var(--surface-alt)",
                        borderColor: item.enabled ? "var(--accent)" : "var(--border)",
                        opacity: item.enabled ? 1 : 0.75
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={item.enabled}
                            onChange={(e) => {
                              const updated = { ...item, enabled: e.target.checked };
                              if (e.target.checked && updated.rooms === 0) updated.rooms = 1;
                              if (e.target.checked && updated.available_beds === 0) updated.available_beds = updated.rooms * type.defaultBeds;
                              if (e.target.checked && updated.rent === 0) updated.rent = Number(editingBedProp?.price) || 5000;

                              setBedForm((prev) => ({
                                ...prev,
                                room_inventory: { ...prev.room_inventory, [type.key]: updated },
                              }));
                            }}
                            className="w-4 h-4 rounded text-black focus:ring-orange-500 border-gray-300"
                            style={{ accentColor: "var(--accent)" }}
                          />
                          <span className="material-symbols-outlined text-xl text-black">{type.icon}</span>
                          <span className="text-sm font-extrabold" style={{ color: "var(--ink)" }}>{type.label}</span>
                        </label>

                        {item.enabled && (
                          <span className="text-xs font-bold px-2 py-1 rounded-full text-black border border-orange-500/30" style={{ backgroundColor: "color-mix(in srgb, var(--accent) 10%, transparent)" }}>
                            {item.rooms * (item.beds_per_room || type.defaultBeds)} Beds Total
                          </span>
                        )}
                      </div>

                      {item.enabled && (
                        <div className="grid grid-cols-3 gap-4 pt-4 mt-4 border-t" style={{ borderColor: "var(--border)" }}>
                          <div>
                            <label className="block text-xs font-bold mb-1" style={{ color: "var(--text-muted)" }}>
                              Number of Rooms
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={item.rooms}
                              onChange={(e) => {
                                const rooms = Math.max(1, parseInt(e.target.value) || 1);
                                const tot = rooms * (item.beds_per_room || type.defaultBeds);
                                setBedForm((prev) => ({
                                  ...prev,
                                  room_inventory: {
                                    ...prev.room_inventory,
                                    [type.key]: {
                                      ...item,
                                      rooms,
                                      available_beds: Math.min(item.available_beds, tot),
                                    },
                                  },
                                }));
                              }}
                              className="w-full px-4 py-2 border rounded-xl text-xs font-bold focus:border-orange-500 outline-none"
                              style={{ backgroundColor: "var(--surface-alt)", color: "var(--ink)", borderColor: "var(--border)" }}
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold mb-1" style={{ color: "var(--text-muted)" }}>
                              Available Free Beds
                            </label>
                            <input
                              type="number"
                              min="0"
                              max={item.rooms * (item.beds_per_room || type.defaultBeds)}
                              value={item.available_beds}
                              onChange={(e) => {
                                const avail = Math.max(0, parseInt(e.target.value) || 0);
                                setBedForm((prev) => ({
                                  ...prev,
                                  room_inventory: {
                                    ...prev.room_inventory,
                                    [type.key]: { ...item, available_beds: avail },
                                  },
                                }));
                              }}
                              className="w-full px-4 py-2 border rounded-xl text-xs font-bold focus:border-orange-500 outline-none"
                              style={{ backgroundColor: "var(--surface-alt)", color: "var(--ink)", borderColor: "var(--border)" }}
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold mb-1" style={{ color: "var(--text-muted)" }}>
                              Rent per Bed (₹)
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={item.rent}
                              onChange={(e) => {
                                const rent = Math.max(0, parseInt(e.target.value) || 0);
                                setBedForm((prev) => ({
                                  ...prev,
                                  room_inventory: {
                                    ...prev.room_inventory,
                                    [type.key]: { ...item, rent },
                                  },
                                }));
                              }}
                              className="w-full px-4 py-2 border rounded-xl text-xs font-bold focus:border-orange-500 outline-none"
                              style={{ backgroundColor: "var(--surface-alt)", color: "var(--ink)", borderColor: "var(--border)" }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Total Calculation Summary Banner */}
              {(() => {
                const inv = bedForm.room_inventory || {};
                let totBeds = 0;
                let openBeds = 0;
                Object.keys(inv).forEach((k) => {
                  if (inv[k]?.enabled) {
                    totBeds += (Number(inv[k].rooms) || 0) * (Number(inv[k].beds_per_room) || 1);
                    openBeds += Number(inv[k].available_beds) || 0;
                  }
                });

                const occupied = Math.max(0, totBeds - openBeds);

                return (
                  <div className="p-4 rounded-2xl border flex items-center justify-between text-xs font-extrabold flex-wrap gap-2 shadow-md" style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)" }}>
                    <span className="flex items-center gap-2 text-slate-800">
                      <span className="material-symbols-outlined text-xl">equalizer</span>
                      <span>Inventory Calculation:</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 rounded-lg border" style={{ backgroundColor: "var(--surface)", color: "var(--ink)", borderColor: "var(--border)" }}>
                        {totBeds} Total Beds
                      </span>
                      <span className="px-2 py-1 rounded-lg border" style={{ backgroundColor: "var(--surface)", color: "var(--ink)", borderColor: "var(--border)" }}>
                        {occupied} Occupied
                      </span>
                      <span className="px-2 py-1 rounded-lg border text-slate-800" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
                        {openBeds} Free
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div className="flex justify-end gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingBedProp(null)}
                  className="px-4 py-2 rounded-xl border text-xs font-extrabold transition-all cursor-pointer"
                  style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--text-muted)" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingBeds}
                  className="px-4 py-2 rounded-xl text-white text-xs font-black transition-all shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-2"
                  style={{ backgroundColor: "#000000" }}
                >
                  {updatingBeds ? (
                    <>Saving Configuration...</>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-base">save</span>
                      Save Room Inventory
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      , document.body)}

      {showUpiModal && upiOrderData && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative flex flex-col p-6 animate-in zoom-in-95">
            <button
              onClick={() => setShowUpiModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-full w-8 h-8 flex items-center justify-center transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
            <div className="text-center mb-6 mt-4">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-800 flex items-center justify-center mx-auto mb-3 border border-slate-300">
                <span className="material-symbols-outlined text-3xl">qr_code_scanner</span>
              </div>
              <h3 className="text-xl font-extrabold text-slate-900">Scan & Pay via UPI</h3>
              <p className="text-sm font-medium text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                Please scan the QR code below using any UPI app (GPay, PhonePe, Paytm) to pay <strong className="text-slate-800">₹{upiOrderData.amount}</strong>.
              </p>
            </div>

            <div className="flex justify-center mb-6">
              <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-sm inline-block">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                    `upi://pay?pa=${upiOrderData.upi_merchant_id || 'merchant@upi'}&pn=Rentlo&am=${upiOrderData.amount}&cu=INR`
                  )}`}
                  alt="UPI QR Code"
                  className="w-48 h-48 rounded-lg"
                />
              </div>
            </div>

            <form onSubmit={handleUpiSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-extrabold text-slate-600 uppercase block mb-1 text-left">Enter 12-Digit UTR Number *</label>
                <input
                  type="text"
                  value={utrNumber}
                  onChange={(e) => setUtrNumber(e.target.value.replace(/[^0-9a-zA-Z]/g, ''))}
                  placeholder="e.g. 325412345678"
                  maxLength={20}
                  required
                  className="w-full h-12 px-4 text-center tracking-widest text-lg font-bold rounded-xl border border-slate-200 outline-none focus:border-indigo-600 transition-all"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={isVerifyingUtr}
                className="w-full h-14 rounded-xl text-white font-extrabold text-sm shadow-lg shadow-black/10 transition-all flex items-center justify-center gap-2 hover:opacity-90 cursor-pointer bg-black"
              >
                {isVerifyingUtr ? "Verifying..." : "Submit UTR & Activate"}
                <span className="material-symbols-outlined text-lg">check_circle</span>
              </button>
            </form>
          </div>
        </div>
      , document.body)}
      {/* Relist Confirmation Modal */}
      {relistTarget && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative flex flex-col p-6 animate-in zoom-in-95 duration-200 border border-slate-200">
            <button
              onClick={() => setRelistTarget(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-full w-8 h-8 flex items-center justify-center transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
            
            <div className="text-center mb-6 mt-4">
              <div className="w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-4 border border-slate-200">
                <span className="material-symbols-outlined text-3xl text-slate-800">restart_alt</span>
              </div>
              <h3 className="text-lg font-black text-slate-900">Relist Listing?</h3>
              <p className="text-sm font-medium text-slate-500 mt-2 max-w-xs mx-auto leading-relaxed">
                Relisting this property will consume <strong className="text-slate-800 font-bold">1 listing credit</strong> from your active pass balance.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRelistTarget(null)}
                className="flex-1 h-12 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold rounded-xl border border-slate-200 transition-all cursor-pointer text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  handleStatusUpdate(relistTarget.id, "live");
                  setRelistTarget(null);
                }}
                className="flex-1 h-12 bg-black text-white font-extrabold rounded-xl transition-all cursor-pointer text-xs shadow-md shadow-black/10 hover:opacity-90"
              >
                Confirm &amp; Relist
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Change Confirmation Modal */}
      {statusTarget && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative flex flex-col p-6 animate-in zoom-in-95 duration-200 border border-slate-200">
            <button
              onClick={() => setStatusTarget(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-full w-8 h-8 flex items-center justify-center transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
            
            <div className="text-center mb-6 mt-4">
              <div className="w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-4 border border-slate-200">
                <span className="material-symbols-outlined text-3xl text-slate-800">
                  {statusTarget.status === 'rented' ? 'key' : 'handshake'}
                </span>
              </div>
              <h3 className="text-lg font-black text-slate-900">
                {statusTarget.status === 'rented' ? 'Mark as Rented?' : 'Pause Listing Unlocks?'}
              </h3>
              <p className="text-sm font-medium text-slate-500 mt-2 max-w-xs mx-auto leading-relaxed">
                {statusTarget.status === 'rented' 
                  ? 'This will mark the property as Rented and take the listing offline. You can relist it later using pass credits.' 
                  : 'This puts the property under negotiation and pauses tenant contact unlocks for 48 hours.'}
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStatusTarget(null)}
                className="flex-1 h-12 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold rounded-xl border border-slate-200 transition-all cursor-pointer text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  handleStatusUpdate(statusTarget.id, statusTarget.status);
                  setStatusTarget(null);
                }}
                className="flex-1 h-12 bg-black text-white font-extrabold rounded-xl transition-all cursor-pointer text-xs shadow-md shadow-black/10 hover:opacity-90"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {successPassId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className="bg-surface rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-fade-in border border-border">
            <div className="p-8 flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-black/20 text-indigo-600 flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-[40px]">check_circle</span>
              </div>
              <h3 className="text-2xl font-black text-ink tracking-tight mb-2">Payment Successful!</h3>
              <p className="text-sm text-text-muted mb-8">
                Your listing pass has been activated successfully. You can now download your receipt or continue to your dashboard.
              </p>
              
              <div className="w-full space-y-3">
                <button
                  onClick={() => {
                    window.open(`${import.meta.env.VITE_API_URL}/owner-passes/${successPassId}/receipt/`, "_blank");
                  }}
                  className="w-full h-12 bg-black hover:bg-black text-white font-extrabold rounded-xl shadow-lg shadow-black/10 transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined">download</span>
                  Download Receipt
                </button>
                <button
                  onClick={() => setSuccessPassId(null)}
                  className="w-full h-12 bg-surface-alt hover:bg-slate-100 dark:hover:bg-slate-800 text-ink font-bold rounded-xl transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Property Modal */}
      {editingProp && createPortal(
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 overflow-y-auto" style={{ backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}>
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-xl w-full shadow-2xl space-y-5 my-8 max-h-[90vh] overflow-y-auto scrollbar-thin border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b pb-4 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-600 text-2xl">edit_square</span>
                <div>
                  <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">Edit Listing Details</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Property ID #{editingProp.id} • Updates to Rent or Photos require Admin Approval.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingProp(null)}
                className="transition-colors border w-8 h-8 rounded-full flex items-center justify-center bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-slate-700 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="bg-slate-100 dark:bg-slate-800/60 p-1.5 rounded-2xl flex gap-1 overflow-x-auto scrollbar-none">
              {[
                { id: "pricing", label: "Pricing & Info", icon: "payments" },
                { id: "specs", label: "Specs", icon: "home_work" },
                { id: "amenities", label: "Amenities & Rules", icon: "tune" },
                { id: "photos", label: "Photos", icon: "image" }
              ].map((tab) => {
                const isActive = activeEditTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveEditTab(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                      isActive 
                        ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/50 dark:border-slate-800/50" 
                        : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 border border-transparent"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <form onSubmit={handleSaveEdits} className="space-y-4">
              {/* TAB 1: PRICING & GENERAL */}
              {activeEditTab === "pricing" && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Monthly Rent (₹)</label>
                      <input
                        type="number"
                        value={editForm.price}
                        onChange={(e) => setEditForm(prev => ({ ...prev, price: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        required
                      />
                      <p className="text-[10px] text-amber-600 font-semibold">⚠️ Rent updates trigger admin review.</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Security Deposit (₹)</label>
                      <input
                        type="number"
                        value={editForm.security_deposit}
                        onChange={(e) => setEditForm(prev => ({ ...prev, security_deposit: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Maintenance Charges (₹/mo)</label>
                      <input
                        type="number"
                        value={editForm.maintenance_charges}
                        onChange={(e) => setEditForm(prev => ({ ...prev, maintenance_charges: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>
                    <div className="flex items-center gap-3 pt-6">
                      <input
                        type="checkbox"
                        id="maintenance_included"
                        checked={editForm.maintenance_included_in_rent}
                        onChange={(e) => setEditForm(prev => ({ ...prev, maintenance_included_in_rent: e.target.checked }))}
                        className="w-5 h-5 accent-indigo-600 cursor-pointer"
                      />
                      <label htmlFor="maintenance_included" className="text-xs font-bold text-slate-600 dark:text-slate-400 cursor-pointer">Maintenance Included in Rent</label>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Available From</label>
                      <input
                        type="date"
                        value={editForm.available_from}
                        onChange={(e) => setEditForm(prev => ({ ...prev, available_from: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Lock-in Period (Months)</label>
                      <input
                        type="number"
                        value={editForm.lock_in_period_months}
                        onChange={(e) => setEditForm(prev => ({ ...prev, lock_in_period_months: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        placeholder="e.g. 6"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Lease Term (Months)</label>
                      <input
                        type="number"
                        value={editForm.lease_term_months}
                        onChange={(e) => setEditForm(prev => ({ ...prev, lease_term_months: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        placeholder="e.g. 11"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Description</label>
                    <textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                      rows={4}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      placeholder="Give a detailed description of the property layout, location benefits, nearby landmarks, etc."
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: SPACE & SPECIFICATIONS */}
              {activeEditTab === "specs" && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Bedrooms</label>
                      <select
                        value={editForm.bedrooms}
                        onChange={(e) => setEditForm(prev => ({ ...prev, bedrooms: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      >
                        <option value="">N/A</option>
                        {[1, 2, 3, 4, 5].map(n => (
                          <option key={n} value={n}>{n} BHK</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Bathrooms</label>
                      <select
                        value={editForm.bathrooms}
                        onChange={(e) => setEditForm(prev => ({ ...prev, bathrooms: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      >
                        <option value="">N/A</option>
                        {[1, 2, 3, 4, 5].map(n => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Balconies</label>
                      <select
                        value={editForm.balconies}
                        onChange={(e) => setEditForm(prev => ({ ...prev, balconies: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      >
                        <option value="">N/A</option>
                        {[0, 1, 2, 3, 4].map(n => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Carpet Area (sqft)</label>
                      <input
                        type="number"
                        value={editForm.carpet_area}
                        onChange={(e) => setEditForm(prev => ({ ...prev, carpet_area: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Super Built-up Area (sqft)</label>
                      <input
                        type="number"
                        value={editForm.super_built_up_area}
                        onChange={(e) => setEditForm(prev => ({ ...prev, super_built_up_area: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Floor Number</label>
                      <select
                        value={editForm.floor_number}
                        onChange={(e) => setEditForm(prev => ({ ...prev, floor_number: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      >
                        <option value="">Select Floor</option>
                        <option value="0">Ground Floor</option>
                        {Array.from({ length: 50 }, (_, i) => i + 1).map(n => (
                          <option key={n} value={n}>{n} Floor</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Total Floors in Building</label>
                      <select
                        value={editForm.total_floors}
                        onChange={(e) => setEditForm(prev => ({ ...prev, total_floors: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      >
                        <option value="">Select Total Floors</option>
                        {Array.from({ length: 50 }, (_, i) => i + 1).map(n => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Facing Direction</label>
                      <select
                        value={editForm.facing_direction}
                        onChange={(e) => setEditForm(prev => ({ ...prev, facing_direction: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      >
                        <option value="">Select Direction</option>
                        {["North", "South", "East", "West", "North East", "North West", "South East", "South West"].map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Property Age</label>
                      <select
                        value={editForm.property_age}
                        onChange={(e) => setEditForm(prev => ({ ...prev, property_age: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      >
                        <option value="">Select Age</option>
                        <option value="Under Construction">Under Construction</option>
                        <option value="New (0-1 Years)">New (0-1 Years)</option>
                        <option value="1-5 Years">1-5 Years</option>
                        <option value="5-10 Years">5-10 Years</option>
                        <option value="10+ Years">10+ Years</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: AMENITIES & RULES */}
              {activeEditTab === "amenities" && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Furnishing Status</label>
                      <select
                        value={editForm.furnishing_status}
                        onChange={(e) => setEditForm(prev => ({ ...prev, furnishing_status: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      >
                        <option value="unfurnished">Unfurnished</option>
                        <option value="semi_furnished">Semi-Furnished</option>
                        <option value="fully_furnished">Fully Furnished</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Preferred Tenants</label>
                      <select
                        value={editForm.preferred_tenants}
                        onChange={(e) => setEditForm(prev => ({ ...prev, preferred_tenants: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      >
                        <option value="anyone">Anyone</option>
                        <option value="family">Family Only</option>
                        <option value="bachelors">Bachelors Only</option>
                        <option value="girls_only">Girls Only</option>
                        <option value="boys_only">Boys Only</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Food Preference</label>
                      <select
                        value={editForm.food_preference}
                        onChange={(e) => setEditForm(prev => ({ ...prev, food_preference: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      >
                        <option value="no_preference">No Preference</option>
                        <option value="veg_only">Veg Only</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Pet Policy</label>
                      <select
                        value={editForm.pet_policy}
                        onChange={(e) => setEditForm(prev => ({ ...prev, pet_policy: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      >
                        <option value="allowed">Allowed</option>
                        <option value="not_allowed">Not Allowed</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Power Backup</label>
                      <select
                        value={editForm.power_backup}
                        onChange={(e) => setEditForm(prev => ({ ...prev, power_backup: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      >
                        <option value="None">None</option>
                        <option value="Partial">Partial</option>
                        <option value="Full">Full</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Water Supply</label>
                      <select
                        value={editForm.water_supply}
                        onChange={(e) => setEditForm(prev => ({ ...prev, water_supply: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      >
                        <option value="Corporation">Corporation</option>
                        <option value="Borewell">Borewell</option>
                        <option value="Both">Both</option>
                      </select>
                    </div>
                    {editingProp?.property_category === "pg" && (
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">PG Gender</label>
                        <select
                          value={editForm.pg_gender}
                          onChange={(e) => setEditForm(prev => ({ ...prev, pg_gender: e.target.value }))}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        >
                          <option value="boys">Boys Only</option>
                          <option value="girls">Girls Only</option>
                          <option value="coed">Co-Ed</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Covered Parking Spots</label>
                      <input
                        type="number"
                        value={editForm.covered_parking_spots}
                        onChange={(e) => setEditForm(prev => ({ ...prev, covered_parking_spots: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Open Parking Spots</label>
                      <input
                        type="number"
                        value={editForm.open_parking_spots}
                        onChange={(e) => setEditForm(prev => ({ ...prev, open_parking_spots: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="flex gap-6 py-2 border-b dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="gated_security"
                        checked={editForm.gated_security}
                        onChange={(e) => setEditForm(prev => ({ ...prev, gated_security: e.target.checked }))}
                        className="w-5 h-5 accent-indigo-600 cursor-pointer"
                      />
                      <label htmlFor="gated_security" className="text-xs font-bold text-slate-600 dark:text-slate-400 cursor-pointer">Gated Security (24/7 Guards)</label>
                    </div>
                  </div>

                  {/* Amenities List */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Property Amenities</label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        "Gym", "Swimming Pool", "Clubhouse", "Power Backup", "Security", 
                        "Lifts", "Gas Pipeline", "WiFi", "Air Conditioning"
                      ].map((amenity) => {
                        const isSelected = (editForm.amenities || []).includes(amenity);
                        return (
                          <button
                            key={amenity}
                            type="button"
                            onClick={() => {
                              setEditForm(prev => ({
                                ...prev,
                                amenities: isSelected
                                  ? (prev.amenities || []).filter(a => a !== amenity)
                                  : [...(prev.amenities || []), amenity]
                              }));
                            }}
                            className="px-3.5 py-1.5 rounded-full text-[10px] font-extrabold tracking-wide uppercase transition-all shadow-sm border cursor-pointer"
                            style={{
                              backgroundColor: isSelected ? "var(--ink, #000000)" : "transparent",
                              color: isSelected ? "#ffffff" : "var(--text-muted)",
                              borderColor: isSelected ? "var(--ink, #000000)" : "rgba(0,0,0,0.12)"
                            }}
                          >
                            {amenity}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: PHOTOS & MEDIA */}
              {activeEditTab === "photos" && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Listing Photos</label>
                    <span className="text-[10px] text-amber-600 font-semibold">⚠️ Photo edits trigger admin review.</span>
                  </div>
                  
                  {/* Existing Photos Grid */}
                  <div className="grid grid-cols-4 gap-3">
                    {editForm.media.map((m) => (
                      <div key={m.id} className="relative h-20 rounded-xl overflow-hidden group border border-slate-200 dark:border-slate-800 bg-slate-50">
                        <img src={m.thumbnail_url || m.image_url} alt="Photo" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleMediaDelete(m.id)}
                          className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white rounded-full w-5 h-5 flex items-center justify-center shadow-md transition-colors"
                          title="Delete photo"
                        >
                          <span className="material-symbols-outlined text-[12px] font-bold">close</span>
                        </button>
                      </div>
                    ))}

                    {/* New Uploads Grid */}
                    {newUploadedMedia.map((m, idx) => (
                      <div key={`new-${idx}`} className="relative h-20 rounded-xl overflow-hidden border border-emerald-300 bg-emerald-50/50">
                        <img src={m.thumbnail_url || m.image_url} alt="New Photo" className="w-full h-full object-cover opacity-80" />
                        <button
                          type="button"
                          onClick={() => handleNewMediaDelete(idx)}
                          className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white rounded-full w-5 h-5 flex items-center justify-center shadow-md transition-colors"
                          title="Remove photo"
                        >
                          <span className="material-symbols-outlined text-[12px] font-bold">close</span>
                        </button>
                        <span className="absolute bottom-1 left-1 bg-emerald-600 text-white text-[8px] font-bold px-1 py-0.5 rounded">NEW</span>
                      </div>
                    ))}

                    {/* Upload Trigger Box */}
                    <label className="border-2 border-dashed border-slate-350 dark:border-slate-700 hover:border-indigo-500 hover:bg-indigo-50/10 rounded-xl h-20 flex flex-col items-center justify-center cursor-pointer transition-all">
                      {uploadingMedia ? (
                        <span className="material-symbols-outlined text-indigo-500 animate-spin text-xl">sync</span>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-slate-450 dark:text-slate-500 text-xl">add_a_photo</span>
                          <span className="text-[9px] text-slate-400 font-bold mt-1">Upload</span>
                        </>
                      )}
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleMediaUpload}
                        disabled={uploadingMedia}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingProp(null)}
                  className="flex-1 h-12 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-bold rounded-xl border border-slate-200 dark:border-slate-700 transition-all cursor-pointer text-xs"
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 h-12 bg-black text-white dark:bg-white dark:text-black font-extrabold rounded-xl transition-all cursor-pointer text-xs shadow-md flex items-center justify-center gap-2 hover:opacity-90"
                  disabled={isSaving || uploadingMedia}
                >
                  {isSaving ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-base">sync</span>
                      Saving Edits...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-base">save</span>
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      , document.body)}
    </div>
  );
};
