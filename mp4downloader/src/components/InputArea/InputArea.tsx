import React, { useState, useCallback } from 'react';
import { 
  Box, 
  Button, 
  Select, 
  Textarea, 
  VStack, 
  Text, 
  useToast,
  HStack,
  IconButton,
  Tooltip
} from '@chakra-ui/react';
import { AddIcon, DeleteIcon } from '@chakra-ui/icons';
import type { QualityOption } from '../../types';

interface InputAreaProps {
  onDownloadStart: (items: { url: string; quality: QualityOption }[]) => void;
  isDownloading: boolean;
}

const InputArea: React.FC<InputAreaProps> = ({ onDownloadStart, isDownloading }) => {
  const [urls, setUrls] = useState<string[]>(['']);
  const [quality, setQuality] = useState<QualityOption>('192');
  const toast = useToast();

  const handleUrlChange = (index: number, value: string) => {
    const newUrls = [...urls];
    newUrls[index] = value;
    setUrls(newUrls);
  };

  const addUrlField = () => {
    setUrls([...urls, '']);
  };

  const removeUrlField = (index: number) => {
    if (urls.length === 1) {
      // Don't remove the last field, just clear it
      setUrls(['']);
    } else {
      const newUrls = urls.filter((_, i) => i !== index);
      setUrls(newUrls);
    }
  };

  const handleSubmit = useCallback(async () => {
    // Filter out empty URLs
    const validUrls = urls.filter(url => url.trim() !== '');
    
    if (validUrls.length === 0) {
      toast({
        title: 'Hiba',
        description: 'Kérjük adj meg legalább egy YouTube linket!',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    // Validate YouTube URLs - more permissive regex to accept various YouTube URL formats including playlists
    const youtubeRegex = /^(https?:\/\/)?(www\.|music\.|m\.)?(youtube\.com|youtu\.?be)\/.+/;
    const invalidUrls = validUrls.filter(url => !youtubeRegex.test(url.trim()));
    
    if (invalidUrls.length > 0) {
      toast({
        title: 'Érvénytelen link(ek)',
        description: 'Kérjük, hogy csak érvényes YouTube linkeket adj meg!',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    // Start download process
    onDownloadStart(validUrls.map(url => ({ url, quality })));
  }, [urls, quality, onDownloadStart, toast]);

  return (
    <Box width="100%" maxW="800px" mx="auto" p={4}>
      <VStack spacing={4} align="stretch">
        <Text fontSize="xl" fontWeight="bold" mb={2}>
          YouTube MP3 Letöltő
        </Text>
        
        <VStack spacing={2} align="stretch">
          {urls.map((url, index) => (
            <HStack key={index} spacing={2}>
              <Textarea
                value={url}
                onChange={(e) => handleUrlChange(index, e.target.value)}
                placeholder="Illeszd be a YouTube videó vagy lejátszási lista linkjét"
                size="md"
                isDisabled={isDownloading}
                _disabled={{ opacity: 0.7, cursor: 'not-allowed' }}
              />
              {urls.length > 1 && (
                <IconButton
                  aria-label="Törlés"
                  icon={<DeleteIcon />}
                  onClick={() => removeUrlField(index)}
                  colorScheme="red"
                  variant="ghost"
                  isDisabled={isDownloading}
                />
              )}
            </HStack>
          ))}
          
          <HStack justify="space-between" mt={2}>
            <Button
              leftIcon={<AddIcon />}
              onClick={addUrlField}
              size="sm"
              variant="outline"
              isDisabled={isDownloading}
            >
              Több link hozzáadása
            </Button>
            
            <HStack>
              <Text fontSize="sm" mr={2}>
                Minőség:
              </Text>
              <Select
                value={quality}
                onChange={(e) => setQuality(e.target.value as QualityOption)}
                width="auto"
                size="sm"
                isDisabled={isDownloading}
              >
                <option value="128">128 kbps</option>
                <option value="192">192 kbps</option>
                <option value="256">256 kbps</option>
                <option value="320">320 kbps</option>
              </Select>
            </HStack>
          </HStack>
        </VStack>
        
        <Tooltip 
          label={urls.some(url => url.trim() !== '') ? '' : 'Kérjük adj meg legalább egy YouTube linket!'}
          isDisabled={urls.some(url => url.trim() !== '')}
        >
          <Button
            colorScheme="blue"
            size="lg"
            onClick={handleSubmit}
            isLoading={isDownloading}
            loadingText="Feldolgozás..."
            isDisabled={!urls.some(url => url.trim() !== '')}
            width="100%"
            mt={4}
          >
            Letöltés és konvertálás
          </Button>
        </Tooltip>
        
        <Text fontSize="sm" color="gray.500" mt={2} textAlign="center">
          Támogatott formátumok: Videó linkek és lejátszási listák
        </Text>
      </VStack>
    </Box>
  );
};

export default InputArea;
