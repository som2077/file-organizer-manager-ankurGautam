import { File } from "@/types";
import { Download, Trash2, FileIcon, Image as ImageIcon, FileText, Music, Video } from "lucide-react";
import { formatFileSize, formatDate, getFileIcon } from "@/lib/fileUtils";

interface FileCardProps {
  file: File;
  view: "grid" | "list";
  onDownload: (fileId: number) => void;
  onDelete: (fileId: number) => void;
  isLoading?: boolean;
}

export function FileCard({ file, view, onDownload, onDelete, isLoading }: FileCardProps) {
  const Icon = getFileIcon(file.fileType);

  if (view === "grid") {
    return (
      <div className="file-card file-card-grid animate-fadeInUp">
        <div className="w-16 h-16 mb-3 rounded-lg bg-gradient-to-br from-purple-400/20 to-pink-400/20 flex items-center justify-center">
          <Icon className="w-8 h-8 text-purple-500" />
        </div>
        <h3 className="font-semibold text-sm text-center mb-2 line-clamp-2 text-foreground">
          {file.originalName}
        </h3>
        <p className="text-xs text-muted-foreground mb-3">{formatFileSize(file.fileSize)}</p>
        <p className="text-xs text-muted-foreground mb-4">{formatDate(file.uploadedAt)}</p>
        <div className="flex gap-2 w-full">
          <button
            onClick={() => onDownload(file.id)}
            disabled={isLoading}
            className="btn-icon flex-1 flex items-center justify-center gap-1 text-sm"
            title="Download file"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(file.id)}
            disabled={isLoading}
            className="btn-icon flex-1 flex items-center justify-center gap-1 text-sm text-red-500 hover:bg-red-500/10"
            title="Delete file"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="file-card file-card-list animate-fadeInUp px-6 py-4">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-400/20 to-pink-400/20 flex items-center justify-center flex-shrink-0">
          <Icon className="w-6 h-6 text-purple-500" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate">{file.originalName}</h3>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>{formatFileSize(file.fileSize)}</span>
            <span>{formatDate(file.uploadedAt)}</span>
          </div>
        </div>
      </div>
      <div className="flex gap-2 flex-shrink-0 ml-4">
        <button
          onClick={() => onDownload(file.id)}
          disabled={isLoading}
          className="btn-icon"
          title="Download file"
        >
          <Download className="w-5 h-5" />
        </button>
        <button
          onClick={() => onDelete(file.id)}
          disabled={isLoading}
          className="btn-icon text-red-500 hover:bg-red-500/10"
          title="Delete file"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
