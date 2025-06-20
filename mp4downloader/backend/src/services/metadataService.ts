import * as mm from 'music-metadata';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';
import { IOptions, IAudioMetadata, ICommonTagsResult, IPicture } from 'music-metadata';

// Import node-id3 types from our custom declaration file
import 'node-id3';

interface Metadata {
  title?: string;
  artist?: string;
  album?: string;
  year?: string;
  trackNumber?: string;
  genre?: string;
  comment?: string;
  imageBuffer?: Buffer;
  mimeType?: string;
  duration?: number;
}

export class MetadataService {
  /**
   * Extracts metadata from YouTube video title
   * @param videoTitle YouTube video title (e.g., "Artist - Title (Official Video)")
   * @returns Object with extracted artist and title
   */
  static extractFromTitle(videoTitle: string): { artist: string; title: string } {
    // Common patterns for YouTube video titles
    const patterns = [
      // Artist - Title (Official Video)
      /^(?<artist>[^-]+?)\s*-\s*(?<title>[^(]+?)(?:\s*\([^)]*\))*\s*$/,
      // Artist "Title" (Official Video)
      /^(?<artist>[^"]+?)\s*"(?<title>[^"]+)"(?:\s*\([^)]*\))*\s*$/,
      // [Official Video] Artist - Title
      /^(?:\[.*?\]\s*)?(?<artist>[^-]+?)\s*-\s*(?<title>.+?)(?:\s*\([^)]*\))*\s*$/,
    ];

    // Try each pattern until we find a match
    for (const pattern of patterns) {
      const match = videoTitle.match(pattern);
      if (match?.groups) {
        return {
          artist: match.groups.artist.trim(),
          title: match.groups.title.trim(),
        };
      }
    }

    // If no pattern matched, return the whole title as the title
    return {
      artist: 'Unknown Artist',
      title: videoTitle.trim(),
    };
  }

  /**
   * Writes ID3 tags to an MP3 file using music-metadata
   * @param filePath Path to the MP3 file
   * @param metadata Metadata to write
   */
  static async writeTags(filePath: string, metadata: Metadata): Promise<boolean> {
    try {
      logger.info(`[MetadataService] Starting to write tags to: ${filePath}`);
      logger.info(`[MetadataService] Metadata to write:`, {
        title: metadata.title,
        artist: metadata.artist,
        album: metadata.album,
        hasImage: !!metadata.imageBuffer
      });

      // Check if file exists and is accessible
      try {
        await fs.access(filePath, fsSync.constants.R_OK | fsSync.constants.W_OK);
        const stats = await fs.stat(filePath);
        logger.info(`[MetadataService] File exists and is accessible. Size: ${stats.size} bytes`);
      } catch (error) {
        const errorMsg = `File access error for ${filePath}: ${error instanceof Error ? error.message : String(error)}`;
        logger.error(errorMsg);
        throw new Error(errorMsg);
      }

      // Read existing metadata
      let existingMetadata: IAudioMetadata;
      try {
        existingMetadata = await mm.parseFile(filePath);
      } catch (error) {
        logger.warn(`Could not read existing metadata from ${path.basename(filePath)}:`, error);
        // Create a minimal metadata object with required properties
        existingMetadata = {
          format: { 
            tagTypes: [], 
            duration: 0, 
            bitrate: 0, 
            sampleRate: 0, 
            bitsPerSample: 0, 
            codec: '', 
            codecProfile: '' 
          },
          native: {},
          quality: { warnings: [] },
          common: {
            track: { no: 0, of: 0 },
            disk: { no: 0, of: 0 },
            movementIndex: {},
            comment: []
          },
          chapters: []
        } as unknown as IAudioMetadata; // Type assertion to handle the complex type
      }

      // Prepare common tags
      const commonTags: any = {
        ...(existingMetadata.common || {}),
        title: metadata.title || existingMetadata.common?.title,
        artist: metadata.artist || existingMetadata.common?.artist,
        album: metadata.album || existingMetadata.common?.album || 'Unknown Album',
        year: metadata.year ? parseInt(metadata.year, 10) : existingMetadata.common?.year,
        track: metadata.trackNumber 
          ? { no: parseInt(metadata.trackNumber, 10), of: null } 
          : existingMetadata.common?.track,
        genre: metadata.genre 
          ? [metadata.genre] 
          : existingMetadata.common?.genre || ['Unknown Genre'],
        comment: [
          ...(Array.isArray(existingMetadata.common?.comment) 
            ? existingMetadata.common.comment 
            : []),
          ...(metadata.comment ? [{ text: metadata.comment }] : []),
          { text: `Source: ${metadata.comment || 'Unknown'}` }
        ],
        encodedby: 'MP3 Downloader'
      };

      // Prepare picture (album art)
      let picture: IPicture[] | undefined = existingMetadata.common?.picture;
      if (metadata.imageBuffer && metadata.mimeType) {
        picture = [{
          format: metadata.mimeType,
          type: 'Cover (front)',
          description: 'Cover',
          data: metadata.imageBuffer
        }];
      }

      try {
        logger.info(`Writing tags to ${path.basename(filePath)}`, {
          title: commonTags.title,
          artist: commonTags.artist,
          album: commonTags.album,
          hasImage: !!picture?.length
        });

        // Use node-id3 as a fallback since music-metadata v7 doesn't support writing tags directly
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const NodeID3 = require('node-id3');
        
        // Prepare comments text
        let commentText = '';
        if (Array.isArray(commonTags.comment)) {
          commentText = commonTags.comment
            .map((c: any) => typeof c === 'string' ? c : c.text || '')
            .filter(Boolean)
            .join('\n');
        } else if (commonTags.comment) {
          commentText = typeof commonTags.comment === 'string' 
            ? commonTags.comment 
            : commonTags.comment.text || '';
        }
        
        logger.info('[MetadataService] Prepared comment text:', { 
          commentLength: commentText.length,
          preview: commentText.length > 100 ? commentText.substring(0, 100) + '...' : commentText
        });
        
        const tags: any = {
          title: commonTags.title,
          artist: commonTags.artist,
          album: commonTags.album,
          year: commonTags.year?.toString(),
          trackNumber: commonTags.track?.no?.toString(),
          genre: Array.isArray(commonTags.genre) ? commonTags.genre[0] : commonTags.genre,
          comment: {
            language: 'eng',
            text: commentText
          }
        };
        
        // Add image if available
        if (picture?.[0]?.data) {
          tags.image = {
            mime: picture[0].format || 'image/jpeg',
            type: { id: 3, name: 'front cover' },
            description: picture[0].description || 'Cover',
            imageBuffer: picture[0].data
          };
        }
        
        // Write the tags
        try {
          logger.info('[MetadataService] Writing tags with NodeID3:', {
            filePath,
            tags: {
              title: tags.title,
              artist: tags.artist,
              album: tags.album,
              hasImage: !!tags.image,
              commentLength: tags.comment?.text?.length || 0
            }
          });
          
          // Make a backup of the file before writing
          const backupPath = `${filePath}.bak`;
          await fs.copyFile(filePath, backupPath);
          logger.info(`[MetadataService] Created backup at: ${backupPath}`);
          
          try {
            // Use the synchronous version of NodeID3.write for better reliability
            const success = NodeID3.write(tags, filePath);
            
            if (success) {
              logger.info('[MetadataService] Successfully wrote tags using NodeID3');
              
              // Verify the tags were written by reading them back
              try {
                const readTags = NodeID3.read(filePath);
                logger.info('[MetadataService] Successfully read back tags:', {
                  title: readTags.title,
                  artist: readTags.artist,
                  album: readTags.album,
                  hasImage: !!readTags.image
                });
                
                // Clean up backup
                await fs.unlink(backupPath).catch(e => 
                  logger.warn(`[MetadataService] Failed to remove backup: ${e}`)
                );
                
                return true;
              } catch (verifyError) {
                logger.error('[MetadataService] Failed to verify written tags:', verifyError);
                // Restore from backup
                await fs.rename(backupPath, filePath);
                return false;
              }
            } else {
              logger.error('[MetadataService] NodeID3.write returned false, tags may not have been written');
              // Restore from backup
              await fs.rename(backupPath, filePath);
              return false;
            }
          } catch (writeError) {
            logger.error('[MetadataService] Error in NodeID3.write:', writeError);
            // Restore from backup if possible
            await fs.rename(backupPath, filePath).catch(e => 
              logger.error('[MetadataService] Failed to restore from backup:', e)
            );
            return false;
          }
        } catch (writeError) {
          logger.error('Error in NodeID3.write:', writeError);
          return false;
        }
        
      } catch (writeError) {
        logger.error(`Failed to write tags to ${path.basename(filePath)}:`, writeError);
        return false;
      }
    } catch (error) {
      logger.error(`Error writing tags to ${path.basename(filePath)}:`, error);
      return false;
    }
  }

  /**
   * Extracts metadata from a file
   * @param filePath Path to the MP3 file
   * @returns Extracted metadata
   */
  static readTags(filePath: string): any {
    try {
      // Check if file exists using fsSync.existsSync
      if (!fsSync.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }
      
      // Use node-id3 to read tags
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const NodeID3 = require('node-id3');
      const tags = NodeID3.read(filePath);
      return tags;
    } catch (error) {
      logger.error(`Error reading tags from ${path.basename(filePath)}:`, error);
      return null;
    }
  }
}

export default MetadataService;
