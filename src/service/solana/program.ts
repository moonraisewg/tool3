import { AnchorProvider, Program, Idl, setProvider } from "@coral-xyz/anchor";
import { connection } from "./connection";
import idl from "@/idl/tool-lp.json";
import { PublicKey } from "@solana/web3.js";

export type AnchorProgramType = Program<Idl>;
export const PROGRAM_ID = new PublicKey(idl.address);

export const getProgram = (): AnchorProgramType => {
  const provider = new AnchorProvider(connection, {} as any, {});
  setProvider(provider);
  return new Program(idl as Idl, provider);
};
