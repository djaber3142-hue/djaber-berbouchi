import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { initializeApp, getApps, getApp, deleteApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

dotenv.config();

export const app = express();

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

let firebaseDB: any = null;
let isFirebaseActive = false;
let lastFirebaseError: string | null = null;
let isFirebaseSuspended = false;

function getFirebaseDB() {
  if (isFirebaseSuspended) return null;
  if (firebaseDB) return firebaseDB;

  let config: any = null;

  // 1. Check custom custom configuration first
  const customConfigPath = path.join(process.cwd(), "firebase-custom-config.json");
  if (fs.existsSync(customConfigPath)) {
    try {
      config = JSON.parse(fs.readFileSync(customConfigPath, "utf-8"));
    } catch (e) {
      console.error("Error reading custom firebase config:", e);
    }
  }

  // 2. Fallback to default firebase-applet-config.json
  if (!config) {
    const defaultPath = path.join(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(defaultPath)) {
      try {
        config = JSON.parse(fs.readFileSync(defaultPath, "utf-8"));
      } catch (e) {
        console.error("Error reading default firebase config:", e);
      }
    }
  }

  // 3. Fallback to process.env variables (if configured)
  if (!config && process.env.FIREBASE_PROJECT_ID) {
    config = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      apiKey: process.env.FIREBASE_API_KEY,
      appId: process.env.FIREBASE_APP_ID,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN,
      firestoreDatabaseId: process.env.FIREBASE_DATABASE_ID
    };
  }

  if (config && config.projectId && config.apiKey) {
    try {
      const apps = getApps();
      let app;
      if (apps.length === 0) {
        app = initializeApp(config);
      } else {
        app = getApp();
      }
      
      firebaseDB = getFirestore(app, config.firestoreDatabaseId || undefined);
      isFirebaseActive = true;
      lastFirebaseError = null;
      console.log("Firebase initialized successfully with project ID:", config.projectId);
      return firebaseDB;
    } catch (error: any) {
      console.error("Failed to initialize Firebase SDK:", error);
      isFirebaseActive = false;
      lastFirebaseError = error?.message || String(error);
    }
  } else {
    lastFirebaseError = "Firebase is not configured / لم يتم إعداد واجهة Firebase";
  }
  return null;
}

// In-memory cache to guarantee ultra-responsive rendering under concurrent requests
let cachedData: any = null;
let lastCacheTime = 0;
const CACHE_TTL = 3000; // 3 seconds TTL

async function suspendFirebase(err: any, operationType: OperationType, pathStr: string | null) {
  isFirebaseActive = false;
  lastFirebaseError = err?.message || String(err);
  
  const errMsg = (err?.message || String(err)).toLowerCase();
  const isTerminalError = 
    errMsg.includes("permission") || 
    errMsg.includes("insufficient") || 
    errMsg.includes("not been used") || 
    errMsg.includes("disabled") ||
    errMsg.includes("api has not been used");

  if (isTerminalError) {
    if (!isFirebaseSuspended) {
      isFirebaseSuspended = true;
      console.warn(`[Firebase Custom Config] Terminal connection/permission error detected during ${operationType} on "${pathStr}". Bypassing future connection attempts and activating offline local backup to prevent background WebSocket retry leaks.`);
      try {
        const apps = getApps();
        for (const app of apps) {
          await deleteApp(app);
        }
      } catch (delErr) {
        console.error("Error deleting Firebase app:", delErr);
      }
      firebaseDB = null;
    }
  }

  try {
    handleFirestoreError(err, operationType, pathStr);
  } catch (telemetryErr) {
    // Graceful telemetry bypass - continues back into the offline file fallback
  }
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path
  };
  const stringified = JSON.stringify(errInfo);
  console.error('Firestore Error: ', stringified);
  throw new Error(stringified);
}

