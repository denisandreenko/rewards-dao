import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Rewards } from "../target/types/rewards";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token"
import { sendAndConfirmTransaction } from "@solana/web3.js";

describe("Rewards Test", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Rewards as Program<Rewards>;
  const connection = program.provider.connection;
  const wallet = provider.wallet as anchor.Wallet;

  const metadata = {
    name: "Rewards Token",
    symbol: "RWD",
    uri: "https://devnet.irys.xyz/71M9GquPesJ9LyiGiJKFxveood8kY6GqHP92GS2YvQrE",
    decimals: 6,
  }

  const [mint] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("mint")],
    program.programId
  );

  it("Is initialized!", async () => {
    const ix = await program.methods
      .initializeToken(metadata)
      .accountsStrict({
        payer: wallet.publicKey,
        mint: mint,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .instruction();

    const tx = new anchor.web3.Transaction().add(ix);

    const sig = await sendAndConfirmTransaction(connection, tx, [wallet.payer]);
    console.log("Mint initialized:", sig);
  });
});
