import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

const PORT = 3000;
const DB_PATH = path.join(process.cwd(), "data", "tournament.json");

// Ensure data directory exists
if (!fs.existsSync(path.dirname(DB_PATH))) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

// Initial default data if none exists
const defaultData = {
  players: [
    {
      id: "player_1",
      nameAr: "يوسف البلايلي",
      nameEn: "Youcef Belaïli",
      imageUrl: "", // Handled beautifully in UI using nice sporty color cards
      votes: 140
    },
    {
      id: "player_2",
      nameAr: "رياض محرز",
      nameEn: "Riyad Mahrez",
      imageUrl: "",
      votes: 185
    },
    {
      id: "player_3",
      nameAr: "بغداد بونجاح",
      nameEn: "Baghdad Bounedjah",
      imageUrl: "",
      votes: 95
    },
    {
      id: "player_4",
      nameAr: "إسماعيل بن ناصر",
      nameEn: "Ismaël Bennacer",
      imageUrl: "",
      votes: 120
    }
  ],
  votes: [
    // Pre-populate some anonymous votes so initial percentages look realistic
  ],
  settings: {
    isVotingPaused: false,
    adminPasscode: "1234", // Default pincode for simple admin login, changeable in panel
    strictIpCheck: false,
    tournamentNameAr: "تصويت نجم البطولة",
    tournamentNameEn: "Tournament MVP Vote",
    tournamentLogoUrl: "",
    dev1NameAr: "المبرمج الأول",
    dev1NameEn: "Developer 1",
    dev1ImageUrl: "",
    dev2NameAr: "المبرمج الثاني",
    dev2NameEn: "Developer 2",
    dev2ImageUrl: ""
  }
};

// Seed database if it doesn't exist
function loadDB() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(defaultData, null, 2), "utf-8");
    return defaultData;
  }
  try {
    const raw = fs.readFileSync(DB_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    
    // Graceful backward-compatible migration for existing data
    if (!parsed.settings) parsed.settings = {};
    if (!parsed.settings.tournamentNameAr) {
      parsed.settings.tournamentNameAr = "تصويت نجم البطولة";
    }
    if (!parsed.settings.tournamentNameEn) {
      parsed.settings.tournamentNameEn = "Tournament MVP Vote";
    }
    if (parsed.settings.tournamentLogoUrl === undefined) {
      parsed.settings.tournamentLogoUrl = "";
    }
    if (parsed.settings.dev1NameAr === undefined) {
      parsed.settings.dev1NameAr = "المبرمج الأول";
    }
    if (parsed.settings.dev1NameEn === undefined) {
      parsed.settings.dev1NameEn = "Developer 1";
    }
    if (parsed.settings.dev1ImageUrl === undefined) {
      parsed.settings.dev1ImageUrl = "";
    }
    if (parsed.settings.dev2NameAr === undefined) {
      parsed.settings.dev2NameAr = "المبرمج الثاني";
    }
    if (parsed.settings.dev2NameEn === undefined) {
      parsed.settings.dev2NameEn = "Developer 2";
    }
    if (parsed.settings.dev2ImageUrl === undefined) {
      parsed.settings.dev2ImageUrl = "";
    }
    return parsed;
  } catch (e) {
    console.error("Error reading database file, resetting to defaults", e);
    return defaultData;
  }
}

function saveDB(data: any) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
}

