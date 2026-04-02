import { MongoClient, type Db } from "mongodb";
import type { InsertUser, InsertFile } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { hashPassword } from "./_core/password";

let client: MongoClient | null = null;
let mongoDb: Db | null = null;

async function getDb(): Promise<Db> {
  if (mongoDb) return mongoDb;

  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017";
  const dbName = process.env.MONGODB_DB_NAME || "file_organizer";

  if (!client) {
    client = new MongoClient(uri);
    await client.connect();
  }

  mongoDb = client.db(dbName);
  return mongoDb;
}

type UserDocument = InsertUser & {
  id: number;
  password?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
};

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  const users = db.collection<InsertUser & { id: number; createdAt?: Date; updatedAt?: Date }>("users");

  const existing = await users.findOne({ openId: user.openId });
  const now = new Date();

  const role =
    user.role ??
    (user.openId === ENV.ownerOpenId ? ("admin" as const) : ("user" as const));

  const update: Partial<InsertUser> & {
    role: InsertUser["role"];
    lastSignedIn: Date;
  } = {
    role,
    lastSignedIn: user.lastSignedIn ?? existing?.lastSignedIn ?? now,
  };

  if (user.name !== undefined) update.name = user.name ?? null;
  if (user.email !== undefined) update.email = user.email ?? null;
  if (user.loginMethod !== undefined) update.loginMethod = user.loginMethod ?? null;

  if (!existing) {
    await users.insertOne({
      id: 1, // single local user
      openId: user.openId,
      name: update.name ?? null,
      email: update.email ?? null,
      loginMethod: update.loginMethod ?? null,
      role,
      createdAt: now,
      updatedAt: now,
      lastSignedIn: update.lastSignedIn,
    } as InsertUser & { id: number; createdAt: Date; updatedAt: Date });
    return;
  }

  await users.updateOne(
    { openId: user.openId },
    {
      $set: {
        ...update,
        updatedAt: now,
      },
    }
  );
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  const users = db.collection<InsertUser & { id: number }>("users");
  const user = await users.findOne({ openId });
  return user ?? undefined;
}

export async function createFile(file: InsertFile) {
  const db = await getDb();
  const files = db.collection<InsertFile & { id: number }>("files");
  const now = new Date();

  const doc: InsertFile & { id: number } = {
    ...file,
    id: Date.now(), // simple numeric id for dev
    uploadedAt: file.uploadedAt ?? now,
    createdAt: file.createdAt ?? now,
    updatedAt: file.updatedAt ?? now,
  };

  await files.insertOne(doc);
  return doc;
}

export async function getFilesByUserId(userId: number) {
  const db = await getDb();
  const files = db.collection<InsertFile & { id: number }>("files");
  return await files.find({ userId }).toArray();
}

export async function getFileById(fileId: number, userId: number) {
  const db = await getDb();
  const files = db.collection<InsertFile & { id: number }>("files");
  const file = await files.findOne({ id: fileId, userId });
  return file ?? null;
}

export async function deleteFile(fileId: number, userId: number) {
  const db = await getDb();
  const files = db.collection<InsertFile & { id: number }>("files");
  const result = await files.deleteOne({ id: fileId, userId });
  return result;
}

export async function searchFiles(userId: number, query: string) {
  const db = await getDb();
  const files = db.collection<InsertFile & { id: number }>("files");
  const result = await files
    .find({
      userId,
      originalName: { $regex: query, $options: "i" },
    })
    .toArray();
  return result;
}

export async function filterFilesByType(userId: number, fileType: string) {
  const db = await getDb();
  const files = db.collection<InsertFile & { id: number }>("files");
  const result = await files
    .find({
      userId,
      fileType,
    })
    .toArray();
  return result;
}

export async function findUserByEmail(email: string) {
  const db = await getDb();
  const users = db.collection<UserDocument>("users");
  const user = await users.findOne({ email });
  return user ?? null;
}

export async function createUserWithPassword(data: {
  name: string;
  email: string;
  password: string;
}) {
  const db = await getDb();
  const users = db.collection<UserDocument>("users");

  const existing = await users.findOne({ email: data.email });
  if (existing) {
    throw new Error("User with this email already exists");
  }

  const hashedPassword = await hashPassword(data.password);
  const now = new Date();

  const lastId = await users
    .find()
    .sort({ id: -1 })
    .limit(1)
    .toArray()
    .then((arr) => (arr.length > 0 ? arr[0].id : 0));

  const doc: UserDocument = {
    id: (lastId ?? 0) + 1,
    openId: `email:${data.email}`,
    name: data.name,
    email: data.email,
    password: hashedPassword,
    loginMethod: "email",
    role: "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  };

  await users.insertOne(doc);
  return doc;
}
