export interface TokenMetadata {
  name: string;
  symbol: string;
  description?: string;
  image: string;
  showName: boolean;
  createdOn: string;
  socialX?: string;
  socialTelegram?: string;
  socialWebsite?: string;
}

export async function uploadFileToIPFS(file: File): Promise<string> {
  const PINATA_JWT = process.env.NEXT_PUBLIC_PINATA_JWT_DBC;

  if (!PINATA_JWT) {
    throw new Error("Missing Pinata JWT");
  }

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(
    "https://api.pinata.cloud/pinning/pinFileToIPFS",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PINATA_JWT}`,
      },
      body: formData,
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`File upload failed: ${errorText}`);
  }

  const result = await response.json();
  return `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`;
}

export async function uploadMetadataToIPFS(
  metadata: TokenMetadata
): Promise<string> {
  const PINATA_JWT = process.env.NEXT_PUBLIC_PINATA_JWT_DBC;

  if (!PINATA_JWT) {
    throw new Error("Missing Pinata JWT");
  }

  const response = await fetch(
    "https://api.pinata.cloud/pinning/pinJSONToIPFS",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PINATA_JWT}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(metadata),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Metadata upload failed: ${errorText}`);
  }

  const result = await response.json();
  return `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`;
}
