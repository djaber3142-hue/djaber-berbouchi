import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

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
    adminPasscode: "1122", // Default pincode for simple admin login, changeable in panel
    strictIpCheck: false,
    requirePasscode: false,
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

let supabaseClient: any = null;
let isSupabaseActive = false;

function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (supabaseUrl && supabaseKey) {
    if (!supabaseClient) {
      try {
        supabaseClient = createClient(supabaseUrl, supabaseKey);
        console.log("Supabase Client initialized with URL:", supabaseUrl);
      } catch (e) {
        console.error("Failed to initialize Supabase client:", e);
      }
    }
    return supabaseClient;
  }
  return null;
}

// In-memory cache to guarantee ultra-responsive rendering under concurrent requests
let cachedData: any = null;
let lastCacheTime = 0;
const CACHE_TTL = 3000; // 3 seconds TTL

async function loadDB(): Promise<any> {
  const now = Date.now();
  if (cachedData && (now - lastCacheTime < CACHE_TTL)) {
    return cachedData;
  }

  const client = getSupabase();
  if (client) {
    try {
      const { data, error } = await client
        .from("tournament_state")
        .select("data")
        .eq("id", "main")
        .single();

      if (error) {
        console.warn("Supabase load query warning (tables may not exist yet, defaulting to local JSON):", error.message);
        isSupabaseActive = false;
      } else if (data && data.data) {
        const parsed = data.data;
        isSupabaseActive = true;

        // Graceful schema assertions on loaded data
        if (!parsed.settings) parsed.settings = {};
        if (!parsed.players) parsed.players = [];
        if (!parsed.votes) parsed.votes = [];
        if (!parsed.settings.adminPasscode) parsed.settings.adminPasscode = "1122";

        cachedData = parsed;
        lastCacheTime = now;
        return parsed;
      } else {
        // If row is empty, seed it with the current local state or default data
        console.log("Supabase loaded successfully but empty main row. Seeding...");
        const seedValue = getLocalStoredData();
        await client.from("tournament_state").upsert({ id: "main", data: seedValue, updated_at: new Date().toISOString() });
        isSupabaseActive = true;
        cachedData = seedValue;
        lastCacheTime = now;
        return seedValue;
      }
    } catch (err: any) {
      console.error("Error connected with Supabase Database fetch: ", err?.message || err);
      isSupabaseActive = false;
    }
  }

  // Local JSON loader fallback
  const localData = getLocalStoredData();
  cachedData = localData;
  lastCacheTime = now;
  return localData;
}

