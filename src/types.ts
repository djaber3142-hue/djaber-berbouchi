export interface Player {
  id: string;
  nameAr: string;
  nameEn: string;
  imageUrl: string; // Base64 or standard URL
  votes: number;
  percentage?: number;
}

export interface TournamentState {
  players: Player[];
  totalVotes: number;
  isVotingPaused: boolean;
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

export type Language = "ar" | "en";
