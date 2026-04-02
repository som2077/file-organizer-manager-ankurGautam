import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { InsertUser, InsertFile } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { hashPassword } from "./_core/password";

let supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (supabase) return supabase;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }

  supabase = createClient(supabaseUrl, supabaseKey);
  return supabase;
}

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

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = getSupabase();

  const role =
    user.role ??
    (user.openId === ENV.ownerOpenId ? ("admin" as const) : ("user" as const));

  const { data: existing } = await db
    .from("users")
    .select("*")
    .eq("openId", user.openId)
    .maybeSingle();

  const now = new Date().toISOString();

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
}

export async function getUserByOpenId(openId: string) {
  const db = getSupabase();
  const { data, error } = await db
    .from("users")
    .select("*")
    .eq("openId", openId)
    .maybeSingle();

  if (error) throw error;
  return data ?? undefined;
}

export async function createFile(file: InsertFile) {
  const db = getSupabase();
  const now = new Date().toISOString();

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
}

export async function getFilesByUserId(userId: number) {
  const db = getSupabase();
  const { data, error } = await db
    .from("files")
    .select("*")
    .eq("userId", userId);

  if (error) throw error;
  return data ?? [];
}

export async function getFileById(fileId: number, userId: number) {
  const db = getSupabase();
  const { data, error } = await db
    .from("files")
    .select("*")
    .eq("id", fileId)
    .eq("userId", userId)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function deleteFile(fileId: number, userId: number) {
  const db = getSupabase();
  const { error } = await db
    .from("files")
    .delete()
    .eq("id", fileId)
    .eq("userId", userId);

  if (error) throw error;
  return { success: true };
}

export async function searchFiles(userId: number, query: string) {
  const db = getSupabase();
  const { data, error } = await db
    .from("files")
    .select("*")
    .eq("userId", userId)
    .ilike("originalName", `%${query}%`);

  if (error) throw error;
  return data ?? [];
}

export async function filterFilesByType(userId: number, fileType: string) {
  const db = getSupabase();
  const { data, error } = await db
    .from("files")
    .select("*")
    .eq("userId", userId)
    .eq("fileType", fileType);

  if (error) throw error;
  return data ?? [];
}

export async function findUserByEmail(email: string) {
  const db = getSupabase();
  const { data, error } = await db
    .from("users")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function createUserWithPassword(data: {
  name: string;
  email: string;
  password: string;
}) {
  const db = getSupabase();

  const existing = await findUserByEmail(data.email);
  if (existing) {
    throw new Error("User with this email already exists");
  }

  const hashedPassword = await hashPassword(data.password);
  const now = new Date().toISOString();

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
}

// ==================== Supabase Storage ====================

const STORAGE_BUCKET = "files";

export async function uploadToStorage(
  filePath: string,
  fileBuffer: Buffer,
  contentType: string
): Promise<string> {
  const db = getSupabase();

  const { error } = await db.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, fileBuffer, {
      contentType,
      upsert: false,
    });

  if (error) throw error;
  return filePath;
}

export async function downloadFromStorage(filePath: string): Promise<Buffer> {
  const db = getSupabase();

  const { data, error } = await db.storage
    .from(STORAGE_BUCKET)
    .download(filePath);

  if (error) throw error;

  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function deleteFromStorage(filePath: string): Promise<void> {
  const db = getSupabase();

  const { error } = await db.storage.from(STORAGE_BUCKET).remove([filePath]);

  if (error) throw error;
}
