import assert from "assert";

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Rewards } from "../target/types/rewards";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token"
import { sendAndConfirmTransaction } from "@solana/web3.js";
import * as web3 from "@solana/web3.js";

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

  const payer = program.provider.publicKey;

  const mintAmount = 10;
  const burnAmount = 5;

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

  it("mint tokens", async () => {
    const destination = await anchor.utils.token.associatedAddress({
      mint: mint,
      owner: payer,
    });
    let initialBalance: number;
    try {
      const balance = await program.provider.connection.getTokenAccountBalance(destination);
      initialBalance = balance.value.uiAmount;
    } catch {
      // Token account not yet initiated has 0 balance
      initialBalance = 0;
    }
    const context = {
      mint,
      destination,
      payer,
      rent: web3.SYSVAR_RENT_PUBKEY,
      systemProgram: web3.SystemProgram.programId,
      tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
    };
    const txHash = await program.methods
      .mintTokens(new anchor.BN(mintAmount * 10 ** metadata.decimals))
      .accounts(context)
      .rpc();
    await program.provider.connection.confirmTransaction(txHash);
    console.log(`  https://explorer.solana.com/tx/${txHash}?cluster=devnet`);
    const postBalance = (
      await program.provider.connection.getTokenAccountBalance(destination)
    ).value.uiAmount;
    assert.equal(
      initialBalance + mintAmount,
      postBalance,
      "Compare balances, it must be equal"
    );
  });

  it("Burn tokens", async () => {
    const from_ata = await anchor.utils.token.associatedAddress({
      mint: mint,
      owner: payer,
    });
    const balance = await program.provider.connection.getTokenAccountBalance(from_ata);
    const initialBalance = balance.value.uiAmount;
    const supply = await program.provider.connection.getTokenSupply(mint);
    const initialSupply = supply.value.uiAmount;
    const context = {
      mint,
      from_ata,
      payer,
      rent: web3.SYSVAR_RENT_PUBKEY,
      systemProgram: web3.SystemProgram.programId,
      tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
    };

    const txHash = await program.methods
      .burnTokens(new anchor.BN(burnAmount * 10 ** metadata.decimals))
      .accounts(context)
      .rpc();

    await program.provider.connection.confirmTransaction(txHash);
    console.log(`  https://explorer.solana.com/tx/${txHash}?cluster=devnet`);

    const postBalance = (
      await program.provider.connection.getTokenAccountBalance(from_ata)
    ).value.uiAmount;
    assert.equal(
      initialBalance - burnAmount,
      postBalance,
      "Compare balances, it must be equal"
    );
    
    const postSupply = (
      await program.provider.connection.getTokenSupply(mint)
    ).value.uiAmount;
    assert.equal(
      initialSupply - burnAmount,
      postSupply,
      "Compare token supply, it must be equal"
    );
  });
});
