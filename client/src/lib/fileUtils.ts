import {
  FileIcon,
  Image,
  FileText,
  Music,
  Video,
  Archive,
  Code,
  File as DefaultFile,
  LucideIcon,
} from "lucide-react";

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function getFileIcon(fileType: string): LucideIcon {
  const type = fileType.toLowerCase();

  if (type.includes("image")) return Image;
  if (type.includes("pdf") || type.includes("document") || type.includes("word")) return FileText;
  if (type.includes("audio") || type.includes("mp3")) return Music;
  if (type.includes("video")) return Video;
  if (type.includes("zip") || type.includes("rar") || type.includes("7z")) return Archive;
  if (
    type.includes("javascript") ||
    type.includes("typescript") ||
    type.includes("code") ||
    type.includes("json")
  )
    return Code;

  return DefaultFile;
}

export function getFileCategory(fileType: string): string {
  const type = fileType.toLowerCase();

  if (type.includes("image")) return "Images";
  if (type.includes("pdf") || type.includes("document") || type.includes("word")) return "Documents";
  if (type.includes("audio") || type.includes("mp3")) return "Audio";
  if (type.includes("video")) return "Videos";
  if (type.includes("zip") || type.includes("rar") || type.includes("7z")) return "Archives";
  if (
    type.includes("javascript") ||
    type.includes("typescript") ||
    type.includes("code") ||
    type.includes("json")
  )
    return "Code";

  return "Other";
}

export function downloadFile(fileData: string, fileName: string, fileType: string): void {
  const binaryString = atob(fileData);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const blob = new Blob([bytes], { type: fileType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
