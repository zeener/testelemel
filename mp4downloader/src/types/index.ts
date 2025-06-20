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
  playlistId?: string;
  isPlaylistItem?: boolean;
}

export interface PlaylistInfo {
  id: string;
  url: string;
  title: string;
  videoCount: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  completedItems: number;
  totalItems: number;
  error?: string;
  items: Array<{
    id: string;
    title: string;
    status: DownloadItem['status'];
    progress: number;
    error?: string;
  }>;
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
