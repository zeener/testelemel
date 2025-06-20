import { useState, useEffect, useCallback, useRef } from 'react';
import { ChakraProvider, Container, Box, VStack, Text, useToast } from '@chakra-ui/react';
import type { FC } from 'react';

// Types
import type { DownloadItem, QualityOption } from './types';

// Services
import { downloadService } from './services/api';

// Components
import InputArea from './components/InputArea/InputArea';
import { DownloadList } from './components/DownloadList';
import StatusBar from './components/StatusBar/StatusBar';

const App: FC = () => {
  const [downloadItems, setDownloadItems] = useState<DownloadItem[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const toast = useToast();
  const pollingIntervalRef = useRef<number | null>(null);

  // Poll for download status updates
  useEffect(() => {
    const pollStatus = async () => {
      const activeDownloads = downloadItems.filter(
        (item) => item.status === 'downloading' || item.status === 'converting'
      );

      if (activeDownloads.length === 0) return;

      try {
        const statuses = await downloadService.getDownloadStatus(
          activeDownloads.map((item) => item.id)
        );

        setDownloadItems((prevItems) =>
          prevItems.map((item) => {
            const status = statuses.find((s) => s.id === item.id);
            if (!status) return item;

            return {
              ...item,
              ...status,
              ...(status.size && { size: status.size }),
              ...(status.duration && { duration: status.duration }),
            };
          })
        );
      } catch (error) {
        console.error('Error polling download status:', error);
      }
    };

    // Poll every 2 seconds
    pollingIntervalRef.current = window.setInterval(pollStatus, 2000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [downloadItems]);

  // Handle starting new downloads
  const handleDownloadStart = useCallback(
    async (items: { url: string; quality: QualityOption }[]) => {
      if (items.length === 0) return;
      
      // For now, we'll just process the first item to match the existing implementation
      // In the future, we can enhance this to handle multiple downloads
      const { url, quality } = items[0];
      
      setIsDownloading(true);

      // Create a new download item
      const newItem: DownloadItem = {
        id: `temp-${Date.now()}`,
        url,
        title: url.split('/').pop() || 'download',
        status: 'pending',
        progress: 0,
        quality,
        timestamp: Date.now(),
      };

      setDownloadItems((prevItems) => [...prevItems, newItem]);

      try {
        const response = await downloadService.startDownload([url], quality);

        if (response.success && response.ids?.[0]) {
          const itemId = response.ids[0];
          setDownloadItems((prevItems) =>
            prevItems.map((item) =>
              item.id === newItem.id
                ? {
                    ...item,
                    id: itemId,
                    status: 'downloading',
                    progress: 5, // Initial progress
                  }
                : item
            )
          );

          toast({
            title: 'Download started',
            description: 'Your download has been queued.',
            status: 'info',
            duration: 3000,
          });
        } else {
          throw new Error(response.message || 'Failed to start download');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to start download';
        setDownloadItems((prevItems) =>
          prevItems.map((item) =>
            item.id === newItem.id
              ? { ...item, status: 'error', error: errorMessage }
              : item
          )
        );

        toast({
          title: 'Error',
          description: errorMessage,
          status: 'error',
          duration: 5000,
        });
      } finally {
        setIsDownloading(false);
      }
    },
    [toast]
  );

  // Handle retry for failed downloads
  const handleRetry = useCallback(
    (item: DownloadItem) => {
      if (!item.url) return;
      handleDownloadStart([{ url: item.url, quality: item.quality as QualityOption }]);
    },
    [handleDownloadStart]
  );

  // Handle downloading a completed file
  const handleDownloadFile = useCallback(
    async (item: DownloadItem) => {
      if (!item.filePath) return;

      try {
        await downloadService.downloadFile(item.id, item.title || 'download');

        toast({
          title: 'Download started',
          description: 'Your file is being downloaded.',
          status: 'success',
          duration: 3000,
        });
      } catch (error) {
        console.error('Error downloading file:', error);

        toast({
          title: 'Error',
          description: 'Failed to download the file. Please try again.',
          status: 'error',
          duration: 5000,
        });
      }
    },
    [toast]
  );

  // Calculate download status counts
  const activeDownloads = downloadItems.filter(
    (item) => item.status === 'downloading' || item.status === 'converting' || item.status === 'pending'
  ).length;
  
  const completedDownloads = downloadItems.filter(
    (item) => item.status === 'completed'
  ).length;
  
  const failedDownloads = downloadItems.filter(
    (item) => item.status === 'error'
  ).length;

  return (
    <ChakraProvider>
      <Container maxW="container.lg" py={8}>
        <VStack spacing={8} align="stretch">
          <Box>
            <Text fontSize="3xl" fontWeight="bold" color="blue.600" mb={2}>
              MP4 Downloader
            </Text>
            <Text color="gray.600">Download and convert videos to MP3 with ease</Text>
          </Box>
          
          {/* Status Bar */}
          <Box bg="white" p={4} borderRadius="lg" boxShadow="sm">
            <StatusBar 
              items={downloadItems}
              activeDownloads={activeDownloads}
              completedDownloads={completedDownloads}
              failedDownloads={failedDownloads}
            />
          </Box>

          <Box bg="white" p={6} borderRadius="lg" boxShadow="sm">
            <InputArea onDownloadStart={handleDownloadStart} isDownloading={isDownloading} />
          </Box>

          <Box>
            <Text fontSize="xl" fontWeight="semibold" mb={4}>
              Downloads
            </Text>
            <Box bg="white" p={6} borderRadius="lg" boxShadow="sm">
              <DownloadList
                items={downloadItems}
                onDownload={handleDownloadFile}
                onRetry={handleRetry}
              />
            </Box>
          </Box>
        </VStack>
      </Container>
    </ChakraProvider>
  );
};

export default App;
