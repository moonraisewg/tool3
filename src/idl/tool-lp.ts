/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/tool_lp.json`.
 */
export type ToolLp = {
  address: "Hog1fQ9MwCd6qQFoVYczbbXwEWNd3m1bnNakPGg4frK";
  metadata: {
    name: "toolLp";
    version: "0.1.0";
    spec: "0.1.0";
    description: "Your proxy withdraw program";
  };
  instructions: [
    {
      name: "deposit";
      discriminator: [242, 35, 198, 137, 82, 225, 242, 182];
      accounts: [
        {
          name: "vault";
          writable: true;
        },
        {
          name: "user";
          writable: true;
          signer: true;
        },
        {
          name: "userLock";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [117, 115, 101, 114, 45, 108, 111, 99, 107];
              },
              {
                kind: "account";
                path: "vault";
              },
              {
                kind: "account";
                path: "user";
              }
            ];
          };
        },
        {
          name: "userTokenAccount";
          writable: true;
        },
        {
          name: "vaultTokenAccount";
          writable: true;
        },
        {
          name: "tokenMint";
          relations: ["vault"];
        },
        {
          name: "tokenProgram";
          address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
        },
        {
          name: "clock";
          address: "SysvarC1ock11111111111111111111111111111111";
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        }
      ];
      args: [
        {
          name: "amount";
          type: "u64";
        },
        {
          name: "unlockTimestamp";
          type: "i64";
        }
      ];
    },
    {
      name: "initializeVault";
      discriminator: [48, 191, 163, 44, 71, 129, 63, 164];
      accounts: [
        {
          name: "vault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [118, 97, 117, 108, 116];
              },
              {
                kind: "arg";
                path: "poolId";
              }
            ];
          };
        },
        {
          name: "initializer";
          writable: true;
          signer: true;
        },
        {
          name: "tokenMint";
        },
        {
          name: "vaultTokenAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [118, 97, 117, 108, 116, 45, 116, 111, 107, 101, 110];
              },
              {
                kind: "arg";
                path: "poolId";
              },
              {
                kind: "account";
                path: "vault";
              }
            ];
          };
        },
        {
          name: "vaultAuthority";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  118,
                  97,
                  117,
                  108,
                  116,
                  45,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ];
              },
              {
                kind: "arg";
                path: "poolId";
              },
              {
                kind: "account";
                path: "vault";
              }
            ];
          };
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
        {
          name: "tokenProgram";
          address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
        },
        {
          name: "rent";
          address: "SysvarRent111111111111111111111111111111111";
        }
      ];
      args: [
        {
          name: "poolId";
          type: "pubkey";
        },
        {
          name: "bump";
          type: "u8";
        }
      ];
    },
    {
      name: "proxyWithdraw";
      discriminator: [118, 12, 163, 77, 70, 15, 67, 252];
      accounts: [
        {
          name: "cpSwapProgram";
          address: "CPMDWBwJDtYax9qW7AyRuVC19Cc4L4Vcy4n2BHAbHkCW";
        },
        {
          name: "owner";
          docs: ["Pays to mint the position"];
          signer: true;
        },
        {
          name: "authority";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  97,
                  110,
                  100,
                  95,
                  108,
                  112,
                  95,
                  109,
                  105,
                  110,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  95,
                  115,
                  101,
                  101,
                  100
                ];
              }
            ];
            program: {
              kind: "account";
              path: "cpSwapProgram";
            };
          };
        },
        {
          name: "poolState";
          docs: ["Pool state account"];
          writable: true;
        },
        {
          name: "ownerLpToken";
          docs: ["Owner lp token account"];
          writable: true;
        },
        {
          name: "token0Account";
          docs: ["The owner's token account for receive token_0"];
          writable: true;
        },
        {
          name: "token1Account";
          docs: ["The owner's token account for receive token_1"];
          writable: true;
        },
        {
          name: "token0Vault";
          docs: ["The address that holds pool tokens for token_0"];
          writable: true;
        },
        {
          name: "token1Vault";
          docs: ["The address that holds pool tokens for token_1"];
          writable: true;
        },
        {
          name: "tokenProgram";
          docs: ["token Program"];
          address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
        },
        {
          name: "tokenProgram2022";
          docs: ["Token program 2022"];
          address: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
        },
        {
          name: "vault0Mint";
          docs: ["The mint of token_0 vault"];
        },
        {
          name: "vault1Mint";
          docs: ["The mint of token_1 vault"];
        },
        {
          name: "lpMint";
          docs: ["Pool lp token mint"];
          writable: true;
        },
        {
          name: "memoProgram";
          docs: ["memo program"];
          address: "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
        }
      ];
      args: [
        {
          name: "lpTokenAmount";
          type: "u64";
        },
        {
          name: "minimumToken0Amount";
          type: "u64";
        },
        {
          name: "minimumToken1Amount";
          type: "u64";
        }
      ];
    },
    {
      name: "withdraw";
      discriminator: [183, 18, 70, 156, 148, 109, 161, 34];
      accounts: [
        {
          name: "vault";
          writable: true;
        },
        {
          name: "user";
          writable: true;
          signer: true;
        },
        {
          name: "userLock";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [117, 115, 101, 114, 45, 108, 111, 99, 107];
              },
              {
                kind: "account";
                path: "vault";
              },
              {
                kind: "account";
                path: "user";
              }
            ];
          };
        },
        {
          name: "userTokenAccount";
          writable: true;
        },
        {
          name: "vaultTokenAccount";
          writable: true;
        },
        {
          name: "vaultAuthority";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  118,
                  97,
                  117,
                  108,
                  116,
                  45,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ];
              },
              {
                kind: "account";
                path: "vault.pool_id";
                account: "vault";
              },
              {
                kind: "account";
                path: "vault";
              }
            ];
          };
        },
        {
          name: "tokenMint";
          relations: ["vault"];
        },
        {
          name: "tokenProgram";
          address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
        },
        {
          name: "clock";
          address: "SysvarC1ock11111111111111111111111111111111";
        }
      ];
      args: [
        {
          name: "amount";
          type: "u64";
        }
      ];
    }
  ];
  accounts: [
    {
      name: "poolState";
      discriminator: [247, 237, 227, 245, 215, 195, 222, 70];
    },
    {
      name: "userLock";
      discriminator: [107, 42, 69, 173, 232, 188, 205, 98];
    },
    {
      name: "vault";
      discriminator: [211, 8, 232, 43, 2, 152, 117, 119];
    }
  ];
  events: [
    {
      name: "depositEvent";
      discriminator: [120, 248, 61, 83, 31, 142, 107, 144];
    },
    {
      name: "withdrawEvent";
      discriminator: [22, 9, 133, 26, 160, 44, 71, 192];
    }
  ];
  errors: [
    {
      code: 6000;
      name: "lockNotYetExpired";
      msg: "Lock period has not yet expired";
    },
    {
      code: 6001;
      name: "invalidMint";
      msg: "Invalid LP token mint";
    },
    {
      code: 6002;
      name: "insufficientBalance";
      msg: "Insufficient balance to withdraw";
    },
    {
      code: 6003;
      name: "arithmeticOverflow";
      msg: "Arithmetic overflow error";
    },
    {
      code: 6004;
      name: "arithmeticUnderflow";
      msg: "Arithmetic underflow error";
    },
    {
      code: 6005;
      name: "invalidUnlockTimestamp";
      msg: "Invalid unlock timestamp";
    }
  ];
  types: [
    {
      name: "depositEvent";
      type: {
        kind: "struct";
        fields: [
          {
            name: "user";
            type: "pubkey";
          },
          {
            name: "vault";
            type: "pubkey";
          },
          {
            name: "poolId";
            type: "pubkey";
          },
          {
            name: "amount";
            type: "u64";
          },
          {
            name: "unlockTimestamp";
            type: "i64";
          },
          {
            name: "timestamp";
            type: "i64";
          }
        ];
      };
    },
    {
      name: "poolState";
      serialization: "bytemuckunsafe";
      repr: {
        kind: "c";
        packed: true;
      };
      type: {
        kind: "struct";
        fields: [
          {
            name: "ammConfig";
            docs: ["Which config the pool belongs"];
            type: "pubkey";
          },
          {
            name: "poolCreator";
            docs: ["pool creator"];
            type: "pubkey";
          },
          {
            name: "token0Vault";
            docs: ["Token A"];
            type: "pubkey";
          },
          {
            name: "token1Vault";
            docs: ["Token B"];
            type: "pubkey";
          },
          {
            name: "lpMint";
            docs: [
              "Pool tokens are issued when A or B tokens are deposited.",
              "Pool tokens can be withdrawn back to the original A or B token."
            ];
            type: "pubkey";
          },
          {
            name: "token0Mint";
            docs: ["Mint information for token A"];
            type: "pubkey";
          },
          {
            name: "token1Mint";
            docs: ["Mint information for token B"];
            type: "pubkey";
          },
          {
            name: "token0Program";
            docs: ["token_0 program"];
            type: "pubkey";
          },
          {
            name: "token1Program";
            docs: ["token_1 program"];
            type: "pubkey";
          },
          {
            name: "observationKey";
            docs: ["observation account to store oracle data"];
            type: "pubkey";
          },
          {
            name: "authBump";
            type: "u8";
          },
          {
            name: "status";
            docs: [
              "Bitwise representation of the state of the pool",
              "bit0, 1: disable deposit(value is 1), 0: normal",
              "bit1, 1: disable withdraw(value is 2), 0: normal",
              "bit2, 1: disable swap(value is 4), 0: normal"
            ];
            type: "u8";
          },
          {
            name: "lpMintDecimals";
            type: "u8";
          },
          {
            name: "mint0Decimals";
            docs: ["mint0 and mint1 decimals"];
            type: "u8";
          },
          {
            name: "mint1Decimals";
            type: "u8";
          },
          {
            name: "lpSupply";
            docs: ["True circulating supply without burns and lock ups"];
            type: "u64";
          },
          {
            name: "protocolFeesToken0";
            docs: [
              "The amounts of token_0 and token_1 that are owed to the liquidity provider."
            ];
            type: "u64";
          },
          {
            name: "protocolFeesToken1";
            type: "u64";
          },
          {
            name: "fundFeesToken0";
            type: "u64";
          },
          {
            name: "fundFeesToken1";
            type: "u64";
          },
          {
            name: "openTime";
            docs: ["The timestamp allowed for swap in the pool."];
            type: "u64";
          },
          {
            name: "recentEpoch";
            docs: ["recent epoch"];
            type: "u64";
          },
          {
            name: "padding";
            docs: ["padding for future updates"];
            type: {
              array: ["u64", 31];
            };
          }
        ];
      };
    },
    {
      name: "userLock";
      type: {
        kind: "struct";
        fields: [
          {
            name: "user";
            type: "pubkey";
          },
          {
            name: "amount";
            type: "u64";
          },
          {
            name: "unlockTimestamp";
            type: "i64";
          }
        ];
      };
    },
    {
      name: "vault";
      type: {
        kind: "struct";
        fields: [
          {
            name: "poolId";
            type: "pubkey";
          },
          {
            name: "tokenMint";
            type: "pubkey";
          },
          {
            name: "vaultTokenAccount";
            type: "pubkey";
          },
          {
            name: "totalLocked";
            type: "u64";
          },
          {
            name: "bump";
            type: "u8";
          }
        ];
      };
    },
    {
      name: "withdrawEvent";
      type: {
        kind: "struct";
        fields: [
          {
            name: "user";
            type: "pubkey";
          },
          {
            name: "vault";
            type: "pubkey";
          },
          {
            name: "poolId";
            type: "pubkey";
          },
          {
            name: "amount";
            type: "u64";
          },
          {
            name: "timestamp";
            type: "i64";
          }
        ];
      };
    }
  ];
};
