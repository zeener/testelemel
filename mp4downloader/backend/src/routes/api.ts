import { Router } from 'express';
import { downloadController } from '../controllers/downloadController';
import { validateStartDownload } from '../middleware/validators';

export const apiRouter = Router();

// Start a new download
apiRouter.post('/downloads/start', validateStartDownload, downloadController.startDownload);

// Get download status
apiRouter.get('/downloads/status', downloadController.getDownloadStatus);

// Download a file
apiRouter.get('/downloads/:id/file', downloadController.downloadFile);
