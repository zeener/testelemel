import axios from 'axios';
import { type DownloadProgress, type QualityOption } from '../types';

// Base URL for the API - points to the local backend server
const API_BASE_URL = 'http://localhost:3001/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 second timeout
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
  ): Promise<{ success: boolean; message: string; ids?: string[] }> {
    try {
      console.log(`Starting download for ${urls.length} URLs with quality ${quality}kbps`);
      
      const response = await api.post('/downloads/start', {
        urls,
        quality: parseInt(quality, 10),
      });
      
      if (!response.data || !response.data.downloadIds || !Array.isArray(response.data.downloadIds)) {
        throw new Error('Invalid response format from server');
      }
      
      return {
        success: true,
        message: 'Download started successfully',
        ids: response.data.downloadIds, // Ensure we're using downloadIds from the response
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
      // Fetch the file as a blob
      const response = await api.get(`/downloads/${id}/file`, {
        responseType: 'blob',
        validateStatus: (status) => status < 500, // Don't throw for 4xx errors
        timeout: 30000, // 30 second timeout for downloads
      });
      
      if (!response.data) {
        throw new Error('No data received from server');
      }
      
      // Create a blob URL for the downloaded file
      url = window.URL.createObjectURL(new Blob([response.data]));
      
      // Create and trigger the download
      link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename.endsWith('.mp3') ? filename : `${filename}.mp3`);
      document.body.appendChild(link);
      link.click();
      
      // Log successful download
      console.log(`Successfully downloaded file: ${filename}`);
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
        } else if (error.response?.data?.message) {
          errorMessage = error.response.data.message;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      throw new Error(errorMessage);
    } finally {
      // Clean up resources
      if (link && link.parentNode) {
        link.parentNode.removeChild(link);
      }
      if (url) {
        window.URL.revokeObjectURL(url);
      }
    }
  },
};

export default api;
