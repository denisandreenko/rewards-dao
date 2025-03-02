import assert from "assert";

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Rewards } from "../target/types/rewards";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
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
  USDC_MINT_ADDRESS,
  RWD_DECIMALS,
  FREEZE_SEED,
} from '../utils/constants';
import { makeKeypairs, airdropIfRequired } from "@solana-developers/helpers"
import { findATAs, findPDAs, getTokenBalance } from "../utils/setup";
import { initializeFreeze } from "../utils/initialization";
import { getFreezeState } from "../utils/freezeOps";

describe("Rewards Test", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Rewards as Program<Rewards>;
  const connection = program.provider.connection;
  const wallet = provider.wallet as anchor.Wallet;


  const [receiver, feeCollector1, feeCollector2] = makeKeypairs(3);

  // Define PDAs dynamically
  let pdaMap = findPDAs(program, {
    mint: [Buffer.from(TOKEN_2022_SEED)],
    usdcKeeper: [Buffer.from(USDC_SEED)],
    fees: [Buffer.from(FEES_SEED)],
    freezeState: [Buffer.from(FREEZE_SEED)],
  });

  // ATA Accounts: 
  const ownersMap = {
    payer: wallet.publicKey,
    receiver: receiver.publicKey,
    feeCollector1: feeCollector1.publicKey,
    feeCollector2: feeCollector2.publicKey,
  };

  const ataMap = findATAs(pdaMap.mint, ownersMap);
  // const payerATA = ataMap.payer;
  const feeCollector1ATA = ataMap.feeCollector1;
  const feeCollector2ATA = ataMap.feeCollector2;

  const initFeesArgs = {
    mintFeeBps: 100,
    transferFeeBps: 100,
    redemptionFeeBps: 100,
    feeCollector: feeCollector1ATA,
  }

  const updateFeesArgs = {
    mintFeeBps: 200,
    transferFeeBps: null, // Should not update
    redemptionFeeBps: 100,
    feeCollector: feeCollector2ATA,
  }

  const usdcMint = new anchor.web3.PublicKey(USDC_MINT_ADDRESS);

  const mintAmount = 10;
  const burnAmount = 5;


  const [payerATA] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      wallet.publicKey.toBytes(),
      TOKEN_2022_PROGRAM_ID.toBytes(),
      pdaMap.mint.toBytes()
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
        mint: pdaMap.mint,
        usdcMint,
        usdcKeeper: pdaMap.usdcKeeper,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        tokenProgram2022: TOKEN_2022_PROGRAM_ID,
      })
      .instruction();

    const tx = new anchor.web3.Transaction().add(ix);

    const sig = await sendAndConfirmTransaction(connection, tx, [wallet.payer]);
    console.log("Signature:", sig);

    const newMintInfo = await connection.getAccountInfo(pdaMap.mint);
    assert(newMintInfo, "Mint should be initialized.");

    const newUSDCKeeperInfo = await connection.getAccountInfo(pdaMap.usdcKeeper);
    assert(newUSDCKeeperInfo, "USDC keeper should be initialized.");
  });

  it("Initialize fees", async () => {
    const feesInfo = await connection.getAccountInfo(fees);
    if (feesInfo) {
      return; // Do not attempt to initialize if already initialized
    }

    const initFeesAccountSchema = borsh.struct([
      borsh.u64("discriminator"),
      borsh.u16("mintFeeBps"),
      borsh.u16("transferFeeBps"),
      borsh.u16("redemtionFeeBps"),
      borsh.publicKey("feeCollector"),
    ]);

    const ix = await program.methods
      .initializeFees(initFeesArgs)
      .accountsStrict({
        signer: wallet.publicKey,
        fees,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .instruction();

    const tx = new anchor.web3.Transaction().add(ix);

    const sig = await sendAndConfirmTransaction(connection, tx, [wallet.payer]);
    assert.ok(sig);

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

    const ix = await program.methods
      .updateFees(updateFeesArgs)
      .accountsStrict({
        signer: wallet.publicKey,
        fees,
      })
      .instruction();

    const tx = new anchor.web3.Transaction().add(ix);

    const sig = await sendAndConfirmTransaction(connection, tx, [wallet.payer]);
    assert.ok(sig);

    const feesInfo = await connection.getAccountInfo(fees);
    const updateFeesData = updateFeesAccountSchema.decode(feesInfo.data);
    assert.equal(updateFeesData.mint_fee_bps, updateFeesArgs.mintFeeBps, "Mint fee mismatch");
    assert.equal(updateFeesData.transfer_fee_bps, initFeesArgs.transferFeeBps, "Transfer fee mismatch");
    assert.equal(updateFeesData.redeem_fee_bps, updateFeesArgs.redemptionFeeBps, "Redemption fee mismatch");
    assert.equal(updateFeesArgs.feeCollector.toString(), updateFeesData.fee_collector.toString(), "Fee collector mismatch");
  });

  it("Initialize Freeze Account", async () => {
    await initializeFreeze(program, wallet, pdaMap);
    const freezeStateInfo = await connection.getAccountInfo(pdaMap.freezeState);
    assert(freezeStateInfo, "Freeze State should be initialized.");

    const freezeState = await getFreezeState(program, pdaMap);

    // Check Default values: 
    assert.ok(!freezeState.isFrozen, "Global freeze flag should be FALSE.");
    assert.ok(!freezeState.freezeMint, "Minting should be allowed.");
    assert.ok(!freezeState.freezeBurn, "Burning should be allowed.");
  })

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

    const usdcToBalance = (await connection.getTokenAccountBalance(pdaMap.usdcKeeper)).value.uiAmount;
    console.log("USDC To balance: ", usdcToBalance);


    const tx = new anchor.web3.Transaction();
    // Ensure the fee collector ATA exists
    let feeCollectorBalance;
    try {
      feeCollectorBalance = await getTokenBalance(connection, feeCollector2ATA);
    } catch {
      // Fee collector account doesn't exist, so initialize it
      tx.add(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          feeCollector2ATA,
          feeCollector2.publicKey,
          pdaMap.mint,
          TOKEN_2022_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );
    }

    // Fetch the current fee collector
    const feesAccount = await program.account.fees.fetch(pdaMap.fees);

    const ix = await program.methods
      .mintTokens(new anchor.BN(mintAmount * 10 ** RWD_DECIMALS))
      .accountsStrict({
        payer: wallet.publicKey,
        mint: pdaMap.mint,
        usdcMint,
        usdcKeeper: pdaMap.usdcKeeper,
        toAta: payerATA,
        usdcFromAta,
        fees: pdaMap.fees,
        feeCollector: feesAccount.feeCollector,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        tokenProgram2022: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        freezeState: pdaMap.freezeState,
      })
      .instruction();

    tx.add(ix);

    const sig = await sendAndConfirmTransaction(connection, tx, [wallet.payer]);
    assert.ok(sig);

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

    const usdcToPostBalance = (await program.provider.connection.getTokenAccountBalance(pdaMap.usdcKeeper)).value.uiAmount;
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
    const initialSupply = (await connection.getTokenSupply(pdaMap.mint)).value.uiAmount;
    const usdcFromBalance = (await connection.getTokenAccountBalance(pdaMap.usdcKeeper)).value.uiAmount;
    const usdcToBalance = (await connection.getTokenAccountBalance(usdcToAta)).value.uiAmount;

    const tx = new anchor.web3.Transaction();

    // Fetch the current fee collector
    const feesAccount = await program.account.fees.fetch(fees);

    const ix = await program.methods
      .burnTokens(new anchor.BN(burnAmount * 10 ** RWD_DECIMALS))
      .accountsStrict({
        signer: wallet.publicKey,
        mint: pdaMap.mint,
        usdcMint,
        usdcKeeper: pdaMap.usdcKeeper,
        fromAta: payerATA,
        usdcToAta,
        fees: fees,
        feeCollector: feesAccount.feeCollector,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        tokenProgram2022: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID
      })
      .instruction();

    tx.add(ix);

    const sig = await sendAndConfirmTransaction(connection, tx, [wallet.payer]);
    assert.ok(sig);

    const postRWDBalance = (await connection.getTokenAccountBalance(payerATA)).value.uiAmount;
    assert.equal(
      initialRWDBalance - burnAmount,
      postRWDBalance,
      "Compare RWD balances, it must be equal"
    );

    const postSupply = (await connection.getTokenSupply(pdaMap.mint)).value.uiAmount;
    assert.equal(
      initialSupply - burnAmount,
      postSupply,
      "Compare RWD supply, it must be equal"
    );

    const usdcFromPostBalance = (await connection.getTokenAccountBalance(pdaMap.usdcKeeper)).value.uiAmount;
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
