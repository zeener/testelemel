import { Box, Text, HStack, Badge, Button, Tooltip, IconButton, Progress } from '@chakra-ui/react';
import { DownloadIcon, RepeatIcon } from '@chakra-ui/icons';
import type { DownloadItem } from '../types';

interface DownloadItemProps {
  item: DownloadItem;
  onDownload: (item: DownloadItem) => void;
  onRetry: (item: DownloadItem) => void;
}

export const DownloadItemComponent: React.FC<DownloadItemProps> = ({ 
  item, 
  onDownload, 
  onRetry 
}) => {
  const isActive = item.status === 'downloading' || item.status === 'converting';
  const isCompleted = item.status === 'completed';
  const isError = item.status === 'error';

  return (
    <Box 
      p={4} 
      borderWidth="1px" 
      borderRadius="md"
      bg="white"
      boxShadow="sm"
      transition="all 0.2s"
      _hover={{
        boxShadow: 'md',
        transform: 'translateY(-1px)'
      }}
    >
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
        <Box flex="1" minW="0">
          <HStack spacing={2} align="center" mb={1}>
            <Text 
              fontWeight="medium" 
              isTruncated 
              fontSize="sm"
              color={isCompleted ? 'green.600' : isError ? 'red.600' : 'blue.600'}
            >
              {item.title}
            </Text>
            <Badge 
              colorScheme={isCompleted ? 'green' : isError ? 'red' : 'blue'}
              variant="subtle"
              fontSize="2xs"
              textTransform="uppercase"
              letterSpacing="wider"
            >
              {item.status}
            </Badge>
          </HStack>
          
          {item.quality && (
            <Text fontSize="xs" color="gray.500" mb={1}>
              Quality: {item.quality} kbps
            </Text>
          )}
        </Box>
        
        <HStack spacing={1}>
          {isCompleted && item.filePath && (
            <Tooltip label="Download file">
              <IconButton
                icon={<DownloadIcon />}
                size="sm"
                colorScheme="blue"
                variant="ghost"
                aria-label="Download file"
                onClick={() => onDownload(item)}
              />
            </Tooltip>
          )}
          
          {isError && (
            <Tooltip label="Retry download">
              <IconButton
                icon={<RepeatIcon />}
                size="sm"
                colorScheme="orange"
                variant="ghost"
                aria-label="Retry download"
                onClick={() => onRetry(item)}
              />
            </Tooltip>
          )}
        </HStack>
      </Box>
      
      {isActive && (
        <Box mt={3}>
          <HStack justify="space-between" mb={1} fontSize="xs">
            <Text color="gray.600">
              {item.status === 'converting' ? 'Converting' : 'Downloading'}... {Math.round(item.progress)}%
            </Text>
            {item.size && (
              <Text color="gray.600">
                {Math.round((item.size * item.progress) / 1024 / 102) / 10} / {Math.round(item.size / 1024 / 1024 * 10) / 10} MB
              </Text>
            )}
          </HStack>
          <Progress 
            value={item.progress} 
            size="sm" 
            colorScheme={item.status === 'converting' ? 'purple' : 'blue'}
            borderRadius="full"
            isIndeterminate={item.progress === 0}
          />
        </Box>
      )}
      
      {isCompleted && item.filePath && (
        <HStack mt={2} spacing={2} fontSize="xs">
          <Box 
            as="button"
            display="inline-flex"
            alignItems="center"
            color="blue.500"
            _hover={{ textDecoration: 'underline' }}
            onClick={() => onDownload(item)}
          >
            <DownloadIcon mr={1} /> Download file
          </Box>
          {item.duration && (
            <Text color="gray.500">
              • {Math.floor(item.duration / 60)}:{
                (item.duration % 60).toString().padStart(2, '0')
              }
            </Text>
          )}
          {item.size && (
            <Text color="gray.500">
              • {Math.round(item.size / 1024 / 1024 * 10) / 10} MB
            </Text>
          )}
        </HStack>
      )}
      
      {isError && item.error && (
        <Box 
          mt={2} 
          p={2} 
          bg="red.50" 
          borderRadius="md" 
          borderLeft="3px solid" 
          borderColor="red.400"
        >
          <Text fontSize="sm" color="red.600">
            {item.error}
          </Text>
          <Button 
            size="xs" 
            mt={2} 
            colorScheme="red" 
            variant="outline"
            leftIcon={<RepeatIcon />}
            onClick={() => onRetry(item)}
          >
            Retry
          </Button>
        </Box>
      )}
    </Box>
  );
};
