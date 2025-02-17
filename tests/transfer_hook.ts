import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TransferHook } from "../target/types/transfer_hook";

describe("Transfer Hooks Test", () => {
  
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.TransferHook as Program<TransferHook>;

  it("Is initialized!", async () => {
    const tx = await program.methods.initialize().rpc();
    console.log("Your transaction signature", tx);
  });
});
