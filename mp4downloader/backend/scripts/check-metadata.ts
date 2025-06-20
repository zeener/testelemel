import * as path from 'path';
import { fileURLToPath } from 'url';
import MetadataService from '../src/services/metadataService';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the downloaded MP3 file
const mp3Path = path.join(__dirname, '..', 'downloads', 'af2f5fad-ca29-4ccf-9e9d-ba783266b47b.mp3');

async function checkMetadata() {
  try {
    console.log('Checking metadata for:', mp3Path);
    
    // Read the metadata
    const metadata = MetadataService.readTags(mp3Path);
    console.log('Metadata:', JSON.stringify(metadata, null, 2));
    
    return true;
  } catch (error) {
    console.error('Error checking metadata:', error);
    return false;
  }
}

// Run the check
checkMetadata()
  .then((success) => {
    console.log(`Metadata check ${success ? 'succeeded' : 'failed'}`);
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Unhandled error in metadata check:', error);
    process.exit(1);
  });
