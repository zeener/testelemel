import { Request, Response } from 'express';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger';
import { MetadataService } from '../services/metadataService';

const execPromise = promisify(exec);

interface DownloadInfo {
  id: string;
  url: string;
  status: 'queued' | 'downloading' | 'completed' | 'error';
  progress: number;
  title?: string;
  outputPath?: string;
  error?: string;
  lastUpdated: Date;
  size?: number;
  metadata?: {
    title: string;
    artist: string;
    album: string;
    year: string;
    genre: string;
    comment: string;
    duration: number;
  };
}

interface VideoInfo {
  title: string;
  uploader?: string;
  webpage_url?: string;
  duration?: number;
  upload_date?: string;
  categories?: string[];
}

export class DownloadController {
  private downloads: Map<string, DownloadInfo>;
  private downloadProcesses: Map<string, ChildProcess>;
  private downloadsDir: string;
  private metadataService: MetadataService;

  constructor() {
    this.downloads = new Map();
    this.downloadProcesses = new Map();
    this.downloadsDir = path.join(__dirname, '../../downloads');
    this.metadataService = new MetadataService();
    
    // Ensure downloads directory exists
    fs.ensureDirSync(this.downloadsDir);
  }

  public async startDownload(req: Request, res: Response): Promise<void> {
    try {
      const { urls, quality = 192 } = req.body as { urls?: string[]; quality?: number };
      
      if (!urls || !Array.isArray(urls) || urls.length === 0) {
        res.status(400).json({ error: 'At least one URL is required' });
        return;
      }

      const downloadIds = [];
      
      // Process each URL in the array
      for (const url of urls) {
        const downloadId = uuidv4();
        const downloadInfo: DownloadInfo = {
          id: downloadId,
          url,
          status: 'queued',
          progress: 0,
          lastUpdated: new Date()
        };

        this.downloads.set(downloadId, downloadInfo);
        downloadIds.push(downloadId);
        
        // Start processing in the background
        this.processDownload(downloadId, url, quality || 192)
          .catch(error => {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Error in processDownload:', errorMessage);
            const failedDownload = this.downloads.get(downloadId);
            if (failedDownload) {
              failedDownload.status = 'error';
              failedDownload.error = errorMessage;
              failedDownload.lastUpdated = new Date();
            }
          });
      }

      res.status(202).json({
        downloadIds,
        status: 'queued',
        message: `Started ${urls.length} download(s)`
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error starting download:', errorMessage);
      res.status(500).json({ error: 'Failed to start download', details: errorMessage });
    }
  }

  public async getDownloadStatus(req: Request, res: Response): Promise<void> {
    try {
      const statuses = Array.from(this.downloads.entries()).map(([id, download]) => ({
        id: download.id,
        url: download.url,
        status: download.status,
        progress: download.progress,
        title: download.title,
        filePath: download.status === 'completed' && download.outputPath 
          ? path.relative(process.cwd(), download.outputPath) 
          : undefined,
        lastUpdated: download.lastUpdated,
        size: download.size,
        error: download.error
      }));

      res.json(statuses);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error getting download status:', errorMessage);
      res.status(500).json({ error: 'Failed to get download status', details: errorMessage });
    }
  }

  private async getVideoInfo(url: string): Promise<VideoInfo> {
    try {
      const { stdout } = await execPromise(`yt-dlp --dump-json --no-warnings ${url}`);
      return JSON.parse(stdout) as VideoInfo;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error getting video info:', errorMessage);
      throw new Error('Could not fetch video information');
    }
  }

  private async processDownload(downloadId: string, url: string, quality: number): Promise<void> {
    const download = this.downloads.get(downloadId);
    if (!download) {
      throw new Error('Download not found');
    }
    
    try {
      // Update status to downloading
      download.status = 'downloading';
      download.progress = 10;
      download.lastUpdated = new Date();
      
      // Set output paths - use UUID as the filename during processing
      const tempDirPath = path.join(os.tmpdir(), 'yt-dlp-downloads');
      await fs.ensureDir(tempDirPath);
      
      const tempOutputFilePath = path.join(tempDirPath, `${downloadId}.mp3`);
      const sanitizedTitle = download.title ? 
        download.title.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_').toLowerCase() : 
        `${downloadId}`;
      const finalOutputPath = path.join(this.downloadsDir, `${sanitizedTitle}.mp3`);
      
      // Update download object with paths
      download.outputPath = finalOutputPath;

      // Build yt-dlp command to get video info
      const infoArgs = [
        '--dump-json',
        '--no-warnings',
        '--quiet',
        download.url
      ];

      // Update download status
      download.status = 'downloading';
      download.lastUpdated = new Date();
      download.progress = 0;

      try {
        // Get video info first to get the title
        const info = await this.getVideoInfo(url);
        if (!info.title) {
          throw new Error('Could not get video title');
        }

        // Sanitize the title for use in filenames
        const sanitizedTitle = info.title.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
        const outputFilename = `${sanitizedTitle}.mp3`;
        const outputPath = path.join(this.downloadsDir, outputFilename);

        // Update download info with title and output path
        download.title = info.title;
        download.outputPath = outputPath;
        download.lastUpdated = new Date();

        // Prepare yt-dlp arguments
        const args: string[] = [
          '--extract-audio',
          '--audio-format', 'mp3',
          '--audio-quality', quality.toString(),
          '--output', outputPath,
          '--no-mtime',
          '--no-playlist',
          '--add-metadata',
          '--embed-thumbnail',
          '--parse-metadata', 'title:%(title)s',
          '--parse-metadata', 'artist:%(uploader)s',
          '--parse-metadata', 'album:%(title)s',
          '--parse-metadata', 'comment:%(webpage_url)s',
          url
        ];

        // Start the download process
        const ytdlp = spawn('yt-dlp', args);

        // Store the process reference for potential cancellation
        this.downloadProcesses.set(downloadId, ytdlp);

        // Handle process events
        if (ytdlp.stdout) {
          ytdlp.stdout.on('data', (data: Buffer) => {
            const output = data.toString();
            // Parse progress if possible
            const progressMatch = output.match(/\[download\]\s+(\d+\.?\d*)%/);
            if (progressMatch) {
              download.progress = parseFloat(progressMatch[1]);
              download.lastUpdated = new Date();
            }
          });
        }

        if (ytdlp.stderr) {
          ytdlp.stderr.on('data', (data: Buffer) => {
            logger.error(`yt-dlp stderr: ${data.toString()}`);
          });
        }

        // Handle process completion
        return new Promise<void>((resolve, reject) => {
          const onClose = async (code: number | null) => {
            this.downloadProcesses.delete(downloadId);

            if (code !== 0) {
              const error = new Error(`yt-dlp process exited with code ${code}`);
              logger.error(error.message);
              
              download.status = 'error';
              download.error = error.message;
              download.lastUpdated = new Date();
              
              return reject(error);
            }

            try {
              // Verify the file was created
              if (!download.outputPath || !fs.existsSync(download.outputPath)) {
                throw new Error('Output file was not created');
              }

              // Get file stats
              const stats = await fs.promises.stat(download.outputPath);
              if (stats.size === 0) {
                await fs.promises.unlink(download.outputPath);
                throw new Error('Downloaded file is empty');
              }

              // Set metadata
              download.metadata = {
                title: info.title || 'Unknown Title',
                artist: info.uploader || 'Unknown Artist',
                album: info.title || 'Unknown Album',
                year: info.upload_date ? info.upload_date.substring(0, 4) : new Date().getFullYear().toString(),
                genre: info.categories ? info.categories[0] || 'Unknown' : 'Unknown',
                comment: info.webpage_url || '',
                duration: info.duration || 0
              };

              // Write metadata using MetadataService
              try {
                await MetadataService.writeTags(download.outputPath, {
                  title: download.metadata.title,
                  artist: download.metadata.artist,
                  album: download.metadata.album,
                  year: download.metadata.year,
                  genre: download.metadata.genre,
                  comment: download.metadata.comment,
                  duration: download.metadata.duration
                });
                logger.info(`Successfully wrote metadata to ${download.outputPath}`);
              } catch (metadataError) {
                logger.error(`Failed to write metadata: ${metadataError instanceof Error ? metadataError.message : 'Unknown error'}`);
                // Don't fail the download if metadata writing fails
              }

              // Update download info
              download.status = 'completed';
              download.progress = 100;
              download.size = stats.size;
              download.lastUpdated = new Date();

              resolve();
            } catch (error) {
              if (download.outputPath && fs.existsSync(download.outputPath)) {
                await fs.promises.unlink(download.outputPath).catch(() => {
                  // Ignore errors during cleanup
                });
              }
              
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              download.status = 'error';
              download.error = errorMessage;
              download.lastUpdated = new Date();
              
              reject(new Error(errorMessage));
            }
          };

          ytdlp.on('close', onClose);
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Download failed for ${url}:`, error);
        
        // Clean up partially downloaded file if it exists
        if (download.outputPath && fs.existsSync(download.outputPath)) {
          try {
            fs.unlinkSync(download.outputPath);
            logger.debug(`Cleaned up partially downloaded file: ${download.outputPath}`);
          } catch (cleanupError) {
            const cleanupErrorMessage = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
            logger.error(`Failed to clean up file ${download.outputPath}:`, cleanupErrorMessage);
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error processing download:', error);
      
      // Update download status to error
      const failedDownload = this.downloads.get(downloadId);
      if (failedDownload) {
        failedDownload.status = 'error';
        failedDownload.error = errorMessage;
        failedDownload.lastUpdated = new Date();
      }
    }
  }

  // Handle file download
  public async downloadFile(req: Request, res: Response): Promise<void> {
    let fileStream: fs.ReadStream | null = null;
    
    try {
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: 'Download ID is required' });
        return;
      }

      logger.info(`Starting file download for ID: ${id}`);
      
      const download = this.downloads.get(id);
      if (!download || download.status !== 'completed' || !download.outputPath) {
        const errorMsg = 'File not found or not ready for download';
        logger.warn(errorMsg, { id, status: download?.status, hasPath: !!download?.outputPath });
        res.status(404).json({ error: errorMsg });
        return;
      }

      logger.info(`File path: ${download.outputPath}`);
      
      if (!fs.existsSync(download.outputPath)) {
        const errorMsg = `File not found on server at path: ${download.outputPath}`;
        logger.error(errorMsg);
        res.status(404).json({ error: 'File not found on server' });
        return;
      }

      const stats = await fs.promises.stat(download.outputPath);
      const filename = path.basename(download.outputPath);
      
      logger.info(`Sending file: ${filename}, size: ${stats.size} bytes`);
      
      // Set appropriate headers
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', stats.size);
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      fileStream = fs.createReadStream(download.outputPath);
      
      fileStream.on('error', (error: Error) => {
        logger.error('Error streaming file:', { 
          error: error.message, 
          stack: error.stack,
          path: download.outputPath,
          exists: fs.existsSync(download.outputPath!)
        });
        
        if (!res.headersSent) {
          res.status(500).json({ 
            error: 'Error streaming file',
            details: error.message
          });
        }
      });
      
      fileStream.on('open', () => {
        logger.info(`File stream opened for: ${filename}`);
      });
      
      fileStream.on('end', () => {
        logger.info(`File stream ended for: ${filename}`);
      });
      
      req.on('close', () => {
        logger.info(`Request closed for file: ${filename}`);
        if (fileStream) {
          fileStream.destroy();
        }
      });
      
      // Pipe the file to the response
      fileStream.pipe(res);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      logger.error('Error in downloadFile:', { 
        error: errorMessage,
        stack: errorStack,
        id: req.params.id
      });
      
      // Clean up the file stream if it was created
      if (fileStream) {
        fileStream.destroy();
      }
      
      if (!res.headersSent) {
        res.status(500).json({ 
          error: 'Internal server error', 
          details: errorMessage 
        });
      }
    }
  }
}

const downloadController = new DownloadController();
export default downloadController;
