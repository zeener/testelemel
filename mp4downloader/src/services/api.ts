import axios from 'axios';
import { type DownloadProgress, type QualityOption, type PlaylistInfo } from '../types';

// Base URL for the API - points to the local backend server
const API_BASE_URL = 'http://localhost:3001/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout
});

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`, {
      data: config.data,
      params: config.params,
    });
    return config;
  },
  (error) => {
    console.error('[API] Request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for logging
api.interceptors.response.use(
  (response) => {
    console.log(`[API] ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`, {
      data: response.data,
    });
    return response;
  },
  (error) => {
    if (error.response) {
      console.error(`[API] ${error.response.status} ${error.config.method?.toUpperCase()} ${error.config.url}`, {
        data: error.response.data,
        status: error.response.status,
        headers: error.response.headers,
      });
    } else if (error.request) {
      console.error('[API] No response received:', error.request);
    } else {
      console.error('[API] Request setup error:', error.message);
    }
    return Promise.reject(error);
  }
);

// Real implementation of download service
export const downloadService = {
  // Start download and conversion process
  async startDownload(
    urls: string[],
    quality: QualityOption
  ): Promise<{ 
    success: boolean; 
    message: string; 
    ids?: string[];
    playlists?: Array<{
      id: string;
      url: string;
      videoIds: string[];
      status: string;
      message: string;
    }>;
  }> {
    try {
      console.log(`Starting download for ${urls.length} URLs with quality ${quality}kbps`);
      
      const response = await api.post('/downloads/start', {
        urls,
        quality: parseInt(quality, 10),
      });
      
      if (!response.data || (!response.data.downloadIds && !response.data.playlists)) {
        throw new Error('Invalid response format from server');
      }
      
      return {
        success: true,
        message: response.data.playlists?.length > 0
          ? `Processing ${response.data.playlists.length} playlist(s) with ${response.data.downloadIds?.length || 0} videos`
          : `Started ${response.data.downloadIds?.length || 0} download(s)`,
        ids: response.data.downloadIds || [],
        playlists: response.data.playlists
      };
    } catch (error) {
      console.error('Error starting download:', error);
      
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to start download'
      };
    }
  },

  // Get download status for multiple items
  async getDownloadStatus(ids: string[]): Promise<DownloadProgress[]> {
    if (!ids.length) return [];
    
    try {
      const response = await api.get<Array<DownloadProgress | { id: string; error: string }>>('/downloads/status', {
        params: { ids: ids.join(',') },
        validateStatus: (status) => status < 500 // Don't throw for 4xx errors
      });
      
      if (!Array.isArray(response.data)) {
        console.error('Invalid response format from /downloads/status:', response.data);
        return [];
      }
      
      // Map the response to ensure it matches the DownloadProgress type
      return response.data.map((item) => {
        if ('error' in item) {
          // Handle error case
          return {
            id: item.id,
            status: 'error' as const,
            progress: 0,
            error: item.error
          };
        }
        return item;
      });
    } catch (error) {
      console.error('Error getting download status:', error);
      // Return an empty array to prevent UI errors
      return [];
      
      // Return the current status from local state if available
      return ids.map(id => ({
        id,
        progress: 0,
        status: 'error',
        error: 'Failed to fetch status',
      }));
    }
  },

  // Download a completed file
  async downloadFile(id: string, filename: string): Promise<void> {
    let url: string | null = null;
    let link: HTMLAnchorElement | null = null;
    
    try {
      // Use the new file download endpoint with responseType 'blob' to handle binary data
      const response = await axios({
        method: 'GET',
        url: `${API_BASE_URL}/downloads/file/${id}`,
        responseType: 'blob',
        timeout: 30000, // 30 second timeout for downloads
      });

      if (!response.data) {
        throw new Error('No data received from server');
      }
      
      // Get the content disposition header to extract the filename if available
      const contentDisposition = response.headers['content-disposition'];
      let downloadFilename = filename;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          downloadFilename = filenameMatch[1].replace(/['"]/g, '');
        }
      }
      
      // Ensure the filename has the .mp3 extension
      if (!downloadFilename.toLowerCase().endsWith('.mp3')) {
        downloadFilename = `${downloadFilename}.mp3`;
      }
      
      // Create a blob URL for the downloaded file
      const blob = new Blob([response.data], { type: response.headers['content-type'] || 'audio/mpeg' });
      url = window.URL.createObjectURL(blob);
      
      // Create and trigger the download
      link = document.createElement('a');
      link.href = url;
      link.download = downloadFilename;
      document.body.appendChild(link);
      link.click();
      
      // Log successful download
      console.log(`Successfully downloaded file: ${downloadFilename}`);
    } catch (error) {
      console.error('Error downloading file:', error);
      
      // Provide a more user-friendly error message
      let errorMessage = 'Failed to download file';
      
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          errorMessage = 'Download timed out. Please try again.';
        } else if (error.response?.status === 404) {
          errorMessage = 'File not found. It may have been deleted or expired.';
        } else if (error.response?.status === 403) {
          errorMessage = 'You do not have permission to download this file.';
        } else if (error.response?.data?.error) {
          errorMessage = error.response.data.error;
        }
      }
      
      throw new Error(errorMessage);
    } finally {
      // Clean up in case of success or error
      if (link) {
        link.remove();
      }
      if (url) {
        window.URL.revokeObjectURL(url);
      }
    }
  },
};

export default api;
