import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import MetadataService from '../src/services/metadataService';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a test MP3 file path (you may need to adjust this)
const testMp3Path = path.join(__dirname, '..', 'test.mp3');
const testOutputPath = path.join(__dirname, '..', 'test-with-metadata.mp3');

async function testMetadataWriting() {
  try {
    console.log('Testing metadata writing...');
    
    // Copy the test file to avoid modifying the original
    await fs.copyFile(testMp3Path, testOutputPath);
    
    // Test metadata
    const testMetadata = {
      title: 'Test Title',
      artist: 'Test Artist',
      album: 'Test Album',
      year: '2023',
      trackNumber: '1',
      genre: 'Test Genre',
      comment: 'Test Comment',
      duration: 180, // 3 minutes in seconds
    };
    
    console.log('Writing metadata...');
    const result = await MetadataService.writeTags(testOutputPath, testMetadata);
    
    if (result) {
      console.log('Successfully wrote metadata');
      
      // Read back the metadata to verify
      console.log('Reading back metadata...');
      const readMetadata = MetadataService.readTags(testOutputPath);
      console.log('Read metadata:', readMetadata);
      
      console.log('Test completed successfully!');
      return true;
    } else {
      console.error('Failed to write metadata');
      return false;
    }
  } catch (error) {
    console.error('Error during metadata test:', error);
    return false;
  }
}

// Run the test
testMetadataWriting()
  .then((success) => {
    console.log(`Test ${success ? 'succeeded' : 'failed'}`);
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Unhandled error in test:', error);
    process.exit(1);
  });
