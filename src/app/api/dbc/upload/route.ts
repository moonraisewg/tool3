import { NextRequest, NextResponse } from "next/server";

const PINATA_JWT =
  "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiJkYWE4ZGE4Yi0xODQ5LTQxNjktOTcwMy0wNjVmZWI0MGRjOTIiLCJlbWFpbCI6Im5kdGhvMjAwM0BnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGluX3BvbGljeSI6eyJyZWdpb25zIjpbeyJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MSwiaWQiOiJGUkExIn0seyJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MSwiaWQiOiJOWUMxIn1dLCJ2ZXJzaW9uIjoxfSwibWZhX2VuYWJsZWQiOmZhbHNlLCJzdGF0dXMiOiJBQ1RJVkUifSwiYXV0aGVudGljYXRpb25UeXBlIjoic2NvcGVkS2V5Iiwic2NvcGVkS2V5S2V5IjoiMmNjYmM4Mzc4OGZlYTJlMDhjZmEiLCJzY29wZWRLZXlTZWNyZXQiOiIzMjhlNTQ0OGMzM2Y2ZGUzYjYyOGQ4NWFkYjRjNzg4YmQ4ODRmYjViZjhjNzkzOTYzNDI2ZDM1MjFhZjM3MzU2IiwiZXhwIjoxNzgyODk2NDEzfQ.VVgj5oX9__m_TDXPS58KB7ecwvrB_TSbRO32CJOqgV8";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as Blob;
    const name = form.get("name")?.toString() || "";
    const symbol = form.get("symbol")?.toString() || "";
    const description = form.get("description")?.toString() || "";
    const socialX = form.get("socialX")?.toString() || "";
    const socialTelegram = form.get("socialTelegram")?.toString() || "";
    const socialWebsite = form.get("socialWebsite")?.toString() || "";

    if (!file) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    const fileForm = new FormData();
    fileForm.append("file", file);

    const uploadRes = await fetch(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      {
        method: "POST",
        headers: {
          Authorization: PINATA_JWT,
        },
        body: fileForm,
      }
    );

    if (!uploadRes.ok) {
      const errorText = await uploadRes.text();
      return NextResponse.json(
        { error: "Pinata upload failed", detail: errorText },
        { status: 500 }
      );
    }

    const uploadResult = await uploadRes.json();

    const imageCid = uploadResult.IpfsHash;
    if (!imageCid) throw new Error("Missing IpfsHash in response");

    const imageUrl = `https://gateway.pinata.cloud/ipfs/${imageCid}`;

    const metadata = {
      name,
      symbol,
      description,
      image: imageUrl,
      showName: true,
      createdOn: "https://tool3.xyz",
      socialX,
      socialTelegram,
      socialWebsite,
    };

    const metadataRes = await fetch(
      "https://api.pinata.cloud/pinning/pinJSONToIPFS",
      {
        method: "POST",
        headers: {
          Authorization: PINATA_JWT,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(metadata),
      }
    );

    if (!metadataRes.ok) {
      const errorText = await metadataRes.text();

      return NextResponse.json(
        { error: "Metadata upload failed", detail: errorText },
        { status: 500 }
      );
    }

    const metadataResult = await metadataRes.json();

    const metadataCid = metadataResult.IpfsHash;
    if (!metadataCid) throw new Error("Missing IpfsHash from metadata upload");

    const metadataUri = `https://gateway.pinata.cloud/ipfs/${metadataCid}`;

    return NextResponse.json({
      uri: metadataUri,
      image: imageUrl,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err || "Unknown error" },
      { status: 500 }
    );
  }
}
