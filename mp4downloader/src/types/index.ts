export interface DownloadItem {
  id: string;
  url: string;
  title: string;
  status: 'pending' | 'downloading' | 'converting' | 'completed' | 'error';
  progress: number;
  error?: string;
  filePath?: string;
  quality: string;
  duration?: number;
  size?: number;
  timestamp: number;
}

export type QualityOption = '128' | '192' | '256' | '320';

export interface DownloadProgress {
  id: string;
  progress: number;
  status: DownloadItem['status'];
  error?: string;
  filePath?: string;
  duration?: number;
  size?: number;
}
