import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";

export const OwnerChat = () => {
  const [threads, setThreads] = useState([]);
  const [activeThread, setActiveThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [me, setMe] = useState(null);
  const [showChat, setShowChat] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const bottomRef = useRef(null);
  const pollRef = useRef(null);
  const chatContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const isInitialLoadRef = useRef(true);

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
      console.error("Failed to fetch user in OwnerChat", err);
    }
  };

  const fetchThreads = async () => {
    try {
      const r = await fetch(`${import.meta.env.VITE_API_URL}/chat/threads/`, { credentials: "include" });
      if (r.ok) setThreads(await r.json());
    } catch (err) {
      console.error("Failed to fetch chat threads", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (thread) => {
    if (!thread) return;
    try {
      const r = await fetch(
        `${import.meta.env.VITE_API_URL}/chat/property/${thread.property_id}/`,
        { credentials: "include" }
      );
      if (r.ok) setMessages(await r.json());
    } catch (err) {
      console.error("Failed to fetch thread messages", err);
    }
  };

  useEffect(() => {
    fetchMe();
    fetchThreads();
  }, []);

  useEffect(() => {
    if (!activeThread) return;
    isInitialLoadRef.current = true;
    fetchMessages(activeThread);
    pollRef.current = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchMessages(activeThread);
      }
    }, 4000);
    return () => clearInterval(pollRef.current);
  }, [activeThread]);

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
    if (!messageContent || !activeThread || sending) return;
    setSending(true);
    try {
      const r = await fetch(
        `${import.meta.env.VITE_API_URL}/chat/property/${activeThread.property_id}/`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: messageContent,
            recipient_id: activeThread.other_user_id,
          }),
        }
      );
      if (r.ok) {
        setInput("");
        setImagePreview(null);
        isInitialLoadRef.current = true;
        fetchMessages(activeThread);
        fetchThreads();
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
    <div className="h-[calc(100vh-112px)] md:h-[calc(100vh-100px)] flex md:rounded-3xl overflow-hidden md:border md:shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
      {/* Thread List Sidebar */}
      <div className={`${showChat ? 'hidden' : 'flex'} md:flex w-full md:w-80 flex-shrink-0 border-r flex-col`} style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
        <div className="px-6 py-5 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-[18px] font-extrabold tracking-tight flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <span className="material-symbols-outlined text-[22px] text-emerald-500">chat</span>
            Messages
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex justify-center pt-16">
              <div className="w-8 h-8 rounded-full border-[3px] border-slate-300 border-t-slate-900 animate-spin"></div>
            </div>
          )}
          {!loading && threads.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-[32px] text-emerald-500">mark_unread_chat_alt</span>
              </div>
              <p className="text-[14px] font-extrabold" style={{ color: "var(--ink)" }}>No conversations yet</p>
              <p className="text-[12px] font-medium mt-1.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                When prospective buyers message you, their chats will appear here.
              </p>
            </div>
          )}
          {threads.map((t) => {
            const isActive = activeThread?.property_id === t.property_id && activeThread?.other_user_id === t.other_user_id;
            const isPhoto = t.last_message?.startsWith("data:image/");
            return (
              <button
                key={`${t.property_id}-${t.other_user_id}`}
                onClick={() => { setActiveThread(t); setShowChat(true); }}
                className="w-[92%] mx-auto my-2 text-left p-3.5 rounded-2xl transition-all flex items-center gap-3.5 cursor-pointer border hover:-translate-y-0.5 hover:shadow-xs active:scale-98"
                style={{
                  backgroundColor: isActive ? "var(--surface-alt)" : "var(--surface)",
                  borderColor: isActive ? "var(--accent-soft)" : "var(--border)",
                  boxShadow: isActive ? "0 4px 12px rgba(16, 185, 129, 0.08)" : "none"
                }}
              >
                <div className="relative shrink-0">
                  <div className="w-10 h-10 rounded-full font-black text-[13px] flex items-center justify-center text-emerald-800 bg-emerald-100 border border-emerald-200 shadow-xs">
                    {t.other_user_name?.charAt(0).toUpperCase()}
                  </div>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white"></span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-extrabold text-[13.5px] truncate" style={{ color: "var(--ink)" }}>{t.other_user_name}</span>
                    {t.unread_count > 0 && (
                      <span className="text-white text-[9.5px] font-black px-2 py-0.5 rounded-full bg-emerald-500 shrink-0">
                        {t.unread_count}
                      </span>
                    )}
                  </div>
                  <span className="text-[10.5px] font-extrabold truncate capitalize text-emerald-500 block mt-0.5">
                    {t.property_type ? t.property_type.replace('_', ' ') : 'Property'} &bull; {t.property_locality || 'Karnataka'}
                  </span>
                  <div className="text-[11px] font-semibold truncate block mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {isPhoto ? (
                      <span className="flex items-center gap-1 text-emerald-600 font-extrabold">
                        <span className="material-symbols-outlined text-[13px] font-black">image</span>
                        Photo
                      </span>
                    ) : (
                      t.last_message
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Chat Pane */}
      <div className={`${!showChat ? 'hidden' : 'flex'} md:flex flex-1 flex-col`}>
        {!activeThread ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8" style={{ backgroundColor: "var(--surface-alt)" }}>
            <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-emerald-500 text-[40px]">forum</span>
            </div>
            <h3 className="text-[22px] font-extrabold mb-2 tracking-tight" style={{ color: "var(--ink)" }}>Select a conversation</h3>
            <p className="text-[13.5px] font-medium max-w-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
              Click on a buyer thread on the left to view and reply to their messages.
            </p>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="px-4 py-3 border-b flex items-center justify-between sticky top-0 z-10 shadow-xs" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => setShowChat(false)}
                  className="md:hidden p-1.5 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
                >
                  <span className="material-symbols-outlined text-[24px]">arrow_back</span>
                </button>
                
                <div className="relative shrink-0">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-850 font-black flex items-center justify-center text-[15px] border border-emerald-200">
                    {activeThread.other_user_name?.charAt(0).toUpperCase()}
                  </div>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full"></span>
                </div>

                <div className="min-w-0">
                  <h3 className="font-extrabold text-[14.5px] leading-tight text-slate-800 flex items-center gap-1.5">
                    {activeThread.other_user_name}
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                  </h3>
                  <Link
                    to={`/property/${activeThread.property_id}`}
                    className="text-[10px] font-extrabold text-emerald-600 hover:text-emerald-700 flex items-center gap-0.5 mt-0.5"
                  >
                    <span className="material-symbols-outlined text-[12px] font-bold">gite</span>
                    <span className="truncate">{activeThread.property_type ? activeThread.property_type.replace('_', ' ') : 'Property'} • {activeThread.property_locality}</span>
                    <span className="material-symbols-outlined text-[11px] font-black">chevron_right</span>
                  </Link>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div
              ref={chatContainerRef}
              className="flex-1 overflow-y-auto px-6 py-5 space-y-4"
              style={{
                backgroundColor: "var(--surface-alt)",
                backgroundImage: "radial-gradient(#e2e8f0 1.2px, transparent 1.2px), radial-gradient(#e2e8f0 1.2px, var(--surface-alt) 1.2px)",
                backgroundSize: "24px 24px",
                backgroundPosition: "0 0, 12px 12px"
              }}
            >
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
                    placeholder={imagePreview ? "Photo attached (Click send)" : `Message ${activeThread.other_user_name}...`}
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
          </>
        )}
      </div>
    </div>
  );
};
