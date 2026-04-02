import postgres from "postgres";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { InsertUser, InsertFile } from "../drizzle/schema";
import { ENV } from "./_core/env";

// ==================== Detect Mode ====================
// SUPABASE_URL set hai → Supabase mode
// DATABASE_URL set hai → PostgreSQL + S3 mode (Docker)

const useSupabase = !!process.env.SUPABASE_URL;

// ==================== PostgreSQL (Docker mode) ====================

let pgClient: ReturnType<typeof postgres> | null = null;

function getPostgres() {
  if (pgClient) return pgClient;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  pgClient = postgres(url);
  return pgClient;
}

// ==================== S3 / MinIO (Docker mode) ====================

let s3Client: S3Client | null = null;

function getS3(): S3Client {
  if (s3Client) return s3Client;

  const endpoint = process.env.S3_ENDPOINT;
  const region = process.env.S3_REGION || "us-east-1";
  const accessKey = process.env.S3_ACCESS_KEY || "";
  const secretKey = process.env.S3_SECRET_KEY || "";

  s3Client = new S3Client({
    endpoint,
    region,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    forcePathStyle: true,
  });
  return s3Client;
}

const S3_BUCKET = process.env.S3_BUCKET || "files";

// ==================== Supabase (Cloud mode) ====================

let supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (supabase) return supabase;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  supabase = createClient(url, key);
  return supabase;
}

// ==================== Types ====================

type UserRow = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  role: string;
  password: string | null;
  createdAt: string;
  updatedAt: string;
  lastSignedIn: string;
};

type FileRow = {
  id: number;
  userId: number;
  originalName: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  filePath: string;
  uploadedAt: string;
  createdAt: string;
  updatedAt: string;
};

// ==================== User Operations ====================

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");

  const role =
    user.role ??
    (user.openId === ENV.ownerOpenId ? ("admin" as const) : ("user" as const));
  const now = new Date().toISOString();

  if (useSupabase) {
    const db = getSupabase();
    const { data: existing } = await db
      .from("users")
      .select("*")
      .eq("openId", user.openId)
      .maybeSingle();
    if (!existing) {
      await db.from("users").insert({
        openId: user.openId,
        name: user.name ?? null,
        email: user.email ?? null,
        loginMethod: user.loginMethod ?? null,
        role,
        createdAt: now,
        updatedAt: now,
        lastSignedIn: now,
      });
      return;
    }
    const updateData: Record<string, unknown> = {
      role,
      lastSignedIn: user.lastSignedIn
        ? new Date(user.lastSignedIn).toISOString()
        : existing.lastSignedIn,
      updatedAt: now,
    };
    if (user.name !== undefined) updateData.name = user.name ?? null;
    if (user.email !== undefined) updateData.email = user.email ?? null;
    if (user.loginMethod !== undefined)
      updateData.loginMethod = user.loginMethod ?? null;
    await db.from("users").update(updateData).eq("openId", user.openId);
  } else {
    const sql = getPostgres();
    const existing =
      await sql`SELECT * FROM users WHERE "openId" = ${user.openId}`.then(
        r => r[0] ?? null
      );
    if (!existing) {
      await sql`INSERT INTO users ("openId", name, email, "loginMethod", role, "createdAt", "updatedAt", "lastSignedIn")
        VALUES (${user.openId}, ${user.name ?? null}, ${user.email ?? null}, ${user.loginMethod ?? null}, ${role}, ${now}, ${now}, ${now})`;
      return;
    }
    const lastSignedIn = user.lastSignedIn
      ? new Date(user.lastSignedIn).toISOString()
      : existing.lastSignedIn;
    await sql`UPDATE users SET role = ${role}, "lastSignedIn" = ${lastSignedIn}, "updatedAt" = ${now}
      ${user.name !== undefined ? sql`, name = ${user.name ?? null}` : sql``}
      ${user.email !== undefined ? sql`, email = ${user.email ?? null}` : sql``}
      ${user.loginMethod !== undefined ? sql`, "loginMethod" = ${user.loginMethod ?? null}` : sql``}
      WHERE "openId" = ${user.openId}`;
  }
}

export async function getUserByOpenId(openId: string) {
  if (useSupabase) {
    const db = getSupabase();
    const { data, error } = await db
      .from("users")
      .select("*")
      .eq("openId", openId)
      .maybeSingle();
    if (error) throw error;
    return data ?? undefined;
  } else {
    const sql = getPostgres();
    const rows = await sql`SELECT * FROM users WHERE "openId" = ${openId}`;
    return rows[0] ?? undefined;
  }
}

export async function findUserByEmail(email: string) {
  if (useSupabase) {
    const db = getSupabase();
    const { data, error } = await db
      .from("users")
      .select("*")
      .eq("email", email)
      .maybeSingle();
    if (error) throw error;
    return data ?? null;
  } else {
    const sql = getPostgres();
    const rows = await sql`SELECT * FROM users WHERE email = ${email}`;
    return rows[0] ?? null;
  }
}