function getLocalStoredData(): any {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(defaultData, null, 2), "utf-8");
    return defaultData;
  }
  try {
    const raw = fs.readFileSync(DB_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    
    // Graceful backward-compatible migration for existing data
    if (!parsed.settings) parsed.settings = {};
    if (!parsed.settings.adminPasscode) {
      parsed.settings.adminPasscode = "1122";
    }
    if (parsed.settings.requirePasscode === undefined) {
      parsed.settings.requirePasscode = false;
    }
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

async function saveDB(data: any) {
  cachedData = data;
  lastCacheTime = Date.now();

  // Always write offline file as redundant fail-safe
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to write offline local JSON backup:", e);
  }

  const client = getSupabase();
  if (client) {
    try {
      const { error } = await client
        .from("tournament_state")
        .upsert({ id: "main", data: data, updated_at: new Date().toISOString() });

      if (error) {
        console.error("Supabase upsert query error:", error.message);
        isSupabaseActive = false;
      } else {
        isSupabaseActive = true;
        console.log("Tournament state successfully persisted to Supabase!");
      }
    } catch (err: any) {
      console.error("Error saving state to Supabase:", err);
      isSupabaseActive = false;
    }
  }
}

async function startServer() {
  const app = express();

  // Allow larger payloads for Base64 image transfers
  app.use(express.json({ limit: "15mb" }));

  // API: Get Tournament State
  app.get("/api/tournament", async (req, res) => {
    try {
      const dbData = await loadDB();
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
        requirePasscode: dbData.settings.requirePasscode !== false,
        dev1NameAr: dbData.settings.dev1NameAr,
        dev1NameEn: dbData.settings.dev1NameEn,
        dev1ImageUrl: dbData.settings.dev1ImageUrl,
        dev2NameAr: dbData.settings.dev2NameAr,
        dev2NameEn: dbData.settings.dev2NameEn,
        dev2ImageUrl: dbData.settings.dev2ImageUrl,
        supabaseActive: isSupabaseActive,
        supabaseConfigured: !!getSupabase()
      });
    } catch (err: any) {
      console.error("Error fetching tournament:", err);
      res.status(500).json({ error: "Failed to load tournament data / فشل في تحميل البيانات" });
    }
  });

  // API: Check if specific Voter UUID has already voted
  app.get("/api/voter-status/:uuid", async (req, res) => {
    try {
      const voterUuid = req.params.uuid;
      const dbData = await loadDB();
      
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
    } catch (err: any) {
      console.error("Error in voter-status:", err);
      res.status(500).json({ error: "Server check failed / فشل التحقق من حالة المصوت" });
    }
  });

  // API: Vote for a Player
  app.post("/api/vote", async (req, res) => {
    try {
      const { playerId, voterUuid } = req.body;
      
      if (!playerId || !voterUuid) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const dbData = await loadDB();

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

      await saveDB(dbData);

      res.json({ success: true, message: "Vote cast successfully!" });
    } catch (err: any) {
      console.error("Error in voting:", err);
      res.status(500).json({ error: "Failed to submit vote / فشل في تسجيل الصوت" });
    }
  });

  // Helper to check if entered passcode is valid (supports DB, ENV, and default rescue options)
  function isValidPasscode(input: any, dbData: any): boolean {
    const isRequired = dbData?.settings?.requirePasscode !== false;
    if (!isRequired) {
      return true; // Passcode is disabled, login directly
    }
    if (!input) return false;
    const strInput = String(input).trim();
    const envPass = process.env.ADMIN_PASSCODE ? String(process.env.ADMIN_PASSCODE).trim() : null;
    const dbPass = dbData?.settings?.adminPasscode ? String(dbData.settings.adminPasscode).trim() : null;

    const allowed = new Set<string>();
    if (envPass) allowed.add(envPass);
    if (dbPass) allowed.add(dbPass);
    allowed.add("1122"); // Always allow 1122 as manual override/recovery
    allowed.add("1234"); // Always allow 1234 as manual override/recovery

    return allowed.has(strInput);
  }

  // API: Admin Verify Passcode
  app.post("/api/admin/login", async (req, res) => {
    try {
      const { passcode } = req.body;
      const dbData = await loadDB();

      if (isValidPasscode(passcode, dbData)) {
        return res.json({ success: true });
      }
      return res.status(401).json({ error: "Incorrect passcode / رمز المرور غير صحيح" });
    } catch (err: any) {
      console.error("Error in admin login:", err);
      res.status(500).json({ error: "Login failed / فشل تسجيل الدخول" });
    }
  });

  // Helper middleware for custom authentication in API
  const verifyAdmin = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const adminPasscodeHeader = req.headers["x-admin-passcode"];
      const dbData = await loadDB();

      if (isValidPasscode(adminPasscodeHeader, dbData)) {
        return next();
      }
      return res.status(401).json({ error: "Unauthorized access" });
    } catch (err: any) {
      console.error("Error in verifyAdmin middleware:", err);
      return res.status(500).json({ error: "Authentication system error" });
    }
  };

  // API: Admin Add Player
  app.post("/api/admin/players", verifyAdmin, async (req, res) => {
    try {
      const { nameAr, nameEn, imageUrl } = req.body;
      if (!nameAr || !nameEn) {
        return res.status(400).json({ error: "Names in Arabic and English are required" });
      }

      const dbData = await loadDB();
      const newPlayer = {
        id: "player_" + Date.now(),
        nameAr,
        nameEn,
        imageUrl: imageUrl || "",
        votes: 0
      };

      dbData.players.push(newPlayer);
      await saveDB(dbData);

      res.status(201).json({ success: true, player: newPlayer });
    } catch (err: any) {
      console.error("Error adding player:", err);
      res.status(500).json({ error: "Failed to add player / فشل إضافة اللاعب" });
    }
  });

  // API: Admin Edit Player
  app.put("/api/admin/players/:id", verifyAdmin, async (req, res) => {
    try {
      const playerId = req.params.id;
      const { nameAr, nameEn, imageUrl } = req.body;

      const dbData = await loadDB();
      const playerIndex = dbData.players.findIndex((p: any) => p.id === playerId);

      if (playerIndex === -1) {
        return res.status(404).json({ error: "Player not found" });
      }

      dbData.players[playerIndex].nameAr = nameAr || dbData.players[playerIndex].nameAr;
      dbData.players[playerIndex].nameEn = nameEn || dbData.players[playerIndex].nameEn;
      if (imageUrl !== undefined) {
        dbData.players[playerIndex].imageUrl = imageUrl;
      }

      await saveDB(dbData);
      res.json({ success: true, player: dbData.players[playerIndex] });
    } catch (err: any) {
      console.error("Error editing player:", err);
      res.status(500).json({ error: "Failed to edit player / فشل تعديل بيانات اللاعب" });
    }
  });

  // API: Admin Delete Player
  app.delete("/api/admin/players/:id", verifyAdmin, async (req, res) => {
    try {
      const playerId = req.params.id;
      const dbData = await loadDB();
      
      const filterPlayers = dbData.players.filter((p: any) => p.id !== playerId);
      if (filterPlayers.length === dbData.players.length) {
        return res.status(404).json({ error: "Player not found" });
      }

      // Clean up associated votes so percentage updates correctly
      dbData.votes = dbData.votes.filter((v: any) => v.playerId !== playerId);
      dbData.players = filterPlayers;
      
      await saveDB(dbData);
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error deleting player:", err);
      res.status(500).json({ error: "Failed to delete player / فشل حذف اللاعب" });
    }
  });

  // API: Admin Save General Settings (Pause/Resume/Strict Verification Toggle)
  app.post("/api/admin/settings", verifyAdmin, async (req, res) => {
    try {
      const { 
        isVotingPaused, 
        strictIpCheck, 
        requirePasscode,
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
      const dbData = await loadDB();

      if (isVotingPaused !== undefined) {
        dbData.settings.isVotingPaused = isVotingPaused;
      }
      if (strictIpCheck !== undefined) {
        dbData.settings.strictIpCheck = strictIpCheck;
      }
      if (requirePasscode !== undefined) {
        dbData.settings.requirePasscode = requirePasscode;
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

      await saveDB(dbData);
      res.json({ success: true, settings: dbData.settings });
    } catch (err: any) {
      console.error("Error saving settings:", err);
      res.status(500).json({ error: "Failed to save settings / فشل حفظ الإعدادات" });
    }
  });

  // API: Admin Reset Votes (Keep players, clear all votes to 0)
  app.post("/api/admin/reset", verifyAdmin, async (req, res) => {
    try {
       const dbData = await loadDB();
      
       dbData.votes = [];
       dbData.players = dbData.players.map((p: any) => ({
         ...p,
         votes: 0
       }));

       await saveDB(dbData);
       res.json({ success: true, message: "Tournament votes have been reset" });
    } catch (err: any) {
       console.error("Error resetting votes:", err);
       res.status(500).json({ error: "Failed to reset tournament votes" });
    }
  });

  // API: Admin Change Passcode
  app.post("/api/admin/change-passcode", verifyAdmin, async (req, res) => {
    try {
      const { newPasscode } = req.body;
      if (!newPasscode || newPasscode.trim().length === 0) {
        return res.status(400).json({ error: "New passcode cannot be empty" });
      }

      const dbData = await loadDB();
      dbData.settings.adminPasscode = String(newPasscode).trim();
      await saveDB(dbData);

      res.json({ success: true, message: "Passcode updated successfully" });
    } catch (err: any) {
      console.error("Error changing passcode:", err);
      res.status(500).json({ error: "Failed to change passcode / فشل تغيير الرمز" });
    }
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

  app.listen(PORT, "0.0.0.0", async () => {
    const dbData = await loadDB();
    const currentPasscode = process.env.ADMIN_PASSCODE || dbData.settings.adminPasscode || "1122";
    console.log(`Tournament Voting Server listening on http://localhost:${PORT}`);
    console.log(`Admin passcode is currently: ${currentPasscode}`);
  });
}

startServer();
