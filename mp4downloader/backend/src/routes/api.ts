import { Router, Request, Response } from 'express';
import downloadController from '../controllers/downloadController';
import { validateStartDownload } from '../middleware/validators';

export const apiRouter = Router();

// Start a new download
apiRouter.post('/downloads/start', validateStartDownload, async (req: Request, res: Response) => {
  try {
    await downloadController.startDownload(req, res);
  } catch (error) {
    console.error('Error in startDownload:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get download status
apiRouter.get('/downloads/status', async (req: Request, res: Response) => {
  try {
    await downloadController.getDownloadStatus(req, res);
  } catch (error) {
    console.error('Error in getDownloadStatus:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