async function startServer() {
  const app = express();

  // Allow larger payloads for Base64 image transfers
  app.use(express.json({ limit: "15mb" }));

  // API: Get Tournament State
  app.get("/api/tournament", (req, res) => {
    const dbData = loadDB();
    // Map players to calculate percentage and total votes
    const totalVotes = dbData.players.reduce((sum: number, p: any) => sum + (p.votes || 0), 0);
    const playersWithPercentage = dbData.players.map((p: any) => ({
      ...p,
      percentage: totalVotes > 0 ? Math.round(((p.votes || 0) / totalVotes) * 100) : 0
    }));

    res.json({
      players: playersWithPercentage,
      totalVotes,
      isVotingPaused: dbData.settings.isVotingPaused,
      tournamentNameAr: dbData.settings.tournamentNameAr,
      tournamentNameEn: dbData.settings.tournamentNameEn,
      tournamentLogoUrl: dbData.settings.tournamentLogoUrl,
      strictIpCheck: dbData.settings.strictIpCheck,
      dev1NameAr: dbData.settings.dev1NameAr,
      dev1NameEn: dbData.settings.dev1NameEn,
      dev1ImageUrl: dbData.settings.dev1ImageUrl,
      dev2NameAr: dbData.settings.dev2NameAr,
      dev2NameEn: dbData.settings.dev2NameEn,
      dev2ImageUrl: dbData.settings.dev2ImageUrl
    });
  });

  // API: Check if specific Voter UUID has already voted
  app.get("/api/voter-status/:uuid", (req, res) => {
    const voterUuid = req.params.uuid;
    const dbData = loadDB();
    
    // Check local server vote records
    const existingVote = dbData.votes.find((v: any) => v.voterUuid === voterUuid);
    
    // Also optional IP check if configured
    let ipAlreadyVoted = false;
    const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";
    const ipString = Array.isArray(clientIp) ? clientIp[0] : clientIp;

    if (dbData.settings.strictIpCheck) {
      ipAlreadyVoted = dbData.votes.some((v: any) => v.ip === ipString);
    }

    if (existingVote) {
      res.json({ voted: true, playerId: existingVote.playerId });
    } else if (ipAlreadyVoted) {
      res.json({ voted: true, ipRestricted: true });
    } else {
      res.json({ voted: false });
    }
  });

  // API: Vote for a Player
  app.post("/api/vote", (req, res) => {
    const { playerId, voterUuid } = req.body;
    
    if (!playerId || !voterUuid) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const dbData = loadDB();

    // Check if voting is paused
    if (dbData.settings.isVotingPaused) {
      return res.status(400).json({ error: "Voting is currently paused / التصويت متوقف حالياً" });
    }

    // Check if player exists
    const playerIndex = dbData.players.findIndex((p: any) => p.id === playerId);
    if (playerIndex === -1) {
      return res.status(404).json({ error: "Player not found / اللاعب غير موجود" });
    }

    // Verify Voter UUID hasn't already voted
    const existingVote = dbData.votes.find((v: any) => v.voterUuid === voterUuid);
    if (existingVote) {
      return res.status(400).json({ error: "You have already voted! / لقد قمت بالتصويت بالفعل!" });
    }

    // Verify IP hasn't already voted if strict IP check is enabled
    const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";
    const ipString = Array.isArray(clientIp) ? clientIp[0] : clientIp;

    if (dbData.settings.strictIpCheck) {
      const ipAlreadyVoted = dbData.votes.some((v: any) => v.ip === ipString);
      if (ipAlreadyVoted) {
        return res.status(400).json({ error: "Another vote has been submitted from your network connection / تم إرسال تصويت آخر من اتصال الشبكة الخاص بك" });
      }
    }

    // Record Vote
    dbData.votes.push({
      voterUuid,
      ip: ipString,
      playerId,
      votedAt: new Date().toISOString()
    });

    // Increment player votes
    dbData.players[playerIndex].votes = (dbData.players[playerIndex].votes || 0) + 1;

    saveDB(dbData);

    res.json({ success: true, message: "Vote cast successfully!" });
  });

  // API: Admin Verify Passcode
  app.post("/api/admin/login", (req, res) => {
    const { passcode } = req.body;
    const dbData = loadDB();

    if (passcode === dbData.settings.adminPasscode) {
      return res.json({ success: true });
    }
    return res.status(401).json({ error: "Incorrect passcode / رمز المرور غير صحيح" });
  });

  // Helper middleware for custom authentication in API
  const verifyAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const adminPasscodeHeader = req.headers["x-admin-passcode"];
    const dbData = loadDB();
    if (adminPasscodeHeader === dbData.settings.adminPasscode) {
      return next();
    }
    return res.status(401).json({ error: "Unauthorized access" });
  };

  // API: Admin Add Player
  app.post("/api/admin/players", verifyAdmin, (req, res) => {
    const { nameAr, nameEn, imageUrl } = req.body;
    if (!nameAr || !nameEn) {
      return res.status(400).json({ error: "Names in Arabic and English are required" });
    }

    const dbData = loadDB();
    const newPlayer = {
      id: "player_" + Date.now(),
      nameAr,
      nameEn,
      imageUrl: imageUrl || "",
      votes: 0
    };

    dbData.players.push(newPlayer);
    saveDB(dbData);

    res.status(201).json({ success: true, player: newPlayer });
  });

  // API: Admin Edit Player
  app.put("/api/admin/players/:id", verifyAdmin, (req, res) => {
    const playerId = req.params.id;
    const { nameAr, nameEn, imageUrl } = req.body;

    const dbData = loadDB();
    const playerIndex = dbData.players.findIndex((p: any) => p.id === playerId);

    if (playerIndex === -1) {
      return res.status(404).json({ error: "Player not found" });
    }

    dbData.players[playerIndex].nameAr = nameAr || dbData.players[playerIndex].nameAr;
    dbData.players[playerIndex].nameEn = nameEn || dbData.players[playerIndex].nameEn;
    if (imageUrl !== undefined) {
      dbData.players[playerIndex].imageUrl = imageUrl;
    }

    saveDB(dbData);
    res.json({ success: true, player: dbData.players[playerIndex] });
  });

  // API: Admin Delete Player
  app.delete("/api/admin/players/:id", verifyAdmin, (req, res) => {
    const playerId = req.params.id;
    const dbData = loadDB();
    
    const filterPlayers = dbData.players.filter((p: any) => p.id !== playerId);
    if (filterPlayers.length === dbData.players.length) {
      return res.status(404).json({ error: "Player not found" });
    }

    // Clean up associated votes so percentage updates correctly
    dbData.votes = dbData.votes.filter((v: any) => v.playerId !== playerId);
    dbData.players = filterPlayers;
    
    saveDB(dbData);
    res.json({ success: true });
  });

  // API: Admin Save General Settings (Pause/Resume/Strict Verification Toggle)
  app.post("/api/admin/settings", verifyAdmin, (req, res) => {
    const { 
      isVotingPaused, 
      strictIpCheck, 
      tournamentNameAr, 
      tournamentNameEn, 
      tournamentLogoUrl,
      dev1NameAr,
      dev1NameEn,
      dev1ImageUrl,
      dev2NameAr,
      dev2NameEn,
      dev2ImageUrl
    } = req.body;
    const dbData = loadDB();

    if (isVotingPaused !== undefined) {
      dbData.settings.isVotingPaused = isVotingPaused;
    }
    if (strictIpCheck !== undefined) {
      dbData.settings.strictIpCheck = strictIpCheck;
    }
    if (tournamentNameAr !== undefined) {
      dbData.settings.tournamentNameAr = tournamentNameAr;
    }
    if (tournamentNameEn !== undefined) {
      dbData.settings.tournamentNameEn = tournamentNameEn;
    }
    if (tournamentLogoUrl !== undefined) {
      dbData.settings.tournamentLogoUrl = tournamentLogoUrl;
    }
    if (dev1NameAr !== undefined) {
      dbData.settings.dev1NameAr = dev1NameAr;
    }
    if (dev1NameEn !== undefined) {
      dbData.settings.dev1NameEn = dev1NameEn;
    }
    if (dev1ImageUrl !== undefined) {
      dbData.settings.dev1ImageUrl = dev1ImageUrl;
    }
    if (dev2NameAr !== undefined) {
      dbData.settings.dev2NameAr = dev2NameAr;
    }
    if (dev2NameEn !== undefined) {
      dbData.settings.dev2NameEn = dev2NameEn;
    }
    if (dev2ImageUrl !== undefined) {
      dbData.settings.dev2ImageUrl = dev2ImageUrl;
    }

    saveDB(dbData);
    res.json({ success: true, settings: dbData.settings });
  });

  // API: Admin Reset Votes (Keep players, clear all votes to 0)
  app.post("/api/admin/reset", verifyAdmin, (req, res) => {
    const dbData = loadDB();
    
    dbData.votes = [];
    dbData.players = dbData.players.map((p: any) => ({
      ...p,
      votes: 0
    }));

    saveDB(dbData);
    res.json({ success: true, message: "Tournament votes have been reset" });
  });

  // API: Admin Change Passcode
  app.post("/api/admin/change-passcode", verifyAdmin, (req, res) => {
    const { newPasscode } = req.body;
    if (!newPasscode || newPasscode.trim().length === 0) {
      return res.status(400).json({ error: "New passcode cannot be empty" });
    }

    const dbData = loadDB();
    dbData.settings.adminPasscode = String(newPasscode).trim();
    saveDB(dbData);

    res.json({ success: true, message: "Passcode updated successfully" });
  });

  // Vite integration middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // Serve index.html for index and client routes
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Tournament Voting Server listening on http://localhost:${PORT}`);
  });
}

startServer();
