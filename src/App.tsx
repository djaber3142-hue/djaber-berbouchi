import { useState, useEffect, FormEvent } from "react";
import { Player, Language, TournamentState } from "./types";
import { translations } from "./translations";
import { PlayerCard } from "./components/PlayerCard";
import { AdminPanel } from "./components/AdminPanel";
import { 
  Trophy, Globe, Shield, RefreshCw, Star, 
  HelpCircle, AlertCircle, Sparkles, CheckCircle2 
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Generate or retrieve persistent local voter identifier
const getOrCreateVoterUuid = (): string => {
  let uuid = localStorage.getItem("voter_uuid");
  if (!uuid) {
    uuid = "voter_" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    localStorage.setItem("voter_uuid", uuid);
  }
  return uuid;
};

export default function App() {
  const voterUuid = getOrCreateVoterUuid();

  // 1) General UI State
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem("voting_lang");
    return (saved === "ar" || saved === "en") ? saved : "ar";
  });
  
  const [tournamentState, setTournamentState] = useState<TournamentState>({
    players: [],
    totalVotes: 0,
    isVotingPaused: false,
  });

  const [hasVoted, setHasVoted] = useState(false);
  const [votedPlayerId, setVotedPlayerId] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(true);

  // 2) Authentication State
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPasscode, setAdminPasscode] = useState("");
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [loginError, setLoginError] = useState("");

  // 3) Alerts & Notifications
  const [notification, setNotification] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Computed translation object helper
  const t = translations[lang];
  const isRtl = lang === "ar";

  useEffect(() => {
    fetchTournamentData();
    checkUserVotingStatus();
  }, [voterUuid]);

  // Keep browser updated periodically (every 10 seconds) for real-time local sports feeling!
  useEffect(() => {
    const timer = setInterval(() => {
      fetchTournamentData();
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const triggerNotification = (type: "success" | "error", text: string) => {
    setNotification({ type, text });
    setTimeout(() => {
      setNotification(null);
    }, 5000);
  };

  const fetchTournamentData = async () => {
    try {
      const res = await fetch("/api/tournament");
      if (!res.ok) throw new Error("Server error");
      const data = await res.json();
      setTournamentState({
        players: data.players || [],
        totalVotes: data.totalVotes || 0,
        isVotingPaused: !!data.isVotingPaused,
        tournamentNameAr: data.tournamentNameAr,
        tournamentNameEn: data.tournamentNameEn,
        tournamentLogoUrl: data.tournamentLogoUrl,
        strictIpCheck: data.strictIpCheck,
        dev1NameAr: data.dev1NameAr || "",
        dev1NameEn: data.dev1NameEn || "",
        dev1ImageUrl: data.dev1ImageUrl || "",
        dev2NameAr: data.dev2NameAr || "",
        dev2NameEn: data.dev2NameEn || "",
        dev2ImageUrl: data.dev2ImageUrl || "",
      });
    } catch (e) {
      console.error("Error loading tournament stats", e);
    } finally {
      setIsFetching(false);
    }
  };

  const checkUserVotingStatus = async () => {
    try {
      const res = await fetch(`/api/voter-status/${voterUuid}`);
      if (!res.ok) throw new Error();
      const status = await res.json();
      if (status.voted) {
        setHasVoted(true);
        setVotedPlayerId(status.playerId || "external-record");
      } else {
        setHasVoted(false);
        setVotedPlayerId(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleLanguageToggle = () => {
    const newLang: Language = lang === "ar" ? "en" : "ar";
    setLang(newLang);
    localStorage.setItem("voting_lang", newLang);
  };

  // 4) Handle Voting Process triggered from card
  const handleVoteInput = async (playerId: string) => {
    if (hasVoted) {
      triggerNotification("error", t.alreadyVotedMsg);
      return;
    }
    if (tournamentState.isVotingPaused) {
      triggerNotification("error", t.votingClosedMsg);
      return;
    }

    try {
      const res = await fetch("/api/vote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          playerId,
          voterUuid,
        }),
      });

      const responseVal = await res.json();
      if (!res.ok) {
        throw new Error(responseVal.error || "Voting failed");
      }

      setHasVoted(true);
      setVotedPlayerId(playerId);
      
      const votedPlayer = tournamentState.players.find((p) => p.id === playerId);
      const playerName = votedPlayer ? (isRtl ? votedPlayer.nameAr : votedPlayer.nameEn) : "";
      
      triggerNotification("success", `${t.voteSuccessMsg} ${playerName}`);
      fetchTournamentData();
    } catch (err: any) {
      triggerNotification("error", err.message || "Error submitting vote");
    }
  };

  // 5) Admin Auth Logic
  const handleAdminAuthSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ passcode: adminPasscode }),
      });

      if (res.ok) {
        setIsAdminAuthenticated(true);
        setShowAdminLogin(false);
        triggerNotification("success", isRtl ? "تم تسجيل دخول المشرف بنجاح" : "Admin verified successfully");
      } else {
        setLoginError(t.invalidPasscode);
      }
    } catch (err) {
      setLoginError("Connection failure");
    }
  };

  const handleLogout = () => {
    setIsAdminAuthenticated(false);
    setAdminPasscode("");
    triggerNotification("success", isRtl ? "تم تسجيل الخروج" : "Logged out successfully");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col selection:bg-emerald-500 selection:text-white pb-16">
      
      {/* Top bilingual Header Bar */}
      <header className="bg-white border-b border-slate-100 shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          
          {/* Logo / Title Area */}
          <div className="flex items-center gap-2.5">
            <div className="bg-gradient-to-tr from-emerald-600 to-teal-500 text-white p-0.5 rounded-xl shadow-md flex items-center justify-center overflow-hidden w-9 h-9">
              {tournamentState.tournamentLogoUrl ? (
                <img
                  src={tournamentState.tournamentLogoUrl}
                  alt="Tournament brand logo"
                  className="w-full h-full object-cover rounded-[10px]"
                />
              ) : (
                <Trophy className="w-5 h-5 animate-pulse-subtle" />
              )}
            </div>
            <div>
              <span className="font-extrabold text-slate-800 text-md tracking-tight block">
                {tournamentState.tournamentNameAr && tournamentState.tournamentNameEn ? (
                  isRtl ? tournamentState.tournamentNameAr : tournamentState.tournamentNameEn
                ) : (
                  isRtl ? "تصويت نجم البطولة" : "Tournament MVP Vote"
                )}
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 block">
                {isRtl ? "التصويت الرسمي للجماهير" : "Official Fans Vote"}
              </span>
            </div>
          </div>

          {/* Languages Toggle & Admin Buttons */}
          <div className="flex items-center gap-3">
            
            {/* Language Switch button */}
            <button
              onClick={handleLanguageToggle}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all active:scale-95 cursor-pointer border border-slate-200/40"
            >
              <Globe className="w-3.5 h-3.5 text-slate-400" />
              <span>{t.langSwitch}</span>
            </button>

            {/* Admin trigger button */}
            {isAdminAuthenticated ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsAdminAuthenticated(true)}
                  className="px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-xs transition-all cursor-pointer flex items-center gap-1"
                >
                  <Shield className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{t.adminBtn}</span>
                </button>
                <button
                  onClick={handleLogout}
                  className="px-2.5 py-2 rounded-xl bg-rose-50 text-rose-600 font-bold text-xs hover:bg-rose-100 transition-colors cursor-pointer"
                >
                  {t.logoutBtn}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAdminLogin(true)}
                className="p-2 rounded-xl bg-slate-100 text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition-colors cursor-pointer"
                title={t.adminBtn}
              >
                <Shield className="w-4 h-4" />
              </button>
            )}

          </div>

        </div>
      </header>

      {/* Main sport banner section */}
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 w-full">
        
        {/* Banner Card Jumbotron */}
        <div className="relative rounded-3xl bg-slate-900 overflow-hidden text-white shadow-2xl py-12 px-6 sm:px-12 mb-10 flex flex-col items-center justify-center text-center">
          
          {/* Dynamic glowing ambient overlays simulating field lamps */}
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/20 rounded-full filter blur-[100px] pointer-events-none" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-teal-500/10 rounded-full filter blur-[120px] pointer-events-none" />
          
          {/* Soccer-pitch lines asset background decoration */}
          <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

          {/* MVP Badge */}
          <motion.div 
            initial={{ scale: 0.1 }}
            animate={{ scale: 1 }}
            className="relative z-10 bg-emerald-500/10 text-emerald-400 font-extrabold text-xs px-4 py-1.5 rounded-full uppercase tracking-widest border border-emerald-500/30 flex items-center gap-1.5 mb-5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isRtl ? "نجم الأسبوع" : "PLAYER OF THE MATCH"}</span>
          </motion.div>

          {/* Tournament logo custom brand element */}
          {tournamentState.tournamentLogoUrl && (
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="relative z-10 mb-5 p-1 bg-white/10 rounded-2xl border border-white/20 shadow-xl"
            >
              <img
                src={tournamentState.tournamentLogoUrl}
                alt="Tournament brand logo logo-type"
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl object-cover"
              />
            </motion.div>
          )}

          <h1 className="relative z-10 text-4xl sm:text-5xl font-black tracking-tight leading-tight max-w-3xl font-sans">
            {tournamentState.tournamentNameAr && tournamentState.tournamentNameEn ? (
              isRtl ? tournamentState.tournamentNameAr : tournamentState.tournamentNameEn
            ) : (
              t.appTitle
            )}
          </h1>
          <p className="relative z-10 text-slate-300 text-sm sm:text-md mt-4 max-w-xl font-medium leading-relaxed">
            {t.appSubtitle}
          </p>

          <div className="relative z-10 w-full max-w-md bg-white/5 border border-white/10 backdrop-blur-sm p-4 rounded-2xl flex items-center justify-between gap-4 mt-8">
            <div className="flex-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                {t.totalVotes}
              </span>
              <span className="text-3xl font-black tracking-tight font-mono text-white mt-0.5 block">
                {tournamentState.totalVotes}
              </span>
            </div>
            
            <button
              onClick={() => {
                setIsFetching(true);
                fetchTournamentData();
              }}
              disabled={isFetching}
              className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all active:scale-95 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin text-emerald-400" : ""}`} />
            </button>
          </div>

          {/* Voting Pause/Open active banner state indicator */}
          <div className="absolute bottom-4 right-4 z-10">
            {tournamentState.isVotingPaused ? (
              <span className="inline-flex items-center gap-1.5 bg-rose-500/20 text-rose-300 font-bold text-[10px] px-3 py-1 rounded-full border border-rose-500/30">
                <span className="w-1.5 h-1.5 bg-rose-400 rounded-full animate-ping" />
                <span>{t.votingClosed}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 font-bold text-[10px] px-3 py-1 rounded-full border border-emerald-500/30">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
                <span>{t.votingActive}</span>
              </span>
            )}
          </div>
        </div>

        {/* Dynamic Voter Help Tip bar */}
        {!hasVoted && !tournamentState.isVotingPaused && (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-start gap-3 mb-10 w-full max-w-4xl mx-auto">
            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-amber-800">
                {t.oneVoteWarning}
              </p>
              <p className="text-[10px] text-amber-600/85 mt-0.5">
                {isRtl 
                  ? "سيقوم المتصفح بتسجيل توقيع جهازك لضمان نزاهة النتائج وتصفية المكررين لبطولتنا المحلية." 
                  : "We use a browser persistent fingerprinting token on our system to prevent multi-voting."}
              </p>
            </div>
          </div>
        )}

        {/* Players Roster Nominees Grid */}
        {tournamentState.players.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl shadow-sm border border-slate-100 max-w-md mx-auto">
            <Trophy className="w-12 h-12 text-slate-300 mx-auto stroke-1 mb-4" />
            <h3 className="text-lg font-bold text-slate-800">{t.noPlayers}</h3>
            {isAdminAuthenticated && (
              <button
                onClick={() => setIsAdminAuthenticated(true)}
                className="mt-4 bg-emerald-600 text-white font-bold text-xs py-2 px-4 rounded-xl shadow cursor-pointer hover:bg-emerald-700"
              >
                {t.addPlayerTitle}
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 max-w-7xl mx-auto">
            {tournamentState.players.map((p) => (
              <PlayerCard
                key={p.id}
                player={p}
                lang={lang}
                hasVoted={hasVoted}
                votedPlayerId={votedPlayerId}
                onVote={handleVoteInput}
                isVotingPaused={tournamentState.isVotingPaused}
                t={t}
              />
            ))}
          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer className="mt-20 border-t border-slate-200/50 pt-8 text-center text-slate-400 text-xs w-full">
        {/* Developers / Owners section */}
        <div className="mb-8 flex flex-col items-center justify-center gap-4">
          <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase flex items-center gap-1.5 justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>{t.footerDevelopersTitle}</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 mt-1">
            {/* Dev 1 Card */}
            {(tournamentState.dev1NameAr || tournamentState.dev1NameEn) && (
              <div className="flex items-center gap-3 bg-white hover:bg-slate-50 px-4 py-2 rounded-full border border-slate-100 transition-all duration-300 shadow-sm">
                <div className="w-8 h-8 rounded-full overflow-hidden border border-emerald-500/30 flex-shrink-0 bg-slate-100 flex items-center justify-center">
                  {tournamentState.dev1ImageUrl ? (
                    <img
                      src={tournamentState.dev1ImageUrl}
                      alt="Developer 1"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[10px] font-bold text-emerald-600">D1</span>
                  )}
                </div>
                <div className={`${isRtl ? "text-right" : "text-left"} flex flex-col`}>
                  <span className="font-bold text-slate-700 text-xs">
                    {isRtl ? tournamentState.dev1NameAr : tournamentState.dev1NameEn}
                  </span>
                </div>
              </div>
            )}

            {/* Dev 2 Card */}
            {(tournamentState.dev2NameAr || tournamentState.dev2NameEn) && (
              <div className="flex items-center gap-3 bg-white hover:bg-slate-50 px-4 py-2 rounded-full border border-slate-100 transition-all duration-300 shadow-sm">
                <div className="w-8 h-8 rounded-full overflow-hidden border border-emerald-500/30 flex-shrink-0 bg-slate-100 flex items-center justify-center">
                  {tournamentState.dev2ImageUrl ? (
                    <img
                      src={tournamentState.dev2ImageUrl}
                      alt="Developer 2"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[10px] font-bold text-emerald-600">D2</span>
                  )}
                </div>
                <div className={`${isRtl ? "text-right" : "text-left"} flex flex-col`}>
                  <span className="font-bold text-slate-700 text-xs">
                    {isRtl ? tournamentState.dev2NameAr : tournamentState.dev2NameEn}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <p className="font-semibold">
          © {new Date().getFullYear()} {isRtl ? "بطولة الرابطة المحلية - جميع الحقوق محفوظة" : "Local Tournament League. All rights reserved."}
        </p>
        <p className="mt-1 text-[10px]">
          {isRtl 
            ? "نظام تصويت فوري محمي ومعتمد للجوائز السنوية بنهاية الموسم الكروي" 
            : "Authorized real-time fanbase voting panel for postseason sport statistics."}
        </p>
      </footer>

      {/* Admin Login Modal (Triggered by passcode button) */}
      <AnimatePresence>
        {showAdminLogin && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              layout
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl p-6"
              dir={isRtl ? "rtl" : "ltr"}
            >
              <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-extrabold text-slate-800 text-lg">{t.adminTitle}</h3>
                </div>
                <button 
                  onClick={() => {
                    setShowAdminLogin(false);
                    setAdminPasscode("");
                    setLoginError("");
                  }}
                  className="p-1 px-2.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                >
                  {t.cancel}
                </button>
              </div>

              <form onSubmit={handleAdminAuthSubmit} className="mt-5 space-y-4">
                <p className="text-xs text-slate-500 leading-relaxed">
                  {t.enterPasscode}
                </p>

                <div className="mt-1">
                  <input
                    type="password"
                    required
                    value={adminPasscode}
                    onChange={(e) => setAdminPasscode(e.target.value)}
                    placeholder={t.passcodePlaceholder}
                    className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-center text-lg font-bold tracking-widest"
                  />
                </div>

                {loginError && (
                  <div className="p-3 bg-rose-50 border border-rose-100 text-rose-800 rounded-xl text-xs font-semibold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{loginError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-md active:scale-98 cursor-pointer text-sm"
                >
                  {t.loginBtn}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Active Admin Dashboard Overlays panel */}
      {isAdminAuthenticated && (
        <AdminPanel
          players={tournamentState.players}
          lang={lang}
          onClose={() => setIsAdminAuthenticated(false)}
          isVotingPaused={tournamentState.isVotingPaused}
          onRefreshTournamentState={() => {
            fetchTournamentData();
            checkUserVotingStatus();
          }}
          t={t}
          adminPasscode={adminPasscode}
          tournamentNameAr={tournamentState.tournamentNameAr}
          tournamentNameEn={tournamentState.tournamentNameEn}
          tournamentLogoUrl={tournamentState.tournamentLogoUrl}
          strictIpCheck={tournamentState.strictIpCheck}
          dev1NameAr={tournamentState.dev1NameAr}
          dev1NameEn={tournamentState.dev1NameEn}
          dev1ImageUrl={tournamentState.dev1ImageUrl}
          dev2NameAr={tournamentState.dev2NameAr}
          dev2NameEn={tournamentState.dev2NameEn}
          dev2ImageUrl={tournamentState.dev2ImageUrl}
        />
      )}

      {/* Ambient floating success/error slide alerts */}
      <AnimatePresence>
        {notification && (
          <div 
            dir={isRtl ? "rtl" : "ltr"}
            className={`fixed bottom-6 ${isRtl ? "left-6" : "right-6"} z-50 max-w-sm`}
          >
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className={`p-4 rounded-2xl shadow-xl flex items-start gap-3 border ${
                notification.type === "success" 
                  ? "bg-emerald-900 text-emerald-50 border-emerald-800 shadow-emerald-950/10" 
                  : "bg-rose-950 text-rose-50 border-rose-900 shadow-rose-950/10"
              }`}
            >
              {notification.type === "success" ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <p className="text-xs font-extrabold">
                  {notification.type === "success" ? (isRtl ? "تمت العملية بنجاح!" : "Action Success") : (isRtl ? "حدث خطأ" : "Error Occurred")}
                </p>
                <p className="text-[11px] mt-0.5 text-white/90 leading-relaxed font-semibold">
                  {notification.text}
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
