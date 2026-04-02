export interface File {
  id: number;
  userId: number;
  originalName: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  filePath: string;
  uploadedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