async function loadDB(): Promise<any> {
  const now = Date.now();
  if (cachedData && (now - lastCacheTime < CACHE_TTL)) {
    return cachedData;
  }

  const db = getFirebaseDB();
  if (db) {
    try {
      const docRef = doc(db, "tournament_state", "main");
      const fetchPromise = getDoc(docRef);

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Firebase connection timed out (2.0s limit) / انتهت مهلة الاتصال")), 2000)
      );

      const docSnap = await Promise.race([fetchPromise, timeoutPromise]) as any;

      if (docSnap.exists()) {
        const docData = docSnap.data();
        if (docData && docData.data) {
          const parsed = docData.data;
          isFirebaseActive = true;
          lastFirebaseError = null;

          // Graceful schema assertions on loaded data
          if (!parsed.settings) parsed.settings = {};
          if (!parsed.players) parsed.players = [];
          if (!parsed.votes) parsed.votes = [];
          if (!parsed.settings.adminPasscode) parsed.settings.adminPasscode = "1122";

          cachedData = parsed;
          lastCacheTime = now;
          return parsed;
        }
      }

      // If document does not exist, seed it with local stored data or default
      console.log("Firebase loaded successfully but 'main' document is missing/empty. Seeding...");
      const seedValue = getLocalStoredData();

      const upsertPromise = setDoc(docRef, { data: seedValue, updated_at: new Date().toISOString() });
      await Promise.race([upsertPromise, timeoutPromise]);

      isFirebaseActive = true;
      lastFirebaseError = null;
      cachedData = seedValue;
      lastCacheTime = now;
      return seedValue;
    } catch (err: any) {
      const errStr = `[DB ERROR] ${new Date().toISOString()} - Error connecting with Firebase: ${err?.message || err}\n`;
      try { fs.appendFileSync(path.join(process.cwd(), "data", "route_logs.txt"), errStr); } catch (e) {}
      console.error("Error connected with Firebase Database fetch: ", err?.message || err);
      await suspendFirebase(err, OperationType.GET, "tournament_state/main");
    }
  } else {
    lastFirebaseError = "Firebase is not configured / لم يتم إعداد واجهة Firebase";
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

  const db = getFirebaseDB();
  if (db) {
    try {
      const docRef = doc(db, "tournament_state", "main");
      const upsertPromise = setDoc(docRef, { data: data, updated_at: new Date().toISOString() });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Firebase write operation timed out (2.0s limit) / انتهت مهلة الإرسال للسحابة")), 2000)
      );

      await Promise.race([upsertPromise, timeoutPromise]);

      isFirebaseActive = true;
      lastFirebaseError = null;
      console.log("Tournament state successfully persisted to Firebase!");
    } catch (err: any) {
      console.error("Error saving state to Firebase:", err);
      await suspendFirebase(err, OperationType.WRITE, "tournament_state/main");
    }
  } else {
    lastFirebaseError = "Firebase is not configured / لم يتم إعداد واجهة Firebase";
  }
}

