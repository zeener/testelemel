// Type definitions for node-id3
// Project: https://github.com/Zazama/node-id3

declare module 'node-id3' {
  interface ImageFrame {
    mime: string;
    type: { id: number; name?: string };
    description: string;
    imageBuffer: Buffer;
  }

  interface Tags {
    title?: string;
    artist?: string;
    album?: string;
    year?: string;
    trackNumber?: string;
    genre?: string | string[];
    comment?: {
      language: string;
      text: string;
    };
    image?: ImageFrame | string | Buffer;
  }

  function write(tags: Tags, filePath: string, callback: (error: Error | null) => void): void;
  function read(filePath: string): Tags;
  
  const _default: {
    write: typeof write;
    read: typeof read;
  };
  
  export = _default;
}
