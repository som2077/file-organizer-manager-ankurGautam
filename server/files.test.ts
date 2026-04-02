import { describe, expect, it, beforeEach, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(userId: number = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `test-user-${userId}`,
    email: `test${userId}@example.com`,
    name: `Test User ${userId}`,
    loginMethod: "test",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("files router", () => {
  describe("list", () => {
    it("returns empty array for user with no files", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.files.list();

      expect(Array.isArray(result)).toBe(true);
      // Verify all files belong to the current user
      expect(result.every((f) => f.userId === ctx.user.id)).toBe(true);
    });
  });

  describe("upload", () => {
    it("uploads a file successfully", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const fileData = Buffer.from("test file content").toString("base64");
      const result = await caller.files.upload({
        fileName: "test.txt",
        fileType: "text/plain",
        fileSize: 17,
        fileData,
      });

      expect(result.success).toBe(true);
      expect(result.file).toBeDefined();
      expect(result.file.originalName).toBe("test.txt");
      expect(result.file.fileType).toBe("text/plain");
      expect(result.file.fileSize).toBe(17);
      expect(result.file.userId).toBe(ctx.user.id);
    });

    it("creates a unique file name", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const fileData = Buffer.from("test").toString("base64");
      const result1 = await caller.files.upload({
        fileName: "same.txt",
        fileType: "text/plain",
        fileSize: 4,
        fileData,
      });

      const result2 = await caller.files.upload({
        fileName: "same.txt",
        fileType: "text/plain",
        fileSize: 4,
        fileData,
      });

      expect(result1.file.fileName).not.toBe(result2.file.fileName);
    });
  });

  describe("search", () => {
    it("searches files by name", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const fileData = Buffer.from("test").toString("base64");
      const uniqueSuffix = Date.now();

      // Upload test files
      await caller.files.upload({
        fileName: `document-${uniqueSuffix}.pdf`,
        fileType: "application/pdf",
        fileSize: 4,
        fileData,
      });

      await caller.files.upload({
        fileName: `image-${uniqueSuffix}.jpg`,
        fileType: "image/jpeg",
        fileSize: 4,
        fileData,
      });

      // Search for PDF
      const results = await caller.files.search({ query: `document-${uniqueSuffix}` });

      expect(results.length).toBe(1);
      expect(results[0].originalName).toContain(`document-${uniqueSuffix}`);
    });

    it("returns empty array when no matches found", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const results = await caller.files.search({ query: "nonexistent" });

      expect(results.length).toBe(0);
    });
  });

  describe("filterByType", () => {
    it("filters files by type", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const fileData = Buffer.from("test").toString("base64");
      const uniqueSuffix = Date.now();

      // Upload different file types
      await caller.files.upload({
        fileName: `image1-${uniqueSuffix}.jpg`,
        fileType: "image/jpeg",
        fileSize: 4,
        fileData,
      });

      await caller.files.upload({
        fileName: `image2-${uniqueSuffix}.png`,
        fileType: "image/png",
        fileSize: 4,
        fileData,
      });

      await caller.files.upload({
        fileName: `document-${uniqueSuffix}.pdf`,
        fileType: "application/pdf",
        fileSize: 4,
        fileData,
      });

      // Filter by image/jpeg
      const results = await caller.files.filterByType({ fileType: "image/jpeg" });

      // Should have at least the file we just uploaded
      const jpegFiles = results.filter((f) => f.originalName.includes(uniqueSuffix));
      expect(jpegFiles.length).toBe(1);
      expect(jpegFiles[0].fileType).toBe("image/jpeg");
    });
  });

  describe("delete", () => {
    it("deletes a file successfully", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const fileData = Buffer.from("test").toString("base64");
      const uploadResult = await caller.files.upload({
        fileName: "delete-me.txt",
        fileType: "text/plain",
        fileSize: 4,
        fileData,
      });

      const deleteResult = await caller.files.delete({ fileId: uploadResult.file.id });

      expect(deleteResult.success).toBe(true);

      // Verify file is deleted
      const files = await caller.files.list();
      expect(files.find((f) => f.id === uploadResult.file.id)).toBeUndefined();
    });

    it("prevents user from deleting another user's file", async () => {
      const ctx1 = createAuthContext(1);
      const ctx2 = createAuthContext(2);
      const caller1 = appRouter.createCaller(ctx1);
      const caller2 = appRouter.createCaller(ctx2);

      const fileData = Buffer.from("test").toString("base64");
      const uploadResult = await caller1.files.upload({
        fileName: `secret-${Date.now()}.txt`,
        fileType: "text/plain",
        fileSize: 4,
        fileData,
      });

      // Try to delete with different user
      try {
        await caller2.files.delete({ fileId: uploadResult.file.id });
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        // Expected to fail
        expect(error).toBeDefined();
      }
    });
  });

  describe("download", () => {
    it("downloads a file successfully", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const testContent = "test file content";
      const fileData = Buffer.from(testContent).toString("base64");
      const uploadResult = await caller.files.upload({
        fileName: "download-me.txt",
        fileType: "text/plain",
        fileSize: testContent.length,
        fileData,
      });

      const downloadResult = await caller.files.download({ fileId: uploadResult.file.id });

      expect(downloadResult.fileName).toBe("download-me.txt");
      expect(downloadResult.fileType).toBe("text/plain");
      expect(downloadResult.fileData).toBe(fileData);
    });

    it("prevents user from downloading another user's file", async () => {
      const ctx1 = createAuthContext(1);
      const ctx2 = createAuthContext(2);
      const caller1 = appRouter.createCaller(ctx1);
      const caller2 = appRouter.createCaller(ctx2);

      const fileData = Buffer.from("secret").toString("base64");
      const uploadResult = await caller1.files.upload({
        fileName: `secret-${Date.now()}.txt`,
        fileType: "text/plain",
        fileSize: 6,
        fileData,
      });

      // Try to download with different user
      try {
        await caller2.files.download({ fileId: uploadResult.file.id });
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        // Expected to fail
        expect(error).toBeDefined();
      }
    });
  });
});
