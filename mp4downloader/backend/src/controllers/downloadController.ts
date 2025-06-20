import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs-extra';
import { exec } from 'youtube-dl-exec';
import { logger } from '../utils/logger';
import { spawn } from 'child_process';
import { promisify } from 'util';
import { Readable } from 'stream';

const execPromise = promisify(require('child_process').exec);

interface DownloadInfo {
  id: string;
  url: string;
  quality: number;
  status: 'pending' | 'downloading' | 'converting' | 'completed' | 'error';
  progress: number;
  outputPath: string;
  startTime: Date;
  lastUpdated: Date;
  error?: string;
  size?: number;
  duration?: number;
  title?: string;
}

// In-memory store for downloads (in a real app, use a database)
const downloads = new Map<string, any>();
const DOWNLOAD_DIR = path.join(process.cwd(), 'downloads');

// Ensure download directory exists
fs.ensureDirSync(DOWNLOAD_DIR);

export const downloadController = {
  startDownload: async function(req: Request, res: Response) {
    try {
      const { urls, quality } = req.body;
      logger.info('Starting download request', { urls, quality });
      const downloadIds: string[] = [];
      const controller = this; // Store reference to 'this'

      for (const url of urls) {
        const downloadId = uuidv4();
        const outputPath = path.join(DOWNLOAD_DIR, `${downloadId}.mp3`);
        
        // Store download info
        const downloadInfo = {
          id: downloadId,
          url,
          quality,
          status: 'downloading',
          progress: 0,
          outputPath,
          startTime: new Date(),
          lastUpdated: new Date(),
        };

        downloads.set(downloadId, downloadInfo);
        downloadIds.push(downloadId);

        // Start download in background
        // Use the stored reference to 'this' to call processDownload
        controller.processDownload(downloadId, url, quality, outputPath);
      }

      res.status(202).json({
        success: true,
        message: 'Download started',
        ids: downloadIds,
      });
    } catch (error) {
      logger.error('Error starting download:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to start download',
      });
    }
  },

  async getDownloadStatus(req: Request, res: Response) {
    try {
      const { ids } = req.query;
      const idList = typeof ids === 'string' ? ids.split(',') : [];
      
      if (idList.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No download IDs provided',
        });
      }

      const statuses = idList
        .filter((id: string) => downloads.has(id))
        .map((id: string) => {
          const info = downloads.get(id);
          return {
            id: info.id,
            status: info.status,
            progress: info.progress,
            error: info.error,
            size: info.size,
            duration: info.duration,
            title: info.title,
            lastUpdated: info.lastUpdated,
          };
        });

      res.json(statuses);
    } catch (error) {
      logger.error('Error getting download status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get download status',
      });
    }
  },

  async downloadFile(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const download = downloads.get(id);

      if (!download) {
        return res.status(404).json({
          success: false,
          message: 'Download not found',
        });
      }

      if (download.status !== 'completed') {
        return res.status(400).json({
          success: false,
          message: 'Download not completed yet',
        });
      }

      if (!fs.existsSync(download.outputPath)) {
        return res.status(404).json({
          success: false,
          message: 'File not found',
        });
      }

      const filename = path.basename(download.outputPath);
      res.download(download.outputPath, filename, (err) => {
        if (err) {
          logger.error('Error sending file:', err);
        }
      });
    } catch (error) {
      logger.error('Error downloading file:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to download file',
      });
    }
  },

  async processDownload(
    downloadId: string,
    url: string,
    quality: number,
    outputPath: string
  ): Promise<void> {
    const download = downloads.get(downloadId) as DownloadInfo | undefined;
    if (!download) return;

    try {
      logger.info(`Starting download for ${url}`);
      
      // Get video info first using yt-dlp directly
      const { stdout: infoJson } = await execPromise(`yt-dlp --dump-json "${url}"`);
      const videoInfo = JSON.parse(infoJson);
      
      // Update with video info
      download.title = videoInfo.title || 'Unknown';
      download.duration = videoInfo.duration;
      download.status = 'downloading';
      download.lastUpdated = new Date();
      
      logger.info(`Found video: ${download.title} (${download.duration}s)`);

      // Start the actual download
      await new Promise<void>((resolve, reject) => {
        const downloadProcess = spawn('yt-dlp', [
          '--extract-audio',
          '--audio-format', 'mp3',
          '--audio-quality', '0',
          '--output', outputPath,
          '--no-warnings',
          '--prefer-free-formats',
          '--newline',
          url
        ]);

        downloadProcess.stdout.on('data', (data) => {
          logger.debug(`[yt-dlp] ${data}`);
        });

        downloadProcess.stderr.on('data', (data) => {
          logger.error(`[yt-dlp error] ${data}`);
        });

        downloadProcess.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`yt-dlp process exited with code ${code}`));
          }
        });
      });

      // Update status
      download.status = 'completed';
      download.progress = 100;
      download.size = fs.statSync(outputPath).size;
      download.lastUpdated = new Date();
      
      logger.info(`Download completed: ${download.title} (${download.size} bytes)`);
    } catch (error) {
      logger.error(`Download failed for ${url}:`, error);
      
      const download = downloads.get(downloadId);
      if (download) {
        download.status = 'error';
        download.error = error instanceof Error ? error.message : 'Download failed';
        download.lastUpdated = new Date();
      }
    }
  },
};
