import { Program } from "@coral-xyz/anchor";
import { connection } from "./connection";
import idl from "@/idl/tool-lp.json";
import type { ToolLp } from "@/idl/tool-lp";
import { PublicKey } from "@solana/web3.js";

export type AnchorProgramType = Program<ToolLp>;
export const PROGRAM_ID = new PublicKey(idl.address);
export const program = new Program<ToolLp>(idl, {
  connection,
});
