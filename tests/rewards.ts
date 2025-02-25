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
import * as borsh from "@coral-xyz/borsh";
import { 
  metadata,
  TOKEN_2022_SEED,
  FEES_SEED,
  USDC_SEED,
  USDC_MINT_ADDRESS_DEVNET,
} from '../utils/constants';

describe("Rewards Test", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Rewards as Program<Rewards>;
  const connection = program.provider.connection;
  const wallet = provider.wallet as anchor.Wallet;

  // TODO: change to ATAs
  const feeCollector1 = anchor.web3.Keypair.generate();
  const feeCollector2 = anchor.web3.Keypair.generate();

  const initFeesArgs = {
    mintFeeBps: 100,
    transferFeeBps: 100,
    redemptionFeeBps: 100,
    feeCollector: feeCollector1.publicKey,
  }

  const updateFeesArgs = {
    mintFeeBps: 200,
    transferFeeBps: null, // Should not update
    redemptionFeeBps: 100,
    feeCollector: feeCollector2.publicKey,
  }

  const usdcMint = new anchor.web3.PublicKey(USDC_MINT_ADDRESS_DEVNET);

  const mintAmount = 10;
  const burnAmount = 5;

  const [mint] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from(TOKEN_2022_SEED)
    ],
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

  const [fees] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from(FEES_SEED)
    ],
    program.programId
  );

  it("Initialize token", async () => {
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

  it("Initialize fees", async () => {
    const feesInfo = await connection.getAccountInfo(fees);
    if (feesInfo) {
      return; // Do not attempt to initialize if already initialized
    }
    console.log("Fees account not found. Initializing...");

    const initFeesAccountSchema = borsh.struct([
      borsh.u64("discriminator"),
      borsh.u16("mintFeeBps"),
      borsh.u16("transferFeeBps"),
      borsh.u16("redemtionFeeBps"),
      borsh.publicKey("feeCollector"),
    ]);

    const tx = new anchor.web3.Transaction();

    const ix = await program.methods
      .initializeFees(initFeesArgs)
      .accountsStrict({
        signer: wallet.publicKey,
        fees,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .instruction();

      tx.add(ix);

      const sig = await sendAndConfirmTransaction(connection, tx, [wallet.payer]);
      console.log("Signature:", sig);

      const newFeesInfo = await connection.getAccountInfo(fees);
      assert(newFeesInfo, "Fees should be initialized.");

      const initFeesData = initFeesAccountSchema.decode(newFeesInfo.data);
      assert.equal(initFeesData.mintFeeBps, initFeesArgs.mintFeeBps, "Mint fee mismatch");
      assert.equal(initFeesData.transferFeeBps, initFeesArgs.transferFeeBps, "Transfer fee mismatch");
      assert.equal(initFeesData.redemtionFeeBps, initFeesArgs.redemptionFeeBps, "Redemption fee mismatch");
      assert.equal(initFeesData.feeCollector.toString(), initFeesArgs.feeCollector.toString(), "Fee collector mismatch");
  });

  it("Update fees", async () => {  
    const updateFeesAccountSchema = borsh.struct([
      borsh.u64("discriminator"),
      borsh.u16("mint_fee_bps"),
      borsh.u16("transfer_fee_bps"),
      borsh.u16("redeem_fee_bps"),
      borsh.publicKey("fee_collector"),
    ]);

    const tx = new anchor.web3.Transaction();

    const ix = await program.methods
      .updateFees(updateFeesArgs)
      .accountsStrict({
        signer: wallet.publicKey,
        fees,
      })
      .instruction();

      tx.add(ix);

      const sig = await sendAndConfirmTransaction(connection, tx, [wallet.payer]);
      console.log("Signature:", sig);

      const feesInfo = await connection.getAccountInfo(fees);
      const updateFeesData = updateFeesAccountSchema.decode(feesInfo.data);
      assert.equal(updateFeesData.mint_fee_bps, updateFeesArgs.mintFeeBps, "Mint fee mismatch");
      assert.equal(updateFeesData.transfer_fee_bps, initFeesArgs.transferFeeBps, "Transfer fee mismatch");
      assert.equal(updateFeesData.redeem_fee_bps, updateFeesArgs.redemptionFeeBps, "Redemption fee mismatch");
      assert.equal(updateFeesArgs.feeCollector.toString(), updateFeesData.fee_collector.toString(), "Fee collector mismatch");
  });

  it("Mint tokens", async () => {
    const usdcFromAta = await anchor.utils.token.associatedAddress({
      mint: usdcMint,
      owner: wallet.publicKey,
    });

    let initialRWDBalance: number;
    try {
      initialRWDBalance = (await connection.getTokenAccountBalance(payerATA)).value.uiAmount;
    } catch {
      // Token account not yet initiated has 0 balance
      initialRWDBalance = 0;
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

    const postRWDBalance = (await connection.getTokenAccountBalance(payerATA)).value.uiAmount;
    assert.equal(
      initialRWDBalance + mintAmount,
      postRWDBalance,
      "Compare RWD balances, it must be equal"
    );

    const usdcFromPostBalance = (await connection.getTokenAccountBalance(usdcFromAta)).value.uiAmount;
    assert.equal(
      usdcFromBalance - (mintAmount / 10),
      usdcFromPostBalance,
      "Compare USDC From balances, it must be equal"
    );

    const usdcToPostBalance = (await program.provider.connection.getTokenAccountBalance(usdcKeeper)).value.uiAmount;
    assert.equal(
      usdcToBalance + (mintAmount / 10),
      usdcToPostBalance,
      "Compare USDC To balances, it must be equal"
    );
  });

  it("Burn tokens", async () => {
    const usdcToAta = await anchor.utils.token.associatedAddress({
      mint: usdcMint,
      owner: wallet.publicKey,
    });

    const initialRWDBalance = (await connection.getTokenAccountBalance(payerATA)).value.uiAmount;
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

    const postRWDBalance = (await connection.getTokenAccountBalance(payerATA)).value.uiAmount;
    assert.equal(
      initialRWDBalance - burnAmount,
      postRWDBalance,
      "Compare RWD balances, it must be equal"
    );

    const postSupply = (await connection.getTokenSupply(mint)).value.uiAmount;
    assert.equal(
      initialSupply - burnAmount,
      postSupply,
      "Compare RWD supply, it must be equal"
    );

    const usdcFromPostBalance = (await connection.getTokenAccountBalance(usdcKeeper)).value.uiAmount;
    assert.equal(
      usdcFromBalance - (burnAmount / 10),
      usdcFromPostBalance,
      "Compare USDC storage post balances, it must be equal"
    );

    const usdcToPostBalance = (await program.provider.connection.getTokenAccountBalance(usdcToAta)).value.uiAmount;
    assert.equal(
      usdcToBalance + (burnAmount / 10),
      usdcToPostBalance,
      "Compare USDC To post balances, it must be equal"
    );
  });
});
