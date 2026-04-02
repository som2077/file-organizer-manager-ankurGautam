import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { sdk } from "./_core/sdk";
import { verifyPassword } from "./_core/password";
import { z } from "zod";
import { createFile, deleteFile, filterFilesByType, getFileById, getFilesByUserId, searchFiles, findUserByEmail, createUserWithPassword, upsertUser } from "./db";
import { TRPCError } from "@trpc/server";
import fs from "fs/promises";
import path from "path";
import { nanoid } from "nanoid";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
    signup: publicProcedure
      .input(z.object({
        name: z.string().min(1, "Name is required"),
        email: z.string().email("Invalid email address"),
        password: z.string().min(6, "Password must be at least 6 characters"),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const existingUser = await findUserByEmail(input.email);
          if (existingUser) {
            throw new TRPCError({
              code: "CONFLICT",
              message: "A user with this email already exists",
            });
          }

          const user = await createUserWithPassword({
            name: input.name,
            email: input.email,
            password: input.password,
          });

          const sessionToken = await sdk.createSessionToken(user.openId, {
            name: user.name || input.name,
            expiresInMs: ONE_YEAR_MS,
          });

          const cookieOptions = getSessionCookieOptions(ctx.req);
          ctx.res.cookie(COOKIE_NAME, sessionToken, {
            ...cookieOptions,
            maxAge: ONE_YEAR_MS,
          });

          return {
            success: true,
            user: { id: user.id, name: user.name, email: user.email },
          };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          console.error("Signup error:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create account",
          });
        }
      }),
    login: publicProcedure
      .input(z.object({
        email: z.string().email("Invalid email address"),
        password: z.string().min(1, "Password is required"),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const user = await findUserByEmail(input.email);
          if (!user || !user.password) {
            throw new TRPCError({
              code: "UNAUTHORIZED",
              message: "Invalid email or password",
            });
          }

          const isValid = await verifyPassword(input.password, user.password);
          if (!isValid) {
            throw new TRPCError({
              code: "UNAUTHORIZED",
              message: "Invalid email or password",
            });
          }

          await upsertUser({
            openId: user.openId,
            lastSignedIn: new Date(),
          });

          const sessionToken = await sdk.createSessionToken(user.openId, {
            name: user.name || "",
            expiresInMs: ONE_YEAR_MS,
          });

          const cookieOptions = getSessionCookieOptions(ctx.req);
          ctx.res.cookie(COOKIE_NAME, sessionToken, {
            ...cookieOptions,
            maxAge: ONE_YEAR_MS,
          });

          return {
            success: true,
            user: { id: user.id, name: user.name, email: user.email },
          };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          console.error("Login error:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to login",
          });
        }
      }),
  }),

  files: router({
    list: protectedProcedure.query(({ ctx }) =>
      getFilesByUserId(ctx.user.id)
    ),
    
    upload: protectedProcedure
      .input(z.object({
        fileName: z.string(),
        fileType: z.string(),
        fileSize: z.number(),
        fileData: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const uploadsDir = path.join(process.cwd(), "uploads");
          await fs.mkdir(uploadsDir, { recursive: true });
          
          const uniqueFileName = `${nanoid()}-${input.fileName}`;
          const filePath = path.join(uploadsDir, uniqueFileName);
          
          const buffer = Buffer.from(input.fileData, "base64");
          await fs.writeFile(filePath, buffer);
          
          const file = await createFile({
            userId: ctx.user.id,
            originalName: input.fileName,
            fileName: uniqueFileName,
            fileType: input.fileType,
            fileSize: input.fileSize,
            filePath: uniqueFileName,
            uploadedAt: new Date(),
          });
          
          return { success: true, file };
        } catch (error) {
          console.error("File upload error:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to upload file",
          });
        }
      }),
    
    download: protectedProcedure
      .input(z.object({ fileId: z.number() }))
      .query(async ({ ctx, input }) => {
        try {
          const file = await getFileById(input.fileId, ctx.user.id);
          if (!file) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "File not found",
            });
          }
          
          const filePath = path.join(process.cwd(), "uploads", file.filePath);
          const fileData = await fs.readFile(filePath);
          
          return {
            fileName: file.originalName,
            fileData: fileData.toString("base64"),
            fileType: file.fileType,
          };
        } catch (error) {
          console.error("File download error:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to download file",
          });
        }
      }),
    
    delete: protectedProcedure
      .input(z.object({ fileId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        try {
          const file = await getFileById(input.fileId, ctx.user.id);
          if (!file) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "File not found",
            });
          }
          
          const filePath = path.join(process.cwd(), "uploads", file.filePath);
          try {
            await fs.unlink(filePath);
          } catch (err) {
            console.warn("Failed to delete file from disk:", err);
          }
          
          await deleteFile(input.fileId, ctx.user.id);
          
          return { success: true };
        } catch (error) {
          console.error("File delete error:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to delete file",
          });
        }
      }),
    
    search: protectedProcedure
      .input(z.object({ query: z.string() }))
      .query(({ ctx, input }) =>
        searchFiles(ctx.user.id, input.query)
      ),
    
    filterByType: protectedProcedure
      .input(z.object({ fileType: z.string() }))
      .query(({ ctx, input }) =>
        filterFilesByType(ctx.user.id, input.fileType)
      ),
  }),
});

export type AppRouter = typeof appRouter;
