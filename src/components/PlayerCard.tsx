import React from "react";
import { Player, Language } from "../types";
import { Award, Check, User, Percent } from "lucide-react";
import { motion } from "motion/react";

interface PlayerCardProps {
  player: Player;
  lang: Language;
  hasVoted: boolean;
  votedPlayerId: string | null;
  onVote: (playerId: string) => void;
  isVotingPaused: boolean;
  t: any;
}

export const PlayerCard: React.FC<PlayerCardProps> = ({
  player,
  lang,
  hasVoted,
  votedPlayerId,
  onVote,
  isVotingPaused,
  t,
}) => {
  const isTargetOfVote = votedPlayerId === player.id;
  const isRtl = lang === "ar";
  const name = isRtl ? player.nameAr : player.nameEn;

  // Render elegant placeholder jersey when no image is loaded
  const renderFallbackAvatar = () => {
    // Generate distinct color combos based on player ID to add variety
    const colors = [
      { bg: "from-emerald-700 to-teal-900", accent: "text-amber-400", shirtNum: "10" },
      { bg: "from-blue-700 to-indigo-900", accent: "text-cyan-300", shirtNum: "7" },
      { bg: "from-red-700 to-rose-900", accent: "text-yellow-300", shirtNum: "9" },
      { bg: "from-purple-700 to-violet-900", accent: "text-pink-300", shirtNum: "11" },
    ];
    const index = (player.id.charCodeAt(player.id.length - 1) || 0) % colors.length;
    const style = colors[index];

    return (
      <div className={`w-full h-56 bg-gradient-to-br ${style.bg} relative overflow-hidden flex flex-col justify-center items-center group-hover:scale-105 transition-transform duration-500`}>
        {/* Stadium lighting overlay effect */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-white/20 via-transparent to-black/40 pointer-events-none" />
        
        {/* Dynamic Sporty Football Jersey Vector Drawing */}
        <div className="relative w-28 h-28 flex justify-center items-center transition-all duration-300 group-hover:rotate-6">
          <svg viewBox="0 0 100 100" className="w-24 h-24 drop-shadow-[0_8px_16px_rgba(0,0,0,0.3)]">
            {/* Jersey Body */}
            <path
              d="M 25 25 L 35 15 L 45 20 L 55 20 L 65 15 L 75 25 L 75 45 L 85 55 L 75 60 L 70 90 L 30 90 L 25 60 L 15 55 L 25 45 Z"
              fill="currentColor"
              className="text-white/10"
            />
            {/* Trim Stripes */}
            <path
              d="M 35 15 L 45 20 L 55 20 L 65 15"
              fill="none"
              stroke="coral"
              strokeWidth="4"
              className={style.accent}
            />
            <path
              d="M 30 90 L 70 90"
              fill="none"
              stroke="coral"
              strokeWidth="3"
              className={style.accent}
            />
            {/* Shirt Stripes Detail */}
            <line x1="42" y1="20" x2="42" y2="90" stroke="white" strokeWidth="2" strokeOpacity="0.2" />
            <line x1="50" y1="20" x2="50" y2="90" stroke="white" strokeWidth="2" strokeOpacity="0.2" />
            <line x1="58" y1="20" x2="58" y2="90" stroke="white" strokeWidth="2" strokeOpacity="0.2" />
          </svg>
          <div className={`absolute top-8 text-center select-none font-bold text-3xl font-mono ${style.accent}`}>
            {style.shirtNum}
          </div>
        </div>

        <div className="absolute bottom-3 left-4 right-4 text-center">
          <span className="text-white/40 text-xs font-mono uppercase tracking-widest">
            {isRtl ? "لاعب مرخص" : "PRO PLAYER"}
          </span>
        </div>
      </div>
    );
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -6 }}
      className={`relative bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 group ${
        isTargetOfVote ? "ring-4 ring-emerald-500/80 border-transparent shadow-emerald-100" : ""
      }`}
    >
      {/* Percentage Spotlight (Leader effect) */}
      {(player.percentage || 0) >= 35 && (
        <div className={`absolute top-4 ${isRtl ? "right-4" : "left-4"} z-30 bg-amber-400 text-amber-950 font-bold text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-md`}>
          <Award className="w-3.5 h-3.5" />
          <span>{isRtl ? "المتصدر" : "Leader"}</span>
        </div>
      )}

      {/* Image / Avatar Display */}
      <div className="relative w-full h-56 bg-slate-100 overflow-hidden border-b border-slate-50">
        {player.imageUrl ? (
          <>
            <img
              src={player.imageUrl}
              alt={name}
              className="w-full h-56 object-cover object-center group-hover:scale-105 transition-transform duration-500"
              referrerPolicy="no-referrer"
            />
            {/* Aesthetic gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-slate-950/20 pointer-events-none" />
          </>
        ) : (
          renderFallbackAvatar()
        )}
      </div>

      {/* Information Container */}
      <div className="p-6">
        <h3 className="text-xl font-bold text-slate-800 tracking-tight leading-snug truncate">
          {name}
        </h3>
        <p className="text-slate-400 text-xs mt-1 font-semibold flex items-center gap-1.5">
          <User className="w-3.5 h-3.5" />
          <span>{isRtl ? "إحصائيات اللاعب الكروي" : "League MVP Nominee"}</span>
        </p>

        {/* Voting Progress Stats (Reveal once voted, or if paused and stats are shown) */}
        <div className="mt-6 space-y-3 bg-slate-50/70 p-4 rounded-2xl border border-slate-100/50">
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-500 font-medium">{isRtl ? "الأصوات" : "Votes"}</span>
            <span className="font-mono font-bold text-slate-800">
              {player.votes}
            </span>
          </div>

          <div className="relative pt-1">
            <div className="flex mb-2 items-center justify-between">
              <span className="text-xs text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-md">
                {isRtl ? "الحصّة" : "Share"}
              </span>
              <div className="text-right">
                <span className="text-sm font-bold text-slate-800 font-mono flex items-center gap-0.5">
                  {player.percentage}%
                  <Percent className="w-3.5 h-3.5 text-slate-400" />
                </span>
              </div>
            </div>
            
            <div className="overflow-hidden h-3 text-xs flex rounded-full bg-slate-200">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${player.percentage || 0}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center transition-all ${
                  isTargetOfVote
                    ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                    : "bg-gradient-to-r from-slate-600 to-slate-400"
                }`}
              />
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="mt-6">
          {isTargetOfVote ? (
            <div className="w-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 shadow-inner">
              <Check className="w-5 h-5 text-emerald-600 animate-bounce" />
              <span>{t.votedLabel}</span>
            </div>
          ) : (
            <button
              onClick={() => onVote(player.id)}
              disabled={hasVoted || isVotingPaused}
              className={`w-full font-bold py-3.5 px-4 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 transform active:scale-98 flex items-center justify-center gap-2 cursor-pointer ${
                hasVoted || isVotingPaused
                  ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed hover:shadow-none"
                  : "bg-gradient-to-r from-slate-900 via-slate-800 to-slate-950 text-white hover:from-emerald-700 hover:to-emerald-600"
              }`}
            >
              {!hasVoted && !isVotingPaused && <Check className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />}
              <span>
                {isVotingPaused
                  ? t.votingClosed
                  : hasVoted
                  ? t.appTitle
                  : t.voteBtn}
              </span>
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};
