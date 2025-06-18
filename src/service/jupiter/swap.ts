export interface QuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: "ExactIn" | "ExactOut";
  slippageBps: number;
  platformFee: null;
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }>;
}

export interface SwapInstructionsRequest {
  userPublicKey: string;
  quoteResponse: QuoteResponse;
  prioritizationFeeLamports?: {
    priorityLevelWithMaxLamports: {
      maxLamports: number;
      priorityLevel: "low" | "medium" | "high" | "veryHigh";
    };
  };
  dynamicComputeUnitLimit?: boolean;
}

export interface JupiterInstruction {
  programId: string;
  accounts: Array<{
    pubkey: string;
    isSigner: boolean;
    isWritable: boolean;
  }>;
  data: string;
}

export interface SwapInstructionsResponse {
  tokenLedgerInstruction?: JupiterInstruction;
  computeBudgetInstructions: JupiterInstruction[];
  setupInstructions: JupiterInstruction[];
  swapInstruction: JupiterInstruction;
  cleanupInstruction?: JupiterInstruction;
  otherInstructions: JupiterInstruction[];
  addressLookupTableAddresses: string[];
  prioritizationFeeLamports: number;
  computeUnitLimit: number;
  prioritizationType: {
    computeBudget: {
      microLamports: number;
      estimatedMicroLamports: number;
    };
  };
  simulationSlot: number;
  dynamicSlippageReport: null;
  simulationError?: {
    errorCode: string;
    error: string;
  };
  addressesByLookupTableAddress: null;
  blockhashWithMetadata: {
    blockhash: number[];
    lastValidBlockHeight: number;
    fetchedAt: {
      secs_since_epoch: number;
      nanos_since_epoch: number;
    };
  };
}

export async function getJupiterQuote(
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps: number = 100,
  onlyDirectRoutes: boolean = true
): Promise<QuoteResponse> {
  try {
    const params = new URLSearchParams({
      inputMint,
      outputMint,
      amount: amount.toString(),
      slippageBps: slippageBps.toString(),
      swapMode: "ExactIn",
    });

    if (onlyDirectRoutes) {
      params.append("onlyDirectRoutes", "true");
    }

    const response = await fetch(
      `https://lite-api.jup.ag/swap/v1/quote?${params.toString()}`
    );

    if (!response.ok) {
      throw new Error(`Jupiter quote failed: ${response.statusText}`);
    }

    const quote = await response.json();
    return quote;
  } catch (error) {
    console.error("Jupiter quote error:", error);
    throw new Error("Failed to get Jupiter quote");
  }
}

export async function getJupiterSwapInstructions(
  request: SwapInstructionsRequest
): Promise<SwapInstructionsResponse> {
  try {
    const response = await fetch(
      "https://lite-api.jup.ag/swap/v1/swap-instructions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(request),
      }
    );

    if (!response.ok) {
      throw new Error(
        `Jupiter swap instructions failed: ${response.statusText}`
      );
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Jupiter swap instructions error:", error);
    throw new Error("Failed to get Jupiter swap instructions");
  }
}