export async function createUserWithPassword(data: {
  name: string;
  email: string;
  password: string;
}) {
  const existing = await findUserByEmail(data.email);
  if (existing) throw new Error("User with this email already exists");

  const { hashPassword } = await import("./_core/password");
  const hashedPassword = await hashPassword(data.password);
  const now = new Date().toISOString();

  if (useSupabase) {
    const db = getSupabase();
    const { data: newUser, error } = await db
      .from("users")
      .insert({
        openId: `email:${data.email}`,
        name: data.name,
        email: data.email,
        password: hashedPassword,
        loginMethod: "email",
        role: "user",
        createdAt: now,
        updatedAt: now,
        lastSignedIn: now,
      })
      .select()
      .single();
    if (error) throw error;
    return newUser;
  } else {
    const sql = getPostgres();
    const rows =
      await sql`INSERT INTO users ("openId", name, email, password, "loginMethod", role, "createdAt", "updatedAt", "lastSignedIn")
      VALUES (${`email:${data.email}`}, ${data.name}, ${data.email}, ${hashedPassword}, ${"email"}, ${"user"}, ${now}, ${now}, ${now})
      RETURNING *`;
    return rows[0];
  }
}

// ==================== File Operations ====================

export async function createFile(file: InsertFile) {
  const now = new Date().toISOString();

  if (useSupabase) {
    const db = getSupabase();
    const { data, error } = await db
      .from("files")
      .insert({
        userId: file.userId,
        originalName: file.originalName,
        fileName: file.fileName,
        fileType: file.fileType,
        fileSize: file.fileSize,
        filePath: file.filePath,
        uploadedAt: file.uploadedAt
          ? new Date(file.uploadedAt).toISOString()
          : now,
        createdAt: now,
        updatedAt: now,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const sql = getPostgres();
    const uploadedAt = file.uploadedAt
      ? new Date(file.uploadedAt).toISOString()
      : now;
    const rows =
      await sql`INSERT INTO files ("userId", "originalName", "fileName", "fileType", "fileSize", "filePath", "uploadedAt", "createdAt", "updatedAt")
      VALUES (${file.userId}, ${file.originalName}, ${file.fileName}, ${file.fileType}, ${file.fileSize}, ${file.filePath}, ${uploadedAt}, ${now}, ${now})
      RETURNING *`;
    return rows[0];
  }
}

export async function getFilesByUserId(userId: number) {
  if (useSupabase) {
    const db = getSupabase();
    const { data, error } = await db
      .from("files")
      .select("*")
      .eq("userId", userId);
    if (error) throw error;
    return data ?? [];
  } else {
    const sql = getPostgres();
    return await sql`SELECT * FROM files WHERE "userId" = ${userId}`;
  }
}

export async function getFileById(fileId: number, userId: number) {
  if (useSupabase) {
    const db = getSupabase();
    const { data, error } = await db
      .from("files")
      .select("*")
      .eq("id", fileId)
      .eq("userId", userId)
      .maybeSingle();
    if (error) throw error;
    return data ?? null;
  } else {
    const sql = getPostgres();
    const rows =
      await sql`SELECT * FROM files WHERE id = ${fileId} AND "userId" = ${userId}`;
    return rows[0] ?? null;
  }
}

export async function deleteFile(fileId: number, userId: number) {
  if (useSupabase) {
    const db = getSupabase();
    const { error } = await db
      .from("files")
      .delete()
      .eq("id", fileId)
      .eq("userId", userId);
    if (error) throw error;
  } else {
    const sql = getPostgres();
    await sql`DELETE FROM files WHERE id = ${fileId} AND "userId" = ${userId}`;
  }
  return { success: true };
}

export async function searchFiles(userId: number, query: string) {
  if (useSupabase) {
    const db = getSupabase();
    const { data, error } = await db
      .from("files")
      .select("*")
      .eq("userId", userId)
      .ilike("originalName", `%${query}%`);
    if (error) throw error;
    return data ?? [];
  } else {
    const sql = getPostgres();
    return await sql`SELECT * FROM files WHERE "userId" = ${userId} AND "originalName" ILIKE ${"%" + query + "%"}`;
  }
}

export async function filterFilesByType(userId: number, fileType: string) {
  if (useSupabase) {
    const db = getSupabase();
    const { data, error } = await db
      .from("files")
      .select("*")
      .eq("userId", userId)
      .eq("fileType", fileType);
    if (error) throw error;
    return data ?? [];
  } else {
    const sql = getPostgres();
    return await sql`SELECT * FROM files WHERE "userId" = ${userId} AND "fileType" = ${fileType}`;
  }
}

// ==================== Storage Operations ====================

const STORAGE_BUCKET = "files";

export async function uploadToStorage(
  filePath: string,
  fileBuffer: Buffer,
  contentType: string
): Promise<string> {
  if (useSupabase) {
    const db = getSupabase();
    const { error } = await db.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, fileBuffer, { contentType, upsert: false });
    if (error) throw error;
  } else {
    const s3 = getS3();
    await s3.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: filePath,
        Body: fileBuffer,
        ContentType: contentType,
      })
    );
  }
  return filePath;
}

export async function downloadFromStorage(filePath: string): Promise<Buffer> {
  if (useSupabase) {
    const db = getSupabase();
    const { data, error } = await db.storage
      .from(STORAGE_BUCKET)
      .download(filePath);
    if (error) throw error;
    return Buffer.from(await data.arrayBuffer());
  } else {
    const s3 = getS3();
    const { Body } = await s3.send(
      new GetObjectCommand({ Bucket: S3_BUCKET, Key: filePath })
    );
    return Buffer.from(await (Body as any).transformToByteArray());
  }
}

export async function deleteFromStorage(filePath: string): Promise<void> {
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
