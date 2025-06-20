import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs-extra';
import { spawn } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger';

const execPromise = promisify(require('child_process').exec);

type DownloadStatus = 'pending' | 'downloading' | 'converting' | 'completed' | 'error';

interface DownloadInfo {
  id: string;
  url: string;
  quality: number;
  status: DownloadStatus;
  progress: number;
  outputPath: string;
  startTime: Date;
  lastUpdated: Date;
  error?: string;
  size?: number;
  duration?: number;
  title?: string;
}

class DownloadController {
  private downloads = new Map<string, DownloadInfo>();
  private downloadDir: string;
  
  constructor() {
    this.downloadDir = path.join(process.cwd(), 'downloads');
    fs.ensureDirSync(this.downloadDir);
    
    // Bind methods
    this.startDownload = this.startDownload.bind(this);
    this.getDownloadStatus = this.getDownloadStatus.bind(this);
    this.processDownload = this.processDownload.bind(this);
  }

  public async startDownload(req: Request, res: Response): Promise<Response> {
    try {
      const { urls, quality = 0 } = req.body;
      logger.info('Starting download request', { urls, quality });
      
      if (!urls || !Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({ error: 'At least one URL is required' });
      }

      const downloadIds: string[] = [];

      for (const url of urls) {
        const downloadId = uuidv4();
        const outputPath = path.join(this.downloadDir, `${downloadId}.mp3`);
        
        const downloadInfo: DownloadInfo = {
          id: downloadId,
          url,
          quality,
          status: 'pending',
          progress: 0,
          outputPath,
          startTime: new Date(),
          lastUpdated: new Date(),
        };

        this.downloads.set(downloadId, downloadInfo);
        downloadIds.push(downloadId);

        // Start download in background
        this.processDownload(downloadId, url, quality, outputPath).catch(error => {
          logger.error(`Background download failed for ${url}:`, error);
        });
      }

      return res.status(202).json({ 
        message: 'Download started', 
        downloadIds 
      });
    } catch (error) {
      logger.error('Error starting download:', error);
      return res.status(500).json({ 
        error: 'Failed to start download',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  public async getDownloadStatus(req: Request, res: Response): Promise<Response> {
    try {
      const { ids } = req.query;
      const idList = typeof ids === 'string' ? ids.split(',') : [];
      
      if (idList.length === 0) {
        return res.status(400).json({ error: 'At least one download ID is required' });
      }

      const results = idList.map(id => {
        const download = this.downloads.get(id);
        return download ? {
          id: download.id,
          url: download.url,
          status: download.status,
          progress: download.progress,
          error: download.error,
          size: download.size,
          duration: download.duration,
          title: download.title,
          startTime: download.startTime,
          lastUpdated: download.lastUpdated
        } : { id, error: 'Download not found' };
      });

      return res.json(results);
    } catch (error) {
      logger.error('Error getting download status:', error);
      return res.status(500).json({ 
        error: 'Failed to get download status',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async processDownload(
    downloadId: string,
    url: string,
    quality: number,
    outputPath: string
  ): Promise<void> {
    const download = this.downloads.get(downloadId);
    if (!download) {
      logger.error(`Download with ID ${downloadId} not found`);
      return;
    }

    try {
      // Update status to downloading
      download.status = 'downloading';
      download.progress = 0;
      download.lastUpdated = new Date();
      logger.info(`Starting download for ${url}`);

      // Get video info using yt-dlp
      const { stdout: infoJson } = await execPromise(`yt-dlp --dump-json "${url}"`);
      const videoInfo = JSON.parse(infoJson);
      
      // Update with video info
      download.title = videoInfo.title || 'Unknown';
      download.duration = videoInfo.duration;
      download.lastUpdated = new Date();
      
      logger.info(`Found video: ${download.title} (${download.duration}s)`);

      // Start the download
      await new Promise<void>((resolve, reject) => {
        const args = [
          '--extract-audio',
          '--audio-format', 'mp3',
          '--audio-quality', '0',
          '--output', outputPath,
          '--no-warnings',
          '--prefer-free-formats',
          '--newline',
          '--no-cache-dir',
          '--no-part',
          '--no-mtime',
          '--no-check-certificate',
          '--force-ipv4',
          '--socket-timeout', '30',
          '--source-address', '0.0.0.0',
          '--no-call-home',
          '--no-playlist',
          url
        ];
        
        logger.debug(`Executing: yt-dlp ${args.join(' ')}`);
        
        const downloadProcess = spawn('yt-dlp', args, {
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: false
        });

        let stderrData = '';

        downloadProcess.stdout.on('data', (data) => {
          const output = data.toString().trim();
          logger.debug(`[yt-dlp] ${output}`);
          
          // Update progress if available
          if (output.includes('%')) {
            const match = output.match(/(\d+\.?\d*)%/);
            if (match) {
              const progress = parseFloat(match[1]);
              download.progress = Math.min(99, Math.max(0, progress));
              download.lastUpdated = new Date();
            }
          }
        });

        downloadProcess.stderr.on('data', (data) => {
          const errorOutput = data.toString().trim();
          stderrData += errorOutput + '\n';
          logger.error(`[yt-dlp error] ${errorOutput}`);
        });

        downloadProcess.on('error', (error) => {
          logger.error('Failed to start download process:', error);
          reject(new Error(`Failed to start download process: ${error.message}`));
        });

        downloadProcess.on('close', (code) => {
          if (code === 0) {
            logger.info(`Download process completed successfully for: ${download.title}`);
            resolve();
          } else {
            const errorMessage = `yt-dlp process exited with code ${code}`;
            logger.error(`${errorMessage}. Stderr: ${stderrData}`);
            reject(new Error(`${errorMessage}. ${stderrData || 'No error details available'}`));
          }
        });
      });

      // Verify the file was created
      if (!fs.existsSync(outputPath)) {
        throw new Error(`Download completed but output file not found at ${outputPath}`);
      }
      
      const stats = fs.statSync(outputPath);
      if (stats.size === 0) {
        fs.unlinkSync(outputPath); // Clean up empty file
        throw new Error('Downloaded file is empty');
      }

      // Update status to completed
      download.status = 'completed';
      download.progress = 100;
      download.size = stats.size;
      download.lastUpdated = new Date();
      
      logger.info(`Download completed: ${download.title} (${download.size} bytes)`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Download failed for ${url}:`, error);
      
      // Clean up partially downloaded file if it exists
      if (fs.existsSync(outputPath)) {
        try {
          fs.unlinkSync(outputPath);
          logger.debug(`Cleaned up partially downloaded file: ${outputPath}`);
        } catch (cleanupError) {
          logger.error(`Failed to clean up file ${outputPath}:`, cleanupError);
        }
      }
      
      // Update download status to error
      const failedDownload = this.downloads.get(downloadId);
      if (failedDownload) {
        failedDownload.status = 'error';
        failedDownload.error = errorMessage;
        failedDownload.lastUpdated = new Date();
      }
    }
  }
}

const downloadController = new DownloadController();
export default downloadController;
