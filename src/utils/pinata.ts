import axios from 'axios';

const PINATA_JWT = process.env.NEXT_PUBLIC_PINATA_JWT || '';

interface PinataResponse {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
  isDuplicate?: boolean;
}

export async function pinJSONToIPFS(metadata: Record<string, unknown>): Promise<string> {
  try {
    if (!PINATA_JWT) {
      throw new Error('Pinata JWT không được cấu hình');
    }

    if (metadata.image && typeof metadata.image === 'string' && metadata.image.startsWith('data:image')) {
      const imageUrl = await pinImageFromBase64(metadata.image);
      metadata.image = imageUrl; 
    }

    const response = await axios.post<PinataResponse>(
      'https://api.pinata.cloud/pinning/pinJSONToIPFS',
      metadata,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${PINATA_JWT}`,
        },
      }
    );
    
    return `ipfs://${response.data.IpfsHash}`;
  } catch (error) {
    console.error("Error pinning JSON to IPFS:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to upload metadata: ${errorMessage}`);
  }
}

export async function pinImageFromBase64(base64Image: string): Promise<string> {
  try {
    if (!PINATA_JWT) {
      throw new Error('Pinata JWT không được cấu hình');
    }

    const matches = base64Image.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    
    if (!matches || matches.length !== 3) {
      throw new Error('Invalid base64 image format');
    }
    
    const mimeType = matches[1];
    const base64Data = matches[2];
    const fileExt = mimeType.split('/')[1];

    const byteCharacters = atob(base64Data);
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += 1024) {
      const slice = byteCharacters.slice(offset, offset + 1024);
      
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }
    
    const blob = new Blob(byteArrays, { type: mimeType });
    const fileName = `token-image-${Date.now()}.${fileExt}`;
    const formData = new FormData();
    formData.append('file', blob, fileName);
    
    const metadataPart = JSON.stringify({
      name: fileName,
    });
    formData.append('pinataMetadata', metadataPart);
    
    const response = await axios.post<PinataResponse>(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      formData,
      {
        headers: {
          "Authorization": `Bearer ${PINATA_JWT}`,
        },
      }
    );
    
    return `ipfs://${response.data.IpfsHash}`;
  } catch (error) {
    console.error("Error pinning image to IPFS:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to upload image: ${errorMessage}`);
  }
}

export async function pinFileToIPFS(base64Data: string, fileName: string): Promise<string> {
  try {
    if (!PINATA_JWT) {
      throw new Error('Pinata JWT không được cấu hình');
    }

    const mimeType = 'image/png';
    const fileExt = 'png';
    
    const byteCharacters = atob(base64Data);
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += 1024) {
      const slice = byteCharacters.slice(offset, offset + 1024);
      
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }
    
    const blob = new Blob(byteArrays, { type: mimeType });
    const fullFileName = `${fileName}-${Date.now()}.${fileExt}`;
    
    const formData = new FormData();
    formData.append('file', blob, fullFileName);
    
    const metadataPart = JSON.stringify({
      name: fullFileName,
    });
    formData.append('pinataMetadata', metadataPart);
    
    const response = await axios.post<PinataResponse>(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      formData,
      {
        headers: {
          "Authorization": `Bearer ${PINATA_JWT}`,
        },
      }
    );
    
    return `ipfs://${response.data.IpfsHash}`;
  } catch (error) {
    console.error("Error pinning file to IPFS:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to upload file: ${errorMessage}`);
  }
}

export function ipfsToHTTP(ipfsURI: string): string {
  if (!ipfsURI) return '';
  
  const ipfsGateway = 'https://gateway.pinata.cloud/ipfs/';
  
  if (ipfsURI.startsWith('http')) {
    return ipfsURI;
  }
  
  if (ipfsURI.startsWith('ipfs://')) {
    return ipfsGateway + ipfsURI.replace('ipfs://', '');
  }
  
  return ipfsGateway + ipfsURI;
}

export async function uploadImageAndGetUrl(file: File, fileName?: string): Promise<string> {
  try {
    if (!PINATA_JWT) {
      throw new Error('Pinata JWT không được cấu hình');
    }

    const formData = new FormData();
    formData.append('file', file);
    
    const metadataPart = JSON.stringify({
      name: fileName || file.name || `token-image-${Date.now()}`,
    });
    formData.append('pinataMetadata', metadataPart);
    
    const response = await axios.post<PinataResponse>(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      formData,
      {
        headers: {
          "Authorization": `Bearer ${PINATA_JWT}`,
        },
      }
    );
    
    const ipfsHash = response.data.IpfsHash;
    const httpUrl = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
    return httpUrl;
  } catch (error) {
    console.error("Error uploading image:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to upload image: ${errorMessage}`);
  }
}