import { useState, useEffect } from "react";
import { ClusterType, Token } from "@/types/types";

export const useAllTokens = (cluster: ClusterType = "mainnet") => {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const CACHE_KEY = "jupiter_verified_token_list";
  const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

  useEffect(() => {
    const fetchJupiterTokens = async () => {
      try {
        setLoading(true);
        setError(null);

        const cachedData = localStorage.getItem(CACHE_KEY);
        if (cachedData) {
          const { tokens: cachedTokens, timestamp } = JSON.parse(cachedData);
          if (Date.now() - timestamp < CACHE_TTL) {
            setTokens(cachedTokens);
            setLoading(false);
            return;
          }
        }

        if (cluster !== "mainnet") {
          setTokens([]); // Jupiter chỉ có mainnet
          setLoading(false);
          return;
        }

        const res = await fetch("https://tokens.jup.ag/tokens?tags=verified");
        if (!res.ok) {
          throw new Error(`Failed to fetch Jupiter tokens: ${res.statusText}`);
        }

        const tokenList: Token[] = await res.json();

        setTokens(tokenList);
        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({ tokens: tokenList, timestamp: Date.now() })
        );
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to fetch tokens";
        setError(errorMessage);

        const cachedData = localStorage.getItem(CACHE_KEY);
        if (cachedData) {
          const { tokens: cachedTokens } = JSON.parse(cachedData);
          setTokens(cachedTokens);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchJupiterTokens();
  }, [cluster, CACHE_TTL]);

  return { tokens, loading, error };
};
