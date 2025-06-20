import React from 'react';
import { 
  Box, 
  Progress, 
  Text, 
  HStack, 
  Icon, 
  Tooltip,
  useColorModeValue
} from '@chakra-ui/react';
import { FiInfo } from 'react-icons/fi';
import type { DownloadItem } from '../../types';

interface StatusBarProps {
  items: DownloadItem[];
  activeDownloads: number;
  completedDownloads: number;
  failedDownloads: number;
}

const StatusBar: React.FC<StatusBarProps> = ({
  items,
  activeDownloads,
  completedDownloads,
  failedDownloads
}) => {
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  
  // Calculate overall progress
  const totalItems = items.length;
  const completedItems = items.filter(item => item.status === 'completed').length;
  const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
  
  // Get status message
  const getStatusMessage = () => {
    if (activeDownloads > 0) {
      return `${activeDownloads} letöltés folyamatban...`;
    } else if (completedDownloads > 0 && failedDownloads === 0) {
      return 'Minden letöltés sikeresen befejeződött!';
    } else if (failedDownloads > 0 && completedDownloads === 0) {
      return 'Minden letöltés sikertelen volt.';
    } else if (completedDownloads > 0 && failedDownloads > 0) {
      return `${completedDownloads} letöltés sikeres, ${failedDownloads} sikertelen.`;
    } else if (totalItems > 0) {
      return 'Várakozás a letöltések megkezdésére...';
    } else {
      return 'Nincsenek aktív letöltések.';
    }
  };

  return (
    <Box 
      p={3} 
      bg={bgColor}
      borderTopWidth="1px"
      borderColor={borderColor}
      position="fixed"
      bottom="0"
      left="0"
      right="0"
      zIndex="sticky"
      boxShadow="0 -2px 10px rgba(0, 0, 0, 0.05)"
    >
      <Box maxW="1200px" mx="auto" px={4}>
        <HStack spacing={4} align="center" justify="space-between">
          <HStack spacing={2} flex={1} minW={0}>
            <Text fontSize="sm" fontWeight="medium" isTruncated>
              {getStatusMessage()}
            </Text>
            
            {(activeDownloads > 0 || completedDownloads > 0) && (
              <Tooltip 
                label={`${completedDownloads} kész, ${failedDownloads} sikertelen, ${activeDownloads} folyamatban`}
                placement="top"
                hasArrow
              >
                <Box>
                  <Icon as={FiInfo} color="gray.500" boxSize={4} />
                </Box>
              </Tooltip>
            )}
          </HStack>
          
          {totalItems > 0 && (
            <Text fontSize="sm" color="gray.500" whiteSpace="nowrap">
              {completedItems} / {totalItems}
            </Text>
          )}
        </HStack>
        
        {totalItems > 0 && (
          <Progress 
            value={progress} 
            size="sm" 
            colorScheme={progress === 100 ? 'green' : 'blue'} 
            mt={2}
            borderRadius="full"
          />
        )}
      </Box>
    </Box>
  );
};

export default StatusBar;