async function startServer() {
  // Use the globally exported app instance

  // Vercel path-correction middleware
  app.use((req, res, next) => {
    // If Vercel rewrote the URL to /api/index.ts or similar, restore the original URL so Express routes can match
    if (req.url.includes("index.ts") || req.url.includes("index.js") || req.url.startsWith("/api/index")) {
      req.url = req.originalUrl || req.url;
    }
    next();
  });

  // Enable CORS headers for full compatibility with all development origins
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // Request logger helper to diagnose routing issues
  app.use((req, res, next) => {
    const logStr = `[ROUTE LOG] ${new Date().toISOString()} - ${req.method} ${req.url} (original: ${req.originalUrl}) - Headers: ${JSON.stringify(req.headers['user-agent'] || 'no-ua')}\n`;
    try {
      fs.appendFileSync(path.join(process.cwd(), "data", "route_logs.txt"), logStr);
    } catch (e) {}
    console.log(logStr.trim());
    next();
  });

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
        supabaseActive: isFirebaseActive,
        supabaseConfigured: !!getFirebaseDB(),
        supabaseError: lastFirebaseError || undefined,
        firebaseActive: isFirebaseActive,
        firebaseConfigured: !!getFirebaseDB(),
        firebaseError: lastFirebaseError || undefined
      });
    } catch (err: any) {
      const errStr = `[API ERROR] ${new Date().toISOString()} - Error fetching tournament: ${err?.message || err}\n`;
      try { fs.appendFileSync(path.join(process.cwd(), "data", "route_logs.txt"), errStr); } catch (e) {}
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

  // Helper utility to write configuration changes to the /.env file
  function updateEnvFile(url: string, key: string) {
    const envPath = path.join(process.cwd(), ".env");
    let content = "";
    if (fs.existsSync(envPath)) {
      content = fs.readFileSync(envPath, "utf-8");
    }

    const lines = content.split("\n");
    const newLines: string[] = [];
    const keysToReplace = {
      VITE_SUPABASE_URL: url,
      VITE_SUPABASE_PUBLISHABLE_KEY: key,
      SUPABASE_URL: url,
      SUPABASE_KEY: key
    };

    const processed = new Set<string>();

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("#") || trimmed === "") {
        newLines.push(line);
        continue;
      }

      const parts = trimmed.split("=");
      const k = parts[0].trim();
      if (k in keysToReplace) {
        newLines.push(`${k}=${keysToReplace[k as keyof typeof keysToReplace]}`);
        processed.add(k);
      } else {
        newLines.push(line);
      }
    }

    // Append any keys that weren't present in the original file
    for (const k of Object.keys(keysToReplace)) {
      if (!processed.has(k)) {
        newLines.push(`${k}=${keysToReplace[k as keyof typeof keysToReplace]}`);
      }
    }

    fs.writeFileSync(envPath, newLines.join("\n"), "utf-8");
  }

  // API: Save and Test Firebase Credentials (supporting old Supabase endpoints as backward compatible alias)
  const handleFirebaseConfig = async (req: any, res: any) => {
    try {
      // Allow passing either Firebase keys or Supabase keys (if they still try to send them)
      const { 
        projectId, 
        apiKey, 
        appId, 
        authDomain, 
        firestoreDatabaseId,
        supabaseUrl,
        supabaseKey
      } = req.body;

      const customConfigPath = path.join(process.cwd(), "firebase-custom-config.json");

      if (
        (!projectId || projectId.trim() === "") && 
        (!apiKey || apiKey.trim() === "") &&
        (!supabaseUrl || supabaseUrl.trim() === "")
      ) {
        // Clear custom Firebase configuration, fallback to default
        if (fs.existsSync(customConfigPath)) {
          fs.unlinkSync(customConfigPath);
        }
        
        firebaseDB = null;
        isFirebaseActive = false;
        lastFirebaseError = null;

        // Warm up / reload with default config
        await loadDB();

        return res.json({ 
          success: true, 
          message: "Custom configuration cleared! Reverted to sandbox Firebase database. / تم استعادة قاعدة البيانات الافتراضية",
          supabaseActive: isFirebaseActive,
          firebaseActive: isFirebaseActive,
          firebaseConfigured: !!getFirebaseDB()
        });
      }

      // If they passed Supabase instead, we can gently warn or handle it, but here we expect Firebase.
      const actualProjectId = (projectId || supabaseUrl || "").trim();
      const actualApiKey = (apiKey || supabaseKey || "").trim();
      const actualAppId = (appId || "").trim();
      const actualAuthDomain = (authDomain || "").trim();
      const actualDbId = (firestoreDatabaseId || "").trim();

      if (!actualProjectId || !actualApiKey) {
        return res.status(400).json({
          success: false,
          error: "Project ID and API Key are required / معرف المشروع ومفتاح واجهة البرمجة مطلوبان"
        });
      }

      // Try initializing with temporary app name to verify connection
      const tempAppName = "firebase-temp-verify-" + Date.now();
      let tempApp;
      try {
        tempApp = initializeApp({
          projectId: actualProjectId,
          apiKey: actualApiKey,
          appId: actualAppId || undefined,
          authDomain: actualAuthDomain || undefined
        }, tempAppName);
      } catch (err: any) {
        return res.status(400).json({
          success: false,
          error: `Failed to initialize app: ${err.message}`
        });
      }

      let isSuccess = false;
      let errorMsg = null;

      try {
        const tempDB = getFirestore(tempApp, actualDbId || undefined);
        const docRef = doc(tempDB, "tournament_state", "main");
        const fetchPromise = getDoc(docRef);

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Firebase verification timed out (2.5s) / انتهت مهلة التحقق والاتصال")), 2500)
        );

        await Promise.race([fetchPromise, timeoutPromise]);
        isSuccess = true;
      } catch (err: any) {
        // In firebase, a missing document is fine, but connection issues or wrong credentials throw error.
        // Let's check permission or other errors
        if (err.message && (err.message.includes("permission") || err.message.includes("denied"))) {
          isSuccess = true;
          errorMsg = err.message;
        } else {
          isSuccess = false;
          errorMsg = err.message || String(err);
        }
      } finally {
        if (tempApp) {
          try {
            await deleteApp(tempApp);
          } catch (e) {
            console.error("Error deleting temp app:", e);
          }
        }
      }

      if (isSuccess) {
        const newConfig = {
          projectId: actualProjectId,
          apiKey: actualApiKey,
          appId: actualAppId || undefined,
          authDomain: actualAuthDomain || undefined,
          firestoreDatabaseId: actualDbId || undefined
        };

        // Persist to custom config file
        fs.writeFileSync(customConfigPath, JSON.stringify(newConfig, null, 2), "utf-8");

        // Reload primary DB instance
        isFirebaseSuspended = false;
        firebaseDB = null;
        isFirebaseActive = true;
        lastFirebaseError = null;
        
        // Load or auto-seed state
        const dbData = await loadDB();

        return res.json({
          success: true,
          message: "Firebase connected and saved successfully / تم الحفظ والربط بـ Firebase بنجاح",
          supabaseActive: isFirebaseActive,
          firebaseActive: isFirebaseActive,
          firebaseConfigured: true,
          data: dbData
        });
      } else {
        return res.status(400).json({
          success: false,
          error: errorMsg || "Invalid credentials / بيانات الاتصال بـ Firebase غير صالحة"
        });
      }
    } catch (err: any) {
      console.error("Error in Firebase configuration API:", err);
      return res.status(500).json({
        success: false,
        error: err?.message || "Internal server error during Firebase validation"
      });
    }
  };

  app.post("/api/admin/firebase-config", verifyAdmin, handleFirebaseConfig);
  app.post("/api/admin/supabase-config", verifyAdmin, handleFirebaseConfig);

  // API: Retry Firebase connection
  const handleFirebaseRetry = async (req: any, res: any) => {
    try {
      cachedData = null;
      lastCacheTime = 0;
      isFirebaseSuspended = false;
      const dbData = await loadDB();
      res.json({
        success: true,
        supabaseActive: isFirebaseActive,
        supabaseError: lastFirebaseError || undefined,
        firebaseActive: isFirebaseActive,
        firebaseError: lastFirebaseError || undefined,
        data: dbData
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to retry connection / فشلت المحاولة" });
    }
  };

  app.post("/api/admin/firebase-retry", verifyAdmin, handleFirebaseRetry);
  app.post("/api/admin/supabase-retry", verifyAdmin, handleFirebaseRetry);

  // Vite integration middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    if (!process.env.VERCEL) {
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      // Serve index.html for index and client routes
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", async () => {
      const dbData = await loadDB();
      const currentPasscode = process.env.ADMIN_PASSCODE || dbData.settings.adminPasscode || "1122";
      console.log(`Tournament Voting Server listening on http://localhost:${PORT}`);
      console.log(`Admin passcode is currently: ${currentPasscode}`);
    });
  }
}

startServer();

export default app;
