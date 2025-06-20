import { VStack, Text } from '@chakra-ui/react';
import { DownloadItemComponent } from './DownloadItem';
import type { DownloadItem } from '../types';

interface DownloadListProps {
  items: DownloadItem[];
  onDownload: (item: DownloadItem) => void;
  onRetry: (item: DownloadItem) => void;
}

export const DownloadList: React.FC<DownloadListProps> = ({ 
  items, 
  onDownload, 
  onRetry 
}) => {
  if (items.length === 0) {
    return (
      <Text color="gray.500" textAlign="center" py={8}>
        No downloads yet. Enter a URL above to get started.
      </Text>
    );
  }

  return (
    <VStack spacing={4} align="stretch">
      {items.map((item) => (
        <DownloadItemComponent
          key={item.id}
          item={item}
          onDownload={onDownload}
          onRetry={onRetry}
        />
      ))}
    </VStack>
  );
};
