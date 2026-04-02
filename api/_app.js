var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/_core/password.ts
var password_exports = {};
__export(password_exports, {
  hashPassword: () => hashPassword,
  verifyPassword: () => verifyPassword
});
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = randomBytes(16).toString("hex");
    scrypt(password, salt, KEY_LENGTH, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`${salt}:${derivedKey.toString("hex")}`);
    });
  });
}
function verifyPassword(password, storedHash) {
  return new Promise((resolve, reject) => {
    const [salt, hash] = storedHash.split(":");
    if (!salt || !hash) return resolve(false);
    scrypt(password, salt, KEY_LENGTH, (err, derivedKey) => {
      if (err) return reject(err);
      const hashBuffer = Buffer.from(hash, "hex");
      resolve(timingSafeEqual(hashBuffer, derivedKey));
    });
  });
}
var KEY_LENGTH;
var init_password = __esm({
  "server/_core/password.ts"() {
    "use strict";
    KEY_LENGTH = 64;
  }
});

// server/_core/app.ts
import "dotenv/config";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

// server/db.ts
import postgres from "postgres";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand
} from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? ""
};

// server/db.ts
var useSupabase = !!process.env.SUPABASE_URL;
var pgClient = null;
function getPostgres() {
  if (pgClient) return pgClient;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  pgClient = postgres(url);
  return pgClient;
}
var s3Client = null;
function getS3() {
  if (s3Client) return s3Client;
  const endpoint = process.env.S3_ENDPOINT;
  const region = process.env.S3_REGION || "us-east-1";
  const accessKey = process.env.S3_ACCESS_KEY || "";
  const secretKey = process.env.S3_SECRET_KEY || "";
  s3Client = new S3Client({
    endpoint,
    region,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    forcePathStyle: true
  });
  return s3Client;
}
var S3_BUCKET = process.env.S3_BUCKET || "files";
var supabase = null;
function getSupabase() {
  if (supabase) return supabase;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  supabase = createClient(url, key);
  return supabase;
}
async function upsertUser(user) {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const role = user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user");
  const now = (/* @__PURE__ */ new Date()).toISOString();
  if (useSupabase) {
    const db = getSupabase();
    const { data: existing } = await db.from("users").select("*").eq("openId", user.openId).maybeSingle();
    if (!existing) {
      await db.from("users").insert({
        openId: user.openId,
        name: user.name ?? null,
        email: user.email ?? null,
        loginMethod: user.loginMethod ?? null,
        role,
        createdAt: now,
        updatedAt: now,
        lastSignedIn: now
      });
      return;
    }
    const updateData = {
      role,
      lastSignedIn: user.lastSignedIn ? new Date(user.lastSignedIn).toISOString() : existing.lastSignedIn,
      updatedAt: now
    };
    if (user.name !== void 0) updateData.name = user.name ?? null;
    if (user.email !== void 0) updateData.email = user.email ?? null;
    if (user.loginMethod !== void 0)
      updateData.loginMethod = user.loginMethod ?? null;
    await db.from("users").update(updateData).eq("openId", user.openId);
  } else {
    const sql = getPostgres();
    const existing = await sql`SELECT * FROM users WHERE "openId" = ${user.openId}`.then(
      (r) => r[0] ?? null
    );
    if (!existing) {
      await sql`INSERT INTO users ("openId", name, email, "loginMethod", role, "createdAt", "updatedAt", "lastSignedIn")
        VALUES (${user.openId}, ${user.name ?? null}, ${user.email ?? null}, ${user.loginMethod ?? null}, ${role}, ${now}, ${now}, ${now})`;
      return;
    }
    const lastSignedIn = user.lastSignedIn ? new Date(user.lastSignedIn).toISOString() : existing.lastSignedIn;
    await sql`UPDATE users SET role = ${role}, "lastSignedIn" = ${lastSignedIn}, "updatedAt" = ${now}
      ${user.name !== void 0 ? sql`, name = ${user.name ?? null}` : sql``}
      ${user.email !== void 0 ? sql`, email = ${user.email ?? null}` : sql``}
      ${user.loginMethod !== void 0 ? sql`, "loginMethod" = ${user.loginMethod ?? null}` : sql``}
      WHERE "openId" = ${user.openId}`;
  }
}
async function getUserByOpenId(openId) {
  if (useSupabase) {
    const db = getSupabase();
    const { data, error } = await db.from("users").select("*").eq("openId", openId).maybeSingle();
    if (error) throw error;
    return data ?? void 0;
  } else {
    const sql = getPostgres();
    const rows = await sql`SELECT * FROM users WHERE "openId" = ${openId}`;
    return rows[0] ?? void 0;
  }
}
async function findUserByEmail(email) {
  if (useSupabase) {
    const db = getSupabase();
    const { data, error } = await db.from("users").select("*").eq("email", email).maybeSingle();
    if (error) throw error;
    return data ?? null;
  } else {
    const sql = getPostgres();
    const rows = await sql`SELECT * FROM users WHERE email = ${email}`;
    return rows[0] ?? null;
  }
}
async function createUserWithPassword(data) {
  const existing = await findUserByEmail(data.email);
  if (existing) throw new Error("User with this email already exists");
  const { hashPassword: hashPassword2 } = await Promise.resolve().then(() => (init_password(), password_exports));
  const hashedPassword = await hashPassword2(data.password);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  if (useSupabase) {
    const db = getSupabase();
    const { data: newUser, error } = await db.from("users").insert({
      openId: `email:${data.email}`,
      name: data.name,
      email: data.email,
      password: hashedPassword,
      loginMethod: "email",
      role: "user",
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now
    }).select().single();
    if (error) throw error;
    return newUser;
  } else {
    const sql = getPostgres();
    const rows = await sql`INSERT INTO users ("openId", name, email, password, "loginMethod", role, "createdAt", "updatedAt", "lastSignedIn")
      VALUES (${`email:${data.email}`}, ${data.name}, ${data.email}, ${hashedPassword}, ${"email"}, ${"user"}, ${now}, ${now}, ${now})
      RETURNING *`;
    return rows[0];
  }
}
async function createFile(file) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  if (useSupabase) {
    const db = getSupabase();
    const { data, error } = await db.from("files").insert({
      userId: file.userId,
      originalName: file.originalName,
      fileName: file.fileName,
      fileType: file.fileType,
      fileSize: file.fileSize,
      filePath: file.filePath,
      uploadedAt: file.uploadedAt ? new Date(file.uploadedAt).toISOString() : now,
      createdAt: now,
      updatedAt: now
    }).select().single();
    if (error) throw error;
    return data;
  } else {
    const sql = getPostgres();
    const uploadedAt = file.uploadedAt ? new Date(file.uploadedAt).toISOString() : now;
    const rows = await sql`INSERT INTO files ("userId", "originalName", "fileName", "fileType", "fileSize", "filePath", "uploadedAt", "createdAt", "updatedAt")
      VALUES (${file.userId}, ${file.originalName}, ${file.fileName}, ${file.fileType}, ${file.fileSize}, ${file.filePath}, ${uploadedAt}, ${now}, ${now})
      RETURNING *`;
    return rows[0];
  }
}
async function getFilesByUserId(userId) {
  if (useSupabase) {
    const db = getSupabase();
    const { data, error } = await db.from("files").select("*").eq("userId", userId);
    if (error) throw error;
    return data ?? [];
  } else {
    const sql = getPostgres();
    return await sql`SELECT * FROM files WHERE "userId" = ${userId}`;
  }
}
async function getFileById(fileId, userId) {
  if (useSupabase) {
    const db = getSupabase();
    const { data, error } = await db.from("files").select("*").eq("id", fileId).eq("userId", userId).maybeSingle();
    if (error) throw error;
    return data ?? null;
  } else {
    const sql = getPostgres();
    const rows = await sql`SELECT * FROM files WHERE id = ${fileId} AND "userId" = ${userId}`;
    return rows[0] ?? null;
  }
}
async function deleteFile(fileId, userId) {
  if (useSupabase) {
    const db = getSupabase();
    const { error } = await db.from("files").delete().eq("id", fileId).eq("userId", userId);
    if (error) throw error;
  } else {
    const sql = getPostgres();
    await sql`DELETE FROM files WHERE id = ${fileId} AND "userId" = ${userId}`;
  }
  return { success: true };
}
async function searchFiles(userId, query) {
  if (useSupabase) {
    const db = getSupabase();
    const { data, error } = await db.from("files").select("*").eq("userId", userId).ilike("originalName", `%${query}%`);
    if (error) throw error;
    return data ?? [];
  } else {
    const sql = getPostgres();
    return await sql`SELECT * FROM files WHERE "userId" = ${userId} AND "originalName" ILIKE ${"%" + query + "%"}`;
  }
}
async function filterFilesByType(userId, fileType) {
  if (useSupabase) {
    const db = getSupabase();
    const { data, error } = await db.from("files").select("*").eq("userId", userId).eq("fileType", fileType);
    if (error) throw error;
    return data ?? [];
  } else {
    const sql = getPostgres();
    return await sql`SELECT * FROM files WHERE "userId" = ${userId} AND "fileType" = ${fileType}`;
  }
}
var STORAGE_BUCKET = "files";
async function uploadToStorage(filePath, fileBuffer, contentType) {
  if (useSupabase) {
    const db = getSupabase();
    const { error } = await db.storage.from(STORAGE_BUCKET).upload(filePath, fileBuffer, { contentType, upsert: false });
    if (error) throw error;
  } else {
    const s3 = getS3();
    await s3.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: filePath,
        Body: fileBuffer,
        ContentType: contentType
      })
    );
  }
  return filePath;
}
async function downloadFromStorage(filePath) {
  if (useSupabase) {
    const db = getSupabase();
    const { data, error } = await db.storage.from(STORAGE_BUCKET).download(filePath);
    if (error) throw error;
    return Buffer.from(await data.arrayBuffer());
  } else {
    const s3 = getS3();
    const { Body } = await s3.send(
      new GetObjectCommand({ Bucket: S3_BUCKET, Key: filePath })
    );
    return Buffer.from(await Body.transformToByteArray());
  }
}
async function deleteFromStorage(filePath) {
  if (useSupabase) {
    const db = getSupabase();
    const { error } = await db.storage.from(STORAGE_BUCKET).remove([filePath]);
    if (error) throw error;
  } else {
    const s3 = getS3();
    await s3.send(
      new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: filePath })
    );
  }
}

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  const secure = isSecureRequest(req);
  return {
    httpOnly: true,
    path: "/",
    sameSite: secure ? "none" : "lax",
    secure
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    const redirectUri = atob(state);
    return redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookieHeader = req.headers.cookie;
    const cookies = this.parseCookies(cookieHeader);
    const sessionCookie = cookies.get(COOKIE_NAME);
    if (sessionCookie) {
      const session = await this.verifySession(sessionCookie);
      if (session) {
        const user = await getUserByOpenId(session.openId);
        if (user) {
          return user;
        }
      }
    }
    throw ForbiddenError("Not authenticated");
  }
};
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app) {
  app.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/routers.ts
init_password();
import { z as z2 } from "zod";
import { TRPCError as TRPCError3 } from "@trpc/server";
import { nanoid } from "nanoid";
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true
      };
    }),
    signup: publicProcedure.input(
      z2.object({
        name: z2.string().min(1, "Name is required"),
        email: z2.string().email("Invalid email address"),
        password: z2.string().min(6, "Password must be at least 6 characters")
      })
    ).mutation(async ({ ctx, input }) => {
      try {
        const existingUser = await findUserByEmail(input.email);
        if (existingUser) {
          throw new TRPCError3({
            code: "CONFLICT",
            message: "A user with this email already exists"
          });
        }
        const user = await createUserWithPassword({
          name: input.name,
          email: input.email,
          password: input.password
        });
        const sessionToken = await sdk.createSessionToken(user.openId, {
          name: user.name || input.name,
          expiresInMs: ONE_YEAR_MS
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS
        });
        return {
          success: true,
          user: { id: user.id, name: user.name, email: user.email }
        };
      } catch (error) {
        if (error instanceof TRPCError3) throw error;
        console.error("Signup error:", error);
        throw new TRPCError3({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create account"
        });
      }
    }),
    login: publicProcedure.input(
      z2.object({
        email: z2.string().email("Invalid email address"),
        password: z2.string().min(1, "Password is required")
      })
    ).mutation(async ({ ctx, input }) => {
      try {
        const user = await findUserByEmail(input.email);
        if (!user || !user.password) {
          throw new TRPCError3({
            code: "UNAUTHORIZED",
            message: "Invalid email or password"
          });
        }
        const isValid = await verifyPassword(input.password, user.password);
        if (!isValid) {
          throw new TRPCError3({
            code: "UNAUTHORIZED",
            message: "Invalid email or password"
          });
        }
        await upsertUser({
          openId: user.openId,
          lastSignedIn: /* @__PURE__ */ new Date()
        });
        const sessionToken = await sdk.createSessionToken(user.openId, {
          name: user.name || "",
          expiresInMs: ONE_YEAR_MS
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS
        });
        return {
          success: true,
          user: { id: user.id, name: user.name, email: user.email }
        };
      } catch (error) {
        if (error instanceof TRPCError3) throw error;
        console.error("Login error:", error);
        throw new TRPCError3({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to login"
        });
      }
    })
  }),
  files: router({
    list: protectedProcedure.query(({ ctx }) => getFilesByUserId(ctx.user.id)),
    upload: protectedProcedure.input(
      z2.object({
        fileName: z2.string(),
        fileType: z2.string(),
        fileSize: z2.number(),
        fileData: z2.string()
      })
    ).mutation(async ({ ctx, input }) => {
      try {
        const uniqueFileName = `${nanoid()}-${input.fileName}`;
        const storagePath = `user-${ctx.user.id}/${uniqueFileName}`;
        const buffer = Buffer.from(input.fileData, "base64");
        await uploadToStorage(storagePath, buffer, input.fileType);
        const file = await createFile({
          userId: ctx.user.id,
          originalName: input.fileName,
          fileName: uniqueFileName,
          fileType: input.fileType,
          fileSize: input.fileSize,
          filePath: storagePath,
          uploadedAt: /* @__PURE__ */ new Date()
        });
        return { success: true, file };
      } catch (error) {
        console.error("File upload error:", error);
        throw new TRPCError3({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to upload file"
        });
      }
    }),
    download: protectedProcedure.input(z2.object({ fileId: z2.number() })).query(async ({ ctx, input }) => {
      try {
        const file = await getFileById(input.fileId, ctx.user.id);
        if (!file) {
          throw new TRPCError3({
            code: "NOT_FOUND",
            message: "File not found"
          });
        }
        const fileBuffer = await downloadFromStorage(file.filePath);
        return {
          fileName: file.originalName,
          fileData: fileBuffer.toString("base64"),
          fileType: file.fileType
        };
      } catch (error) {
        console.error("File download error:", error);
        throw new TRPCError3({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to download file"
        });
      }
    }),
    delete: protectedProcedure.input(z2.object({ fileId: z2.number() })).mutation(async ({ ctx, input }) => {
      try {
        const file = await getFileById(input.fileId, ctx.user.id);
        if (!file) {
          throw new TRPCError3({
            code: "NOT_FOUND",
            message: "File not found"
          });
        }
        try {
          await deleteFromStorage(file.filePath);
        } catch (err) {
          console.warn("Failed to delete file from storage:", err);
        }
        await deleteFile(input.fileId, ctx.user.id);
        return { success: true };
      } catch (error) {
        console.error("File delete error:", error);
        throw new TRPCError3({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete file"
        });
      }
    }),
    search: protectedProcedure.input(z2.object({ query: z2.string() })).query(({ ctx, input }) => searchFiles(ctx.user.id, input.query)),
    filterByType: protectedProcedure.input(z2.object({ fileType: z2.string() })).query(
      ({ ctx, input }) => filterFilesByType(ctx.user.id, input.fileType)
    )
  })
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/app.ts
function createApp() {
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerOAuthRoutes(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  return app;
}
export {
  createApp
};
