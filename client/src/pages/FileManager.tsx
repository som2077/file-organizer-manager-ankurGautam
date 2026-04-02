import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { UploadZone } from "@/components/UploadZone";
import { FileCard } from "@/components/FileCard";
import { SearchAndFilter } from "@/components/SearchAndFilter";
import { File } from "@/types";
import { downloadFile, getFileCategory } from "@/lib/fileUtils";
import { Loader2, AlertCircle, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export default function FileManager() {
  const utils = trpc.useUtils();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("");
  const [displayedFiles, setDisplayedFiles] = useState<File[]>([]);

  // tRPC queries and mutations
  const { data: files, isLoading, refetch } = trpc.files.list.useQuery();
  const uploadMutation = trpc.files.upload.useMutation();
  const deleteMutation = trpc.files.delete.useMutation();
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
      utils.auth.me.invalidate();
      window.location.href = "/login";
    },
  });
  const [downloadFileId, setDownloadFileId] = useState<number | null>(null);
  const { data: downloadData } = trpc.files.download.useQuery(
    { fileId: downloadFileId || -1 },
    { enabled: downloadFileId !== null }
  );

  // Update displayed files based on search/filter
  useEffect(() => {
    if (!files) {
      setDisplayedFiles([]);
      return;
    }

    let filtered = [...files];

    if (searchQuery) {
      filtered = filtered.filter((file) =>
        file.originalName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (filterType) {
      filtered = filtered.filter((file) => file.fileType === filterType);
    }

    setDisplayedFiles(filtered as File[]);
  }, [files, searchQuery, filterType]);

  // Get unique file types for filter
  const fileTypes = files
    ? Array.from(new Set(files.map((f) => f.fileType))).sort()
    : [];

  // Handle file upload
  const handleUpload = async (selectedFiles: globalThis.File[]) => {
    for (const file of selectedFiles) {
      try {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const fileData = (e.target?.result as string).split(",")[1];
          if (!fileData) {
            toast.error("Failed to read file");
            return;
          }

          await uploadMutation.mutateAsync({
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            fileData,
          });

          toast.success(`${file.name} uploaded successfully`);
          refetch();
        };
        reader.readAsDataURL(file);
      } catch (error) {
        console.error("Upload error:", error);
        toast.error(`Failed to upload ${file.name}`);
      }
    }
  };

  // Handle file download
  useEffect(() => {
    if (downloadData && downloadFileId) {
      downloadFile(downloadData.fileData, downloadData.fileName, downloadData.fileType);
      toast.success("File downloaded successfully");
      setDownloadFileId(null);
    }
  }, [downloadData]);

  const handleDownload = (fileId: number) => {
    const file = files?.find((f) => f.id === fileId);
    if (!file) {
      toast.error("File not found");
      return;
    }
    setDownloadFileId(fileId);
  };

  // Handle file delete
  const handleDelete = async (fileId: number) => {
    if (!window.confirm("Are you sure you want to delete this file?")) return;

    try {
      await deleteMutation.mutateAsync({ fileId });
      toast.success("File deleted successfully");
      refetch();
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete file");
    }
  };

  const isUploading = uploadMutation.isPending;
  const isDownloading = downloadFileId !== null;
  const isDeleting = deleteMutation.isPending;
  const isAnyLoading = isLoading || isUploading || isDeleting;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 py-8">
      <div className="container">
        {/* Header */}
        <div className="mb-8 animate-slideInDown flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent mb-2">
              File Organizer
            </h1>
            <p className="text-muted-foreground">
              Manage, organize, and share your files with ease
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>

        {/* Upload Zone */}
        <div className="mb-8">
          <UploadZone onFilesSelected={handleUpload as any} isLoading={isUploading} />
          {isUploading && (
            <div className="mt-4 flex items-center gap-2 text-purple-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Uploading file...</span>
            </div>
          )}
        </div>

        {/* Search and Filter */}
        {files && files.length > 0 && (
          <SearchAndFilter
            onSearch={setSearchQuery}
            onFilterByType={setFilterType}
            onViewChange={setView}
            currentView={view}
            fileTypes={fileTypes}
          />
        )}

        {/* Files Display */}
        <div className="mt-8">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
          ) : displayedFiles.length === 0 ? (
            <div className="empty-state">
              <AlertCircle className="empty-state-icon" />
              <h3 className="empty-state-title">
                {files?.length === 0 ? "No files yet" : "No files match your search"}
              </h3>
              <p className="empty-state-description">
                {files?.length === 0
                  ? "Upload your first file to get started"
                  : "Try adjusting your search or filter criteria"}
              </p>
            </div>
          ) : (
            <div
              className={
                view === "grid"
                  ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                  : "space-y-2"
              }
            >
              {displayedFiles.map((file) => (
                <FileCard
                  key={file.id}
                  file={file}
                  view={view}
                  onDownload={handleDownload}
                  onDelete={handleDelete}
                  isLoading={isDeleting}
                />
              ))}
            </div>
          )}
        </div>

        {/* File Stats */}
        {files && files.length > 0 && (
          <div className="mt-8 p-4 bg-white/70 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 rounded-xl animate-fadeInUp" style={{ backdropFilter: 'blur(10px)' }}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Files</p>
                <p className="text-2xl font-bold text-foreground">{files.length}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Displayed</p>
                <p className="text-2xl font-bold text-foreground">{displayedFiles.length}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">File Types</p>
                <p className="text-2xl font-bold text-foreground">{fileTypes.length}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Size</p>
                <p className="text-2xl font-bold text-foreground">
                  {(files.reduce((sum, f) => sum + f.fileSize, 0) / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
