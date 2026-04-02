import { useRef, useState } from "react";
import { Cloud, Upload } from "lucide-react";

interface UploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  isLoading?: boolean;
}

export function UploadZone({ onFilesSelected, isLoading }: UploadZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      onFilesSelected(files);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onFilesSelected(files);
    }
  };

  return (
    <div
      className={`upload-zone ${isDragActive ? "active" : ""}`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleChange}
        className="hidden"
        disabled={isLoading}
      />

      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400/20 to-pink-400/20 flex items-center justify-center">
          <Cloud className="w-6 h-6 text-purple-500" />
        </div>
        <div>
          <p className="font-semibold text-foreground mb-1">
            {isDragActive ? "Drop your files here" : "Drag and drop your files here"}
          </p>
          <p className="text-sm text-muted-foreground">
            or{" "}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="text-purple-500 hover:text-purple-600 font-medium underline"
            >
              browse files
            </button>
          </p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mt-4">
        Supported: Images, Documents, Videos, Audio, Archives, and more
      </p>
    </div>
  );
}
