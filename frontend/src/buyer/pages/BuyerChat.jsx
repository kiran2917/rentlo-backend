import React, { useState, useEffect, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "react-toastify";

export const BuyerChat = () => {
  const { propertyId } = useParams();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [me, setMe] = useState(null);
  const bottomRef = useRef(null);
  const pollRef = useRef(null);
  const chatContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const isInitialLoadRef = useRef(true);
  const [imagePreview, setImagePreview] = useState(null);

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const compressedBase64 = canvas.toDataURL("image/jpeg", 0.75);
        setImagePreview(compressedBase64);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const fetchMe = async () => {
    try {
      const r = await fetch(`${import.meta.env.VITE_API_URL}/auth/me/`, { credentials: "include" });
      if (r.ok) setMe(await r.json());
    } catch (err) {
      console.error("Failed to fetch user in BuyerChat", err);
    }
  };

  const fetchMessages = async () => {
    try {
      const r = await fetch(`${import.meta.env.VITE_API_URL}/chat/property/${propertyId}/`, {
        credentials: "include",
      });
      if (r.ok) setMessages(await r.json());
    } catch (err) {
      console.error("Failed to fetch chat messages", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    isInitialLoadRef.current = true;
    fetchMe();
    fetchMessages();
    pollRef.current = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchMessages();
      }
    }, 4000);
    return () => clearInterval(pollRef.current);
  }, [propertyId]);

  useEffect(() => {
    if (!messages || messages.length === 0) return;
    const container = chatContainerRef.current;
    const isNearBottom = container
      ? container.scrollHeight - container.scrollTop - container.clientHeight < 150
      : true;

    if (isInitialLoadRef.current || isNearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: isInitialLoadRef.current ? "auto" : "smooth" });
      isInitialLoadRef.current = false;
    }
  }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    const messageContent = imagePreview || input.trim();
    if (!messageContent || sending) return;
    setSending(true);
    try {
      const r = await fetch(`${import.meta.env.VITE_API_URL}/chat/property/${propertyId}/`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageContent }),
      });
      if (r.ok) {
        setInput("");
        setImagePreview(null);
        isInitialLoadRef.current = true;
        fetchMessages();
      } else {
        toast.error("Failed to send message. Please try again.");
      }
    } catch (err) {
      toast.error("Network error sending message.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--bg)" }}>
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center gap-3 sticky top-0 z-10 shadow-xs" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
        <Link
          to={`/property/${propertyId}`}
          className="p-1.5 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
        >
          <span className="material-symbols-outlined text-[24px]">arrow_back</span>
        </Link>
        
        <div className="relative shrink-0">
          <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-850 font-black flex items-center justify-center text-[15px] border border-emerald-200">
            <span className="material-symbols-outlined text-emerald-600 text-[18px]">real_estate_agent</span>
          </div>
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full"></span>
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="font-extrabold text-[14.5px] leading-tight text-slate-800 flex items-center gap-1.5">
            Chat with Owner
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
          </h1>
          <p className="text-[10px] font-extrabold text-emerald-600 bg-emerald-50/50 border border-emerald-200/50 px-2.5 py-0.5 rounded-full w-fit flex items-center gap-1 mt-0.5 shadow-xs">
            <span className="material-symbols-outlined text-[12px] font-bold">gite</span>
            <span>Property #{propertyId} &bull; Direct Messenger</span>
          </p>
        </div>
      </div>

      {/* Messages Stream */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto px-4 py-6 space-y-4 w-full"
        style={{
          backgroundColor: "var(--surface-alt)",
          backgroundImage: "radial-gradient(#e2e8f0 1.2px, transparent 1.2px), radial-gradient(#e2e8f0 1.2px, var(--surface-alt) 1.2px)",
          backgroundSize: "24px 24px",
          backgroundPosition: "0 0, 12px 12px"
        }}
      >
        <div className="max-w-3xl mx-auto space-y-4">
          {loading && (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 rounded-full border-[3px] border-slate-300 border-t-slate-900 animate-spin"></div>
            </div>
          )}
          {!loading && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in-up">
              <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-emerald-500 text-[40px]">forum</span>
              </div>
              <h3 className="text-[22px] font-extrabold mb-2 tracking-tight" style={{ color: "var(--ink)" }}>
                Start the Conversation
              </h3>
              <p className="text-[14px] font-medium max-w-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                Send a message to the property owner. They will be notified immediately.
              </p>
            </div>
          )}
          {messages.map((msg) => {
            const isMe = me && msg.sender_id === me.id;
            return (
              <div key={msg.id} className={`flex w-full ${isMe ? "justify-end" : "justify-start"} animate-fade-in-up`}>
                <div className={`flex flex-col max-w-[78%] ${isMe ? "items-end" : "items-start"}`}>
                  <div
                    className={`relative px-3.5 py-2 rounded-2xl shadow-xs text-[13.5px] leading-relaxed ${
                      isMe
                        ? "bg-emerald-600 text-white rounded-tr-xs"
                        : "bg-white border border-slate-200 text-slate-800 rounded-tl-xs"
                    }`}
                    style={!isMe ? { borderColor: "var(--border)" } : {}}
                  >
                    {msg.message?.startsWith("data:image/") ? (
                      <img
                        src={msg.message}
                        alt="Attachment"
                        className="max-w-[200px] sm:max-w-[280px] rounded-lg object-contain cursor-pointer hover:opacity-95 transition-opacity"
                        onClick={() => window.open(msg.message, '_blank')}
                      />
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.message}</p>
                    )}

                    <div className={`flex items-center justify-end gap-0.5 mt-1 text-[8.5px] font-bold ${isMe ? "text-emerald-100/90" : "text-slate-400"}`}>
                      <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      {isMe && (
                        <span className="material-symbols-outlined text-[11px] font-black">done_all</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div ref={bottomRef}></div>
      </div>
      <div className="px-4 py-3 border-t relative z-10 bg-white" style={{ borderColor: "var(--border)" }}>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handlePhotoUpload}
          accept="image/*"
          className="hidden"
        />
        <form onSubmit={sendMessage} className="max-w-3xl mx-auto flex items-center gap-2.5">
          <div className="flex-1 flex items-center bg-slate-100 border border-slate-200/50 rounded-full px-3.5 py-1.5 focus-within:ring-4 focus-within:ring-emerald-500/10 focus-within:border-emerald-500 transition-all shadow-inner relative">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-1 hover:bg-slate-200 rounded-full transition-colors cursor-pointer mr-2 flex items-center justify-center shrink-0"
            >
              <span className="material-symbols-outlined text-slate-500 text-[20px]">add_a_photo</span>
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={!!imagePreview}
              placeholder={imagePreview ? "Photo attached (Click send)" : "Type your message..."}
              className="flex-1 bg-transparent border-none outline-none text-[13.5px] font-medium text-slate-800 placeholder-slate-400 py-0.5"
            />
            {imagePreview && (
              <div className="absolute bottom-14 left-4 bg-white border rounded-2xl p-1.5 shadow-lg flex items-center gap-2 animate-in fade-in zoom-in-95 duration-150 z-50">
                <img src={imagePreview} className="w-12 h-12 object-cover rounded-lg border" />
                <button
                  type="button"
                  onClick={() => setImagePreview(null)}
                  className="w-5 h-5 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center cursor-pointer border"
                >
                  <span className="material-symbols-outlined text-[12px] font-bold">close</span>
                </button>
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={sending || (!input.trim() && !imagePreview)}
            className="w-10 h-10 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-full flex items-center justify-center transition-all shadow-md shadow-emerald-600/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none shrink-0"
          >
            {sending ? (
              <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
            ) : (
              <span className="material-symbols-outlined text-[19px] ml-0.5">send</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
