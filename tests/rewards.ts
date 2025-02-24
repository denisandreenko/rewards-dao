import assert from "assert";

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Rewards } from "../target/types/rewards";
import { 
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID 
} from '@solana/spl-token';
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

  const USDC_SEED = "usdc";
  const USDC_MINT_ADDRESS_DEVNET = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

  const usdcMint = new anchor.web3.PublicKey(USDC_MINT_ADDRESS_DEVNET);

  const payer = program.provider.publicKey;

  const mintAmount = 10;
  const burnAmount = 5;

  const [mint] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("token-2022")],
    program.programId
  );

  // Get PDA for the usdc storage
  const [usdcKeeper] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from(USDC_SEED)
    ],
    program.programId
  );

  const [payerATA] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      wallet.publicKey.toBytes(),
      TOKEN_2022_PROGRAM_ID.toBytes(),
      mint.toBytes()
    ],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  it("Is initialized!", async () => {
    const ix = await program.methods
      .initializeToken(metadata)
      .accountsStrict({
        signer: wallet.publicKey,
        mint,
        usdcMint,
        usdcKeeper,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        tokenProgram2022: TOKEN_2022_PROGRAM_ID,
      })
      .instruction();

    const tx = new anchor.web3.Transaction().add(ix);

    const sig = await sendAndConfirmTransaction(connection, tx, [wallet.payer]);
    console.log("Signature:", sig);

    const newMintInfo = await connection.getAccountInfo(mint);
    assert(newMintInfo, "Mint should be initialized.");

    const newUSDCKeeperInfo = await connection.getAccountInfo(usdcKeeper);
    assert(newUSDCKeeperInfo, "USDC keeper should be initialized.");
  });

  it("mint tokens", async () => {
    const usdcFromAta = await anchor.utils.token.associatedAddress({
      mint: usdcMint,
      owner: wallet.publicKey,
    });

    let initialBalance: number;
    try {
      initialBalance = (await connection.getTokenAccountBalance(payerATA)).value.uiAmount;
    } catch {
      // Token account not yet initiated has 0 balance
      initialBalance = 0;
    }

    const usdcFromBalance = (await connection.getTokenAccountBalance(usdcFromAta)).value.uiAmount;
    console.log("USDC From ATA balance: ", usdcFromBalance);

    const usdcToBalance = (await connection.getTokenAccountBalance(usdcKeeper)).value.uiAmount;
    console.log("USDC To balance: ", usdcToBalance);

    const tx = new anchor.web3.Transaction();

    const ix = await program.methods
      .mintTokens(new anchor.BN(mintAmount * 10 ** metadata.decimals))
      .accountsStrict({
        signer: wallet.publicKey,
        mint,
        usdcMint,
        usdcKeeper,
        toAta: payerATA,
        usdcFromAta,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        tokenProgram2022: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .instruction();

    tx.add(ix);

    const sig = await sendAndConfirmTransaction(connection, tx, [wallet.payer]);
    console.log("Signature:", sig);

    const postBalance = (await connection.getTokenAccountBalance(payerATA)).value.uiAmount;
    assert.equal(
      initialBalance + mintAmount,
      "Compare SP balances, it must be equal"
    );

    const usdcFromPostBalance = (await connection.getTokenAccountBalance(usdcFromAta)).value.uiAmount;
    assert.equal(
      usdcFromBalance - (mintAmount / 10), // 1 USDC = 10 SP
      usdcFromPostBalance,
      "Compare USDC From balances, it must be equal"
    );

    const usdcToPostBalance = (await program.provider.connection.getTokenAccountBalance(usdcKeeper)).value.uiAmount;
    assert.equal(
      usdcToBalance + (mintAmount / 10), // 1 USDC = 10 SP
      usdcToPostBalance,
      "Compare USDC To balances, it must be equal"
    );
  });

  it("Burn tokens", async () => {
    const usdcToAta = await anchor.utils.token.associatedAddress({
      mint: usdcMint,
      owner: wallet.publicKey,
    });

    const initialBalance = (await connection.getTokenAccountBalance(payerATA)).value.uiAmount;
    const initialSupply = (await connection.getTokenSupply(mint)).value.uiAmount;
    const usdcFromBalance = (await connection.getTokenAccountBalance(usdcKeeper)).value.uiAmount;
    const usdcToBalance = (await connection.getTokenAccountBalance(usdcToAta)).value.uiAmount;

    const tx = new anchor.web3.Transaction();

    const ix = await program.methods
      .burnTokens(new anchor.BN(burnAmount * 10 ** metadata.decimals))
      .accountsStrict({
        signer: wallet.publicKey,
        mint,
        usdcMint,
        usdcKeeper,
        fromAta: payerATA,
        usdcToAta,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        tokenProgram2022: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID
      })
      .instruction();

    tx.add(ix);

    const sig = await sendAndConfirmTransaction(connection, tx, [wallet.payer]);
    console.log("Signature", sig);

    const postBalance = (await connection.getTokenAccountBalance(payerATA)).value.uiAmount;
    assert.equal(
      initialBalance - burnAmount,
      postBalance,
      "Compare SP balances, it must be equal"
    );

    const postSupply = (await connection.getTokenSupply(mint)).value.uiAmount;
    assert.equal(
      initialSupply - burnAmount,
      postSupply,
      "Compare SP token supply, it must be equal"
    );

    const usdcFromPostBalance = (await connection.getTokenAccountBalance(usdcKeeper)).value.uiAmount;
    assert.equal(
      usdcFromBalance - (burnAmount / 10), // 1 USDC = 10 SP
      usdcFromPostBalance,
      "Compare USDC storage post balances, it must be equal"
    );

    const usdcToPostBalance = (await program.provider.connection.getTokenAccountBalance(usdcToAta)).value.uiAmount;
    assert.equal(
      usdcToBalance + (burnAmount / 10), // 1 USDC = 10 SP
      usdcToPostBalance,
      "Compare USDC To post balances, it must be equal"
    );
  });
});
