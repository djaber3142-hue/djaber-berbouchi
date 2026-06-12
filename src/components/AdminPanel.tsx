import React, { useState, useRef } from "react";
import { Player, Language } from "../types";
import { 
  Plus, Edit, Trash2, Key, ToggleLeft, ToggleRight, 
  RotateCcw, Save, Trash, AlertTriangle, ShieldCheck, X, Upload, CheckCircle2 
} from "lucide-react";

interface AdminPanelProps {
  players: Player[];
  lang: Language;
  onClose: () => void;
  isVotingPaused: boolean;
  onRefreshTournamentState: () => void;
  t: any;
  adminPasscode: string;
  tournamentNameAr?: string;
  tournamentNameEn?: string;
  tournamentLogoUrl?: string;
  strictIpCheck?: boolean;
  dev1NameAr?: string;
  dev1NameEn?: string;
  dev1ImageUrl?: string;
  dev2NameAr?: string;
  dev2NameEn?: string;
  dev2ImageUrl?: string;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  players,
  lang,
  onClose,
  isVotingPaused,
  onRefreshTournamentState,
  t,
  adminPasscode,
  tournamentNameAr = "",
  tournamentNameEn = "",
  tournamentLogoUrl = "",
  strictIpCheck = false,
  dev1NameAr = "",
  dev1NameEn = "",
  dev1ImageUrl = "",
  dev2NameAr = "",
  dev2NameEn = "",
  dev2ImageUrl = "",
}) => {
  const isRtl = lang === "ar";
  
  // State managers
  const [activeTab, setActiveTab] = useState<"players" | "settings">("players");
  const [playersList, setPlayersList] = useState<Player[]>(players);
  
  // New player fields
  const [newPlayerAr, setNewPlayerAr] = useState("");
  const [newPlayerEn, setNewPlayerEn] = useState("");
  const [newPlayerImg, setNewPlayerImg] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // Edit player fields
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editPlayerAr, setEditPlayerAr] = useState("");
  const [editPlayerEn, setEditPlayerEn] = useState("");
  const [editPlayerImg, setEditPlayerImg] = useState("");

  // System Settings
  const [localVotingPaused, setLocalVotingPaused] = useState(isVotingPaused);
  const [localStrictIp, setLocalStrictIp] = useState(strictIpCheck);
  const [newPasscode, setNewPasscode] = useState("");
  
  // Tournament Branding Settings
  const [localTournamentNameAr, setLocalTournamentNameAr] = useState(tournamentNameAr);
  const [localTournamentNameEn, setLocalTournamentNameEn] = useState(tournamentNameEn);
  const [localTournamentLogoUrl, setLocalTournamentLogoUrl] = useState(tournamentLogoUrl);

  // Developers Settings
  const [localDev1NameAr, setLocalDev1NameAr] = useState(dev1NameAr);
  const [localDev1NameEn, setLocalDev1NameEn] = useState(dev1NameEn);
  const [localDev1ImageUrl, setLocalDev1ImageUrl] = useState(dev1ImageUrl);
  const [localDev2NameAr, setLocalDev2NameAr] = useState(dev2NameAr);
  const [localDev2NameEn, setLocalDev2NameEn] = useState(dev2NameEn);
  const [localDev2ImageUrl, setLocalDev2ImageUrl] = useState(dev2ImageUrl);

  // Sync state with props when parent state changes/loads asynchronously
  React.useEffect(() => {
    setLocalTournamentNameAr(tournamentNameAr);
    setLocalTournamentNameEn(tournamentNameEn);
    setLocalTournamentLogoUrl(tournamentLogoUrl);
    setLocalStrictIp(strictIpCheck);
    setLocalVotingPaused(isVotingPaused);
    setLocalDev1NameAr(dev1NameAr);
    setLocalDev1NameEn(dev1NameEn);
    setLocalDev1ImageUrl(dev1ImageUrl);
    setLocalDev2NameAr(dev2NameAr);
    setLocalDev2NameEn(dev2NameEn);
    setLocalDev2ImageUrl(dev2ImageUrl);
  }, [
    tournamentNameAr, 
    tournamentNameEn, 
    tournamentLogoUrl, 
    strictIpCheck, 
    isVotingPaused,
    dev1NameAr,
    dev1NameEn,
    dev1ImageUrl,
    dev2NameAr,
    dev2NameEn,
    dev2ImageUrl,
  ]);

  // Feedback states
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const dev1FileInputRef = useRef<HTMLInputElement>(null);
  const dev2FileInputRef = useRef<HTMLInputElement>(null);

  const showStatus = (type: "success" | "error", text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => {
      setStatusMessage(null);
    }, 4500);
  };

  // Convert and compress file to base64
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, isEditMode = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Create canvas to resize the image to maximum 300x300 pixels
        // This keeps base64 payload super fast and lightweight for database storage!
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 300;
        const MAX_HEIGHT = 300;
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
        ctx?.drawImage(img, 0, 0, width, height);

        // Convert canvas image to JPEG base64 with moderate quality
        const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
        if (isEditMode) {
          setEditPlayerImg(dataUrl);
        } else {
          setNewPlayerImg(dataUrl);
        }
        setIsUploading(false);
        showStatus("success", t.uploadSuccess);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 250;
        const MAX_HEIGHT = 250;
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
        ctx?.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
        setLocalTournamentLogoUrl(dataUrl);
        setIsUploading(false);
        showStatus("success", t.uploadSuccess);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleDev1ImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 200;
        const MAX_HEIGHT = 200;
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
        ctx?.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
        setLocalDev1ImageUrl(dataUrl);
        setIsUploading(false);
        showStatus("success", t.uploadSuccess);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleDev2ImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 200;
        const MAX_HEIGHT = 200;
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
        ctx?.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
        setLocalDev2ImageUrl(dataUrl);
        setIsUploading(false);
        showStatus("success", t.uploadSuccess);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // 1) API call: Add Player
  const handleAddPlayerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerAr.trim() || !newPlayerEn.trim()) {
      showStatus("error", t.emptyFields);
      return;
    }

    try {
      const res = await fetch("/api/admin/players", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-passcode": adminPasscode,
        },
        body: JSON.stringify({
          nameAr: newPlayerAr.trim(),
          nameEn: newPlayerEn.trim(),
          imageUrl: newPlayerImg,
        }),
      });

      if (!res.ok) throw new Error("Failed to add player");

      const responseData = await res.json();
      if (responseData.success) {
        setNewPlayerAr("");
        setNewPlayerEn("");
        setNewPlayerImg("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        
        showStatus("success", t.updatesSaved);
        // Refresh local player copy and notify parent
        onRefreshTournamentState();
        fetchTournamentPlayersLocal();
      }
    } catch (e: any) {
      showStatus("error", e.message || "Error adding player");
    }
  };

  // Helper local fetching
  const fetchTournamentPlayersLocal = async () => {
    try {
      const res = await fetch("/api/tournament");
      const data = await res.json();
      if (data.players) {
        setPlayersList(data.players);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 2) API call: Delete Player
  const handleDeletePlayer = async (id: string) => {
    if (!confirm(t.deleteConfirm)) return;

    try {
      const res = await fetch(`/api/admin/players/${id}`, {
        method: "DELETE",
        headers: {
          "x-admin-passcode": adminPasscode,
        },
      });

      if (!res.ok) throw new Error("Failed to delete player");

      showStatus("success", t.updatesSaved);
      onRefreshTournamentState();
      fetchTournamentPlayersLocal();
    } catch (e: any) {
      showStatus("error", e.message || "Error deleting player");
    }
  };

  // 3) Initiating Edit Player Form
  const startEditPlayer = (player: Player) => {
    setEditingPlayerId(player.id);
    setEditPlayerAr(player.nameAr);
    setEditPlayerEn(player.nameEn);
    setEditPlayerImg(player.imageUrl || "");
  };

  // Edit Submit Save
  const handleEditPlayerSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlayerId) return;

    try {
      const res = await fetch(`/api/admin/players/${editingPlayerId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-admin-passcode": adminPasscode,
        },
        body: JSON.stringify({
          nameAr: editPlayerAr.trim(),
          nameEn: editPlayerEn.trim(),
          imageUrl: editPlayerImg,
        }),
      });

      if (!res.ok) throw new Error("Failed to save changes");

      setEditingPlayerId(null);
      showStatus("success", t.updatesSaved);
      onRefreshTournamentState();
      fetchTournamentPlayersLocal();
    } catch (e: any) {
      showStatus("error", e.message || "Error saving changes");
    }
  };

  // 4) Save Voting Status & Strict Checking Settings
  const handleSaveSettings = async () => {
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-passcode": adminPasscode,
        },
        body: JSON.stringify({
          isVotingPaused: localVotingPaused,
          strictIpCheck: localStrictIp,
          tournamentNameAr: localTournamentNameAr.trim(),
          tournamentNameEn: localTournamentNameEn.trim(),
          tournamentLogoUrl: localTournamentLogoUrl,
          dev1NameAr: localDev1NameAr.trim(),
          dev1NameEn: localDev1NameEn.trim(),
          dev1ImageUrl: localDev1ImageUrl,
          dev2NameAr: localDev2NameAr.trim(),
          dev2NameEn: localDev2NameEn.trim(),
          dev2ImageUrl: localDev2ImageUrl,
        }),
      });

      if (!res.ok) throw new Error("Failed to save settings");

      showStatus("success", t.updatesSaved);
      onRefreshTournamentState();
    } catch (e: any) {
      showStatus("error", e.message || "Error saving settings");
    }
  };

  // 5) Reset all votes
  const handleResetVotes = async () => {
    if (!confirm(`${t.resetConfirmTitle}\n\n${t.resetConfirmMsg}`)) return;

    try {
      const res = await fetch("/api/admin/reset", {
        method: "POST",
        headers: {
          "x-admin-passcode": adminPasscode,
        },
      });

      if (!res.ok) throw new Error("Failed to reset tournament");

      showStatus("success", t.updatesSaved);
      onRefreshTournamentState();
      fetchTournamentPlayersLocal();
    } catch (e: any) {
      showStatus("error", e.message || "Error resetting votes");
    }
  };

  // 6) Change Passcode
  const handleChangePasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPasscode.trim()) {
      showStatus("error", t.emptyFields);
      return;
    }

    try {
      const res = await fetch("/api/admin/change-passcode", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-passcode": adminPasscode,
        },
        body: JSON.stringify({
          newPasscode: newPasscode.trim(),
        }),
      });

      if (!res.ok) throw new Error("Failed to update passcode");

      setNewPasscode("");
      showStatus("success", `${t.updatesSaved} !يرجى تذكّر الرمز الجديد`);
      onRefreshTournamentState();
    } catch (e: any) {
      showStatus("error", e.message || "Error updating passcode");
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div 
        dir={isRtl ? "rtl" : "ltr"}
        className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden animate-fade-in"
      >
        {/* Admin Header */}
        <div className="bg-slate-900 text-white px-6 py-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 rounded-xl text-emerald-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">{t.adminTitle}</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {isRtl ? "مشرف النظام" : "Superuser Dashboard"}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="bg-slate-50 border-b border-slate-100 flex px-6 py-2 gap-4">
          <button
            onClick={() => setActiveTab("players")}
            className={`py-3 px-4 text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === "players"
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {isRtl ? "إضافة وتعديل اللاعبين" : "Players Lineup"}
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`py-3 px-4 text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === "settings"
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {isRtl ? "إعدادات التصويت والرمز" : "Voting & Security"}
          </button>
        </div>

        {/* Feedback Messages */}
        {statusMessage && (
          <div className={`px-6 py-3.5 flex items-center justify-between gap-3 text-sm transition-all animate-slide-in ${
            statusMessage.type === "success" 
              ? "bg-emerald-50 text-emerald-800 border-b border-emerald-100" 
              : "bg-rose-50 text-rose-800 border-b border-rose-100"
          }`}>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span className="font-semibold">{statusMessage.text}</span>
            </div>
          </div>
        )}

        {/* Body content */}
        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === "players" ? (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
              
              {/* Left Column: Register Form */}
              <div className="md:col-span-5 bg-slate-50/70 p-6 rounded-2xl border border-slate-100 h-fit">
                <h3 className="text-md font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Plus className="w-4.5 h-4.5 text-emerald-600" />
                  <span>{editingPlayerId ? t.editPlayerTitle : t.addPlayerTitle}</span>
                </h3>

                <form onSubmit={editingPlayerId ? handleEditPlayerSave : handleAddPlayerSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">{t.playerNameAr}</label>
                    <input
                      type="text"
                      dir="rtl"
                      value={editingPlayerId ? editPlayerAr : newPlayerAr}
                      onChange={(e) => editingPlayerId ? setEditPlayerAr(e.target.value) : setNewPlayerAr(e.target.value)}
                      placeholder="مثال: يوسف بلايلي"
                      className="w-full bg-white border border-slate-200 px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-arabic"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">{t.playerNameEn}</label>
                    <input
                      type="text"
                      dir="ltr"
                      value={editingPlayerId ? editPlayerEn : newPlayerEn}
                      onChange={(e) => editingPlayerId ? setEditPlayerEn(e.target.value) : setNewPlayerEn(e.target.value)}
                      placeholder="e.g. Youcef Belaïli"
                      className="w-full bg-white border border-slate-200 px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-sans"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">{t.playerPhoto}</label>
                    <div className="mt-1 flex justify-center px-4 py-4 border-2 border-slate-200 border-dashed rounded-xl bg-white hover:bg-slate-50 transition-all group relative cursor-pointer">
                      <div className="space-y-1 text-center">
                        <Upload className="mx-auto h-8 w-8 text-slate-400 group-hover:text-emerald-600 transition-colors" />
                        <div className="flex text-xs text-slate-600">
                          <span>{t.uploadPlaceholder}</span>
                          <input
                            ref={editingPlayerId ? editFileInputRef : fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleImageUpload(e, !!editingPlayerId)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>
                    
                    {/* Display base64 selection state helper */}
                    {((editingPlayerId ? editPlayerImg : newPlayerImg)) && (
                      <div className="mt-3 relative inline-block">
                        <img 
                          src={editingPlayerId ? editPlayerImg : newPlayerImg}
                          alt="preview"
                          className="w-20 h-20 object-cover rounded-xl border-2 border-emerald-500 shadow-md"
                        />
                        <button
                          type="button"
                          onClick={() => editingPlayerId ? setEditPlayerImg("") : setNewPlayerImg("")}
                          className="absolute -top-1.5 -right-1.5 p-1 bg-rose-500 text-white rounded-full shadow hover:bg-rose-600 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="submit"
                      className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white font-bold py-2.5 px-4 rounded-xl shadow-md transition-all text-sm flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      <span>{editingPlayerId ? t.saveBtn : t.addBtn}</span>
                    </button>
                    {editingPlayerId && (
                      <button
                        type="button"
                        onClick={() => setEditingPlayerId(null)}
                        className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2.5 px-4 rounded-xl transition-all text-sm cursor-pointer"
                      >
                        {t.cancel}
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Right Column: Dynamic Lineup Roster */}
              <div className="md:col-span-7">
                <h3 className="text-md font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <span>{t.playersManagerTitle}</span>
                </h3>

                {playersList.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50 rounded-2xl border border-slate-100 text-slate-400">
                    <Trash className="w-8 h-8 mx-auto stroke-1.5 mb-2" />
                    <p className="text-sm">{t.noPlayers}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {playersList.map((p) => (
                      <div 
                        key={p.id}
                        className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-all gap-4"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {p.imageUrl ? (
                            <img 
                              src={p.imageUrl} 
                              alt={p.nameEn} 
                              className="w-12 h-12 rounded-xl object-cover border border-slate-200"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 font-bold text-xs">
                              {p.nameEn.charAt(0)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <h4 className="font-bold text-slate-800 truncate">{isRtl ? p.nameAr : p.nameEn}</h4>
                            <p className="text-xs text-slate-400 truncate">
                              {isRtl ? p.nameEn : p.nameAr}
                            </p>
                          </div>
                        </div>

                        {/* Actions controls */}
                        <div className="flex items-center gap-2.5 flex-shrink-0">
                          <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 text-slate-800 text-xs font-mono font-bold">
                            {p.votes} {isRtl ? "صوت" : "votes"}
                          </div>
                          
                          <button
                            onClick={() => startEditPlayer(p)}
                            className="p-1.5 text-slate-500 hover:text-emerald-600 bg-slate-50 hover:bg-emerald-50 rounded-xl transition-colors cursor-pointer"
                            title={t.editPlayerTitle}
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          
                          <button
                            onClick={() => handleDeletePlayer(p.id)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                            title={t.deleteConfirm}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          ) : (
            // Tab 2: Settings and Operations
            <div className="space-y-8 max-w-2xl mx-auto">
              
              {/* General voting rule settings */}
              <div>
                <h3 className="text-md font-bold text-slate-800 mb-4 pb-1 border-b border-slate-100">
                  {t.adminSettingsHeader}
                </h3>
                
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-5">
                  
                  {/* Tournament Custom Branding (Name & Logo) */}
                  <div className="space-y-4 pb-5 border-b border-slate-200/50">
                    <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5 mb-1 text-emerald-700">
                      <ShieldCheck className="w-4 h-4" />
                      <span>{t.editTournamentTitle}</span>
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">{t.tournamentNameArLabel}</label>
                        <input
                          type="text"
                          value={localTournamentNameAr}
                          onChange={(e) => setLocalTournamentNameAr(e.target.value)}
                          placeholder="مثال: كأس الرابطة المحلية"
                          className="w-full bg-white border border-slate-200/80 px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">{t.tournamentNameEnLabel}</label>
                        <input
                          type="text"
                          value={localTournamentNameEn}
                          onChange={(e) => setLocalTournamentNameEn(e.target.value)}
                          placeholder="e.g. Local Championship Cup"
                          className="w-full bg-white border border-slate-200/80 px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">{t.tournamentLogoLabel}</label>
                      <div className="flex flex-wrap items-center gap-4">
                        <input
                          type="file"
                          ref={logoFileInputRef}
                          onChange={handleLogoUpload}
                          accept="image/*"
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => logoFileInputRef.current?.click()}
                          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 active:scale-98 transition-all cursor-pointer shadow-sm animate-pulse-subtle"
                        >
                          <Upload className="w-4 h-4 text-slate-500" />
                          <span>{t.uploadPlaceholder.split("(")[0]}</span>
                        </button>
                        
                        {localTournamentLogoUrl ? (
                          <div className="relative flex items-center gap-2 bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-xl">
                            <img
                              src={localTournamentLogoUrl}
                              alt="Tournament logo"
                              className="w-8 h-8 rounded-lg object-cover border border-emerald-200 shadow-sm"
                            />
                            <button
                              type="button"
                              onClick={() => setLocalTournamentLogoUrl("")}
                              className="text-rose-500 hover:text-rose-600 font-bold text-xs"
                              title={isRtl ? "إزالة الشعار" : "Remove logo"}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">
                            {isRtl ? "شعار الكأس الافتراضي ثلاثي الأبعاد" : "Default 3D golden trophy fallback is active"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Developers / Owners Configurations */}
                  <div className="space-y-4 pb-5 border-b border-slate-200/50">
                    <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5 mb-1 text-emerald-700">
                      <ShieldCheck className="w-4 h-4" />
                      <span>{t.editDevelopersTitle}</span>
                    </h4>

                    {/* Developer 1 Profile */}
                    <div className="p-4 bg-slate-100/50 rounded-xl border border-slate-200/40 space-y-3">
                      <div className="text-xs font-bold text-slate-700 pb-1 border-b border-slate-200/60 font-sans">
                        {t.dev1Header}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 mb-1">{t.devNameArLabel}</label>
                          <input
                            type="text"
                            value={localDev1NameAr}
                            onChange={(e) => setLocalDev1NameAr(e.target.value)}
                            placeholder="اسم المطور بالعربية"
                            className="w-full bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 mb-1">{t.devNameEnLabel}</label>
                          <input
                            type="text"
                            value={localDev1NameEn}
                            onChange={(e) => setLocalDev1NameEn(e.target.value)}
                            placeholder="Developer name in English"
                            className="w-full bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1">{t.devPhotoLabel}</label>
                        <div className="flex items-center gap-3">
                          <input
                            type="file"
                            ref={dev1FileInputRef}
                            onChange={handleDev1ImageUpload}
                            accept="image/*"
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={() => dev1FileInputRef.current?.click()}
                            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
                          >
                            {isRtl ? "رفع الصورة" : "Upload Picture"}
                          </button>
                          {localDev1ImageUrl && (
                            <div className="relative flex items-center gap-1.5 bg-emerald-50/80 px-2 py-1 rounded-lg border border-emerald-100">
                              <img
                                src={localDev1ImageUrl}
                                alt="Dev 1 preview"
                                className="w-7 h-7 rounded-full object-cover border border-emerald-200"
                              />
                              <button
                                type="button"
                                onClick={() => setLocalDev1ImageUrl("")}
                                className="text-rose-500 hover:text-rose-600 transition-colors font-bold text-xs"
                                title="إزالة"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Developer 2 Profile */}
                    <div className="p-4 bg-slate-100/50 rounded-xl border border-slate-200/40 space-y-3">
                      <div className="text-xs font-bold text-slate-700 pb-1 border-b border-slate-200/60 font-sans">
                        {t.dev2Header}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 mb-1">{t.devNameArLabel}</label>
                          <input
                            type="text"
                            value={localDev2NameAr}
                            onChange={(e) => setLocalDev2NameAr(e.target.value)}
                            placeholder="اسم المطور بالعربية"
                            className="w-full bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 mb-1">{t.devNameEnLabel}</label>
                          <input
                            type="text"
                            value={localDev2NameEn}
                            onChange={(e) => setLocalDev2NameEn(e.target.value)}
                            placeholder="Developer name in English"
                            className="w-full bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1">{t.devPhotoLabel}</label>
                        <div className="flex items-center gap-3">
                          <input
                            type="file"
                            ref={dev2FileInputRef}
                            onChange={handleDev2ImageUpload}
                            accept="image/*"
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={() => dev2FileInputRef.current?.click()}
                            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
                          >
                            {isRtl ? "رفع الصورة" : "Upload Picture"}
                          </button>
                          {localDev2ImageUrl && (
                            <div className="relative flex items-center gap-1.5 bg-emerald-50/80 px-2 py-1 rounded-lg border border-emerald-100">
                              <img
                                src={localDev2ImageUrl}
                                alt="Dev 2 preview"
                                className="w-7 h-7 rounded-full object-cover border border-emerald-200"
                              />
                              <button
                                type="button"
                                onClick={() => setLocalDev2ImageUrl("")}
                                className="text-rose-500 hover:text-rose-600 transition-colors font-bold text-xs"
                                title="إزالة"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Lock/Pause Switch */}
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-slate-800 text-md">
                        {isRtl ? "إيقاف أو تفعيل التصويت" : "Voting active status"}
                      </h4>
                      <p className="text-slate-400 text-xs mt-0.5">
                        {isRtl ? "يمكنك تعطيل التصويت من الدخول العام مؤقتاً وعرض النتائج فقط" : "Prevent new voting submittals but keep metrics viewable"}
                      </p>
                    </div>
                    <button 
                      onClick={() => setLocalVotingPaused(!localVotingPaused)}
                      className="text-slate-600 hover:text-slate-800 focus:outline-none cursor-pointer"
                    >
                      {localVotingPaused ? (
                        <ToggleRight className="w-12 h-12 text-rose-500" />
                      ) : (
                        <ToggleLeft className="w-12 h-12 text-slate-300" />
                      )}
                    </button>
                  </div>

                  {/* Strict IP check toggle */}
                  <div className="flex items-center justify-between gap-12 pt-4 border-t border-slate-200/50">
                    <div>
                      <h4 className="font-bold text-slate-800 text-md">
                        {t.strictIpCheck}
                      </h4>
                      <p className="text-slate-400 text-xs mt-0.5">
                        {isRtl 
                          ? "تفعيل هذا يمنع أي شخصين على نفس شبكة الواي فاي من التصويت (كلاهما لهما نفس الـ IP). قد يعطل تصويت الجماهير بالملعب." 
                          : "Blocks multi-device logins from same home/stadium wireless IP block. Note: might lock out arena fans."}
                      </p>
                    </div>
                    <button 
                      onClick={() => setLocalStrictIp(!localStrictIp)}
                      className="text-slate-600 hover:text-slate-800 focus:outline-none cursor-pointer"
                    >
                      {localStrictIp ? (
                        <ToggleRight className="w-12 h-12 text-emerald-500" />
                      ) : (
                        <ToggleLeft className="w-12 h-12 text-slate-300" />
                      )}
                    </button>
                  </div>

                  <div className="flex pt-4 justify-end">
                    <button
                      onClick={handleSaveSettings}
                      className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 px-5 rounded-xl text-sm transition-all shadow cursor-pointer"
                    >
                      {t.saveBtn}
                    </button>
                  </div>
                </div>
              </div>

              {/* Passcode changer */}
              <div>
                <h3 className="text-md font-bold text-slate-800 mb-4 pb-1 border-b border-slate-100">
                  {t.changePasscodeTitle}
                </h3>
                
                <form onSubmit={handleChangePasscode} className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex gap-4 items-end">
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">{t.newPasscodePlaceholder}</label>
                    <input
                      type="text"
                      value={newPasscode}
                      onChange={(e) => setNewPasscode(e.target.value)}
                      placeholder="e.g. 5566"
                      className="w-full bg-white border border-slate-200 px-4 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                  <button
                    type="submit"
                    className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-2.5 px-5 rounded-xl text-sm transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Key className="w-4 h-4" />
                    <span>{t.updatePasscodeBtn}</span>
                  </button>
                </form>
              </div>

              {/* Reset Voting Danger Zone */}
              <div className="bg-rose-50 border border-rose-200 p-6 rounded-2xl space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-rose-100 text-rose-700 rounded-xl">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-rose-800 text-md">
                      {isRtl ? "منطقة الخطورة القصوى (إعادة الضبط)" : "Danger Zone (Wipe Tournament Votes)"}
                    </h4>
                    <p className="text-rose-600 text-xs mt-0.5 leading-relaxed">
                      {isRtl 
                        ? "سيتم تصفير جميع أصوات المشجعين وحظر السجلات مما يتيح للأجهزة التصويت مجدداً. لن يتم حذف اللاعبين المسجلين في القائمة حالياً."
                        : "Resets statistics but preserves your loaded football player list. Devices can vote again."}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleResetVotes}
                    className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 px-5 rounded-xl text-sm transition-all shadow-md hover:shadow-rose-100 cursor-pointer flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>{t.resetBtn}</span>
                  </button>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
};
