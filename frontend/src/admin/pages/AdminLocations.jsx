import React, { useState, useEffect } from "react";
import { AdminLayout } from "../components/AdminLayout";
import { toast } from "react-toastify";

export const AdminLocations = () => {
  const [cities, setCities] = useState([]);
  const [selectedCity, setSelectedCity] = useState(null);
  const [localities, setLocalities] = useState([]);
  
  const [newCityName, setNewCityName] = useState("");
  const [newCityState, setNewCityState] = useState("");
  const [newLocalityName, setNewLocalityName] = useState("");
  
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);
  const [selectedSuggestions, setSelectedSuggestions] = useState({});
  const [addingSuggestions, setAddingSuggestions] = useState(false);

  const fetchCities = async () => {
    try {
      const r = await fetch(`${import.meta.env.VITE_API_URL}/properties/cities/`);
      if (r.ok) setCities(await r.json());
    } catch {}
  };

  const fetchLocalities = async (cityId) => {
    try {
      const r = await fetch(`${import.meta.env.VITE_API_URL}/properties/cities/${cityId}/localities/`);
      if (r.ok) setLocalities(await r.json());
    } catch {}
  };

  useEffect(() => {
    fetchCities();
  }, []);

  const handleAddCity = async (e) => {
    e.preventDefault();
    if (!newCityName || !newCityState) return;
    try {
      const r = await fetch(`${import.meta.env.VITE_API_URL}/properties/cities/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCityName, state: newCityState, is_active: true }),
        credentials: "include"
      });
      if (r.ok) {
        toast.success("City added!");
        setNewCityName("");
        setNewCityState("");
        fetchCities();
      } else {
        toast.error("Failed to add city.");
      }
    } catch (err) {
      toast.error("Error adding city.");
    }
  };

  const handleDeleteCity = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure? This deletes all localities and properties in this city!")) return;
    try {
      const r = await fetch(`${import.meta.env.VITE_API_URL}/properties/cities/${id}/`, {
        method: "DELETE",
        credentials: "include"
      });
      if (r.ok) {
        toast.success("City deleted");
        if (selectedCity?.id === id) setSelectedCity(null);
        fetchCities();
      }
    } catch {}
  };

  const handleAddLocality = async (e) => {
    e.preventDefault();
    if (!newLocalityName || !selectedCity) return;
    try {
      const r = await fetch(`${import.meta.env.VITE_API_URL}/properties/cities/${selectedCity.id}/localities/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newLocalityName, city: selectedCity.id }),
        credentials: "include"
      });
      if (r.ok) {
        toast.success("Locality added!");
        setNewLocalityName("");
        fetchLocalities(selectedCity.id);
      }
    } catch {}
  };

  const handleDeleteLocality = async (id) => {
    if (!window.confirm("Delete this locality?")) return;
    try {
      const r = await fetch(`${import.meta.env.VITE_API_URL}/properties/localities/${id}/`, {
        method: "DELETE",
        credentials: "include"
      });
      if (r.ok) {
        toast.success("Locality deleted");
        fetchLocalities(selectedCity.id);
      }
    } catch {}
  };

  const fetchSuggestions = async () => {
    if (!selectedCity) return;
    setSuggesting(true);
    setSuggestions([]);
    setSelectedSuggestions({});
    setShowSuggestionModal(true);
    try {
      const r = await fetch(`${import.meta.env.VITE_API_URL}/properties/suggest-localities/?city=${encodeURIComponent(selectedCity.name)}`, {
        credentials: "include"
      });
      const data = await r.json();
      if (r.ok) {
        setSuggestions(data.localities || []);
        // pre-select all that don't already exist
        const existingNames = localities.map(l => l.name.toLowerCase());
        const toSelect = {};
        (data.localities || []).forEach(name => {
          if (!existingNames.includes(name.toLowerCase())) {
            toSelect[name] = true;
          }
        });
        setSelectedSuggestions(toSelect);
      } else {
        toast.error(data.error || "Failed to fetch suggestions");
        setShowSuggestionModal(false);
      }
    } catch (err) {
      toast.error("Error communicating with AI service");
      setShowSuggestionModal(false);
    } finally {
      setSuggesting(false);
    }
  };

  const addSelectedSuggestions = async () => {
    const toAdd = Object.keys(selectedSuggestions).filter(k => selectedSuggestions[k]);
    if (!toAdd.length) {
      setShowSuggestionModal(false);
      return;
    }
    setAddingSuggestions(true);
    try {
      for (const name of toAdd) {
        await fetch(`${import.meta.env.VITE_API_URL}/properties/cities/${selectedCity.id}/localities/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, city: selectedCity.id }),
          credentials: "include"
        });
      }
      toast.success(`Added ${toAdd.length} localities successfully!`);
      fetchLocalities(selectedCity.id);
      setShowSuggestionModal(false);
    } catch {
      toast.error("Error adding some localities");
    } finally {
      setAddingSuggestions(false);
    }
  };

  return (
    <AdminLayout activeTab="locations">
      <div className="p-6 md:p-8 max-w-7xl mx-auto flex flex-col md:flex-row gap-8">
        
        {/* Left Panel: Cities */}
        <div className="w-full md:w-1/3 flex flex-col gap-6">
          <div className="rounded-3xl p-6 shadow-sm border flex flex-col h-[calc(100vh-120px)]" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2" style={{ color: "var(--ink)" }}>
              <span className="material-symbols-outlined text-[var(--accent)]">location_city</span>
              Cities
            </h2>
            
            <form onSubmit={handleAddCity} className="mb-6 flex flex-col gap-3">
              <input 
                type="text" 
                placeholder="City Name"
                className="w-full px-4 py-2.5 rounded-xl border outline-none text-[14px] font-bold"
                style={{ backgroundColor: "var(--surface-alt)", color: "var(--ink)", borderColor: "var(--border)" }}
                value={newCityName}
                onChange={e => setNewCityName(e.target.value)}
              />
              <input 
                type="text" 
                placeholder="State (e.g. Karnataka)"
                className="w-full px-4 py-2.5 rounded-xl border outline-none text-[14px] font-bold"
                style={{ backgroundColor: "var(--surface-alt)", color: "var(--ink)", borderColor: "var(--border)" }}
                value={newCityState}
                onChange={e => setNewCityState(e.target.value)}
              />
              <button 
                type="submit"
                disabled={!newCityName || !newCityState}
                className="bg-slate-950 hover:bg-slate-900 border border-slate-800/80 text-white rounded-xl py-2.5 font-extrabold text-[14px] disabled:opacity-50 transition-all shadow-md cursor-pointer"
              >
                Add City
              </button>
            </form>

            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
              {cities.map(c => (
                <div 
                  key={c.id}
                  onClick={() => {
                    setSelectedCity(c);
                    fetchLocalities(c.id);
                  }}
                  className="px-4 py-3 rounded-2xl cursor-pointer flex items-center justify-between border transition-all"
                  style={{
                    backgroundColor: selectedCity?.id === c.id ? "var(--surface-alt)" : "var(--surface)",
                    borderColor: selectedCity?.id === c.id ? "var(--accent)" : "var(--border)",
                    borderWidth: selectedCity?.id === c.id ? "2px" : "1px"
                  }}
                >
                  <div>
                    <div className="font-bold text-[14px]" style={{ color: "var(--ink)" }}>{c.name}</div>
                    <div className="text-[12px]" style={{ color: "var(--text-muted)" }}>{c.state}</div>
                  </div>
                  <button 
                    onClick={(e) => handleDeleteCity(e, c.id)}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
              ))}
              {cities.length === 0 && <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>No cities yet.</p>}
            </div>
          </div>
        </div>

        {/* Right Panel: Localities */}
        <div className="w-full md:w-2/3 flex flex-col gap-6">
          <div className="rounded-3xl p-6 shadow-sm border flex flex-col h-[calc(100vh-120px)] relative" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
            {!selectedCity ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <span className="material-symbols-outlined text-slate-300 text-[80px] mb-4">map</span>
                <h3 className="text-xl font-bold" style={{ color: "var(--ink)" }}>Select a City</h3>
                <p className="mt-2 max-w-sm" style={{ color: "var(--text-muted)" }}>Choose a city from the list to view and manage its localities.</p>
              </div>
            ) : (
              <>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b pb-4" style={{ borderColor: "var(--border)" }}>
                  <div>
                    <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: "var(--ink)" }}>
                      <span className="material-symbols-outlined text-[var(--accent)]">pin_drop</span>
                      Localities in {selectedCity.name}
                    </h2>
                    <p className="text-[13px] mt-1" style={{ color: "var(--text-muted)" }}>{localities.length} registered</p>
                  </div>
                  <button 
                    onClick={fetchSuggestions}
                    className="flex items-center gap-2 bg-slate-950 hover:bg-slate-900 border border-slate-800/80 text-white px-5 py-2.5 rounded-xl font-extrabold text-[14px] hover:shadow-md transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
                    Smart Suggestion
                  </button>
                </div>

                <form onSubmit={handleAddLocality} className="mb-6 flex gap-3">
                  <input 
                    type="text" 
                    placeholder="Type new locality manually..."
                    className="flex-1 px-4 py-2.5 rounded-xl border outline-none text-[14px] font-bold"
                    style={{ backgroundColor: "var(--surface-alt)", color: "var(--ink)", borderColor: "var(--border)" }}
                    value={newLocalityName}
                    onChange={e => setNewLocalityName(e.target.value)}
                  />
                  <button 
                    type="submit"
                    disabled={!newLocalityName}
                    className="bg-slate-950 hover:bg-slate-900 border border-slate-800/80 text-white rounded-xl px-6 font-extrabold text-[14px] disabled:opacity-50 transition-all shadow-md cursor-pointer"
                  >
                    Add
                  </button>
                </form>

                <div className="flex-1 overflow-y-auto pr-2 grid grid-cols-1 md:grid-cols-2 gap-3 auto-rows-max">
                  {localities.map(l => (
                    <div key={l.id} className="border rounded-2xl px-4 py-3 flex items-center justify-between transition-colors" style={{ backgroundColor: "var(--surface-alt)", borderColor: "var(--border)" }}>
                      <span className="font-bold text-[14px]" style={{ color: "var(--ink)" }}>{l.name}</span>
                      <button 
                        onClick={() => handleDeleteLocality(l.id)}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[16px]">close</span>
                      </button>
                    </div>
                  ))}
                  {localities.length === 0 && (
                    <div className="col-span-full py-12 text-center">
                      <p className="text-[14px]" style={{ color: "var(--text-muted)" }}>No localities added yet.</p>
                      <button 
                        onClick={fetchSuggestions}
                        className="text-emerald-500 font-bold text-[14px] mt-2 hover:underline cursor-pointer"
                      >
                        Use Smart Suggestion
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Suggestion Modal */}
        {showSuggestionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-50 to-teal-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white shadow-sm flex items-center justify-center text-emerald-500">
                    <span className="material-symbols-outlined text-[24px]">auto_awesome</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-[16px]">AI Map Analysis</h3>
                    <p className="text-[12px] text-emerald-600 font-medium">{selectedCity?.name} Localities</p>
                  </div>
                </div>
                <button onClick={() => setShowSuggestionModal(false)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:bg-white rounded-full transition-colors">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-2 bg-slate-50/50">
                {suggesting ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-12 h-12 rounded-full border-4 border-emerald-100 border-t-emerald-500 animate-spin mb-4"></div>
                    <p className="font-bold text-slate-800">Scanning map data...</p>
                    <p className="text-[13px] text-slate-500 mt-1">Finding neighborhoods in {selectedCity?.name}</p>
                  </div>
                ) : suggestions.length === 0 ? (
                  <div className="py-16 text-center px-6">
                    <p className="font-bold text-slate-800">No suggestions found.</p>
                    <p className="text-[13px] text-slate-500 mt-2">The map API couldn't find specific suburbs for this city. You can add them manually.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1 p-4">
                    <div className="flex items-center justify-between px-2 mb-2">
                      <span className="text-[12px] font-bold text-slate-500 uppercase tracking-wider">Found {suggestions.length} places</span>
                      <button 
                        onClick={() => {
                          const all = {};
                          suggestions.forEach(s => all[s] = true);
                          setSelectedSuggestions(all);
                        }}
                        className="text-[12px] text-emerald-600 font-bold hover:underline"
                      >
                        Select All
                      </button>
                    </div>
                    {suggestions.map((name, i) => {
                      const exists = localities.some(l => l.name.toLowerCase() === name.toLowerCase());
                      return (
                        <label 
                          key={i} 
                          className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors border ${
                            exists ? "bg-slate-100 border-transparent opacity-60" 
                            : selectedSuggestions[name] ? "bg-white border-emerald-500 shadow-sm" : "bg-white border-slate-100 hover:border-slate-300"
                          }`}
                        >
                          <input 
                            type="checkbox" 
                            className="w-5 h-5 rounded-md text-emerald-500 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                            checked={!!selectedSuggestions[name] || exists}
                            disabled={exists}
                            onChange={(e) => {
                              setSelectedSuggestions(prev => ({...prev, [name]: e.target.checked}));
                            }}
                          />
                          <span className={`flex-1 font-medium text-[14px] ${exists ? "text-slate-500" : "text-slate-800"}`}>
                            {name}
                          </span>
                          {exists && <span className="text-[10px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded-full border border-slate-200">Added</span>}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {!suggesting && suggestions.length > 0 && (
                <div className="p-4 border-t border-slate-100 bg-white shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
                  <button 
                    onClick={addSelectedSuggestions}
                    disabled={addingSuggestions || !Object.values(selectedSuggestions).some(v => v)}
                    className="w-full py-3.5 bg-slate-900 text-white rounded-2xl font-bold text-[15px] flex items-center justify-center gap-2 hover:bg-slate-800 disabled:bg-slate-300 transition-colors"
                  >
                    {addingSuggestions ? "Adding..." : `Add ${Object.values(selectedSuggestions).filter(v => v).length} Selected`}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};
