import assert from "assert";

import * as anchor from "@coral-xyz/anchor";
import {
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getMint,
  createTransferCheckedInstruction,
} from "@solana/spl-token";
import { makeKeypairs } from "@solana-developers/helpers"

import {
  EXTRA_ACCOUNT_METAS,
  FEES_SEED,
  FREEZE_SEED,
  TOKEN_2022_SEED,
  USDC_MINT_ADDRESS,
  USDC_SEED,
  USER_WHITELIST_SEED,
  RWD_DECIMALS
} from "../utils/constants";
import { findATAs, findPDAs, getProvider, toBN } from "../utils/setup";
import { initializeAll } from "../utils/initialization";
import { transferTokens } from "../utils/transfer";
import type { Rewards } from '../target/types/rewards';
import type { TransferHook } from "../target/types/transfer_hook";

describe("transfer-hook", () => {

  const provider = getProvider();
  const mint_program = anchor.workspace.Rewards as anchor.Program<Rewards>;
  const transfer_program = anchor.workspace.TransferHook as anchor.Program<TransferHook>;
  const connection = provider.connection;
  const wallet = provider.wallet as anchor.Wallet;

  const [receiver, feeCollector1, feeCollector2] = makeKeypairs(3);

  // Define PDAs dynamically
  let pdaMap = findPDAs(mint_program, {
    mint: [Buffer.from(TOKEN_2022_SEED)],
    usdcKeeper: [Buffer.from(USDC_SEED)],
    fees: [Buffer.from(FEES_SEED)],
    freezeState: [Buffer.from(FREEZE_SEED)],
  });

  // Transfer Hook Program PDAs:
  const pdasFromTransferProgram = findPDAs(transfer_program, {
    extraAccountMetaList: [Buffer.from(EXTRA_ACCOUNT_METAS), pdaMap.mint.toBuffer()],
    whitelist: [Buffer.from(USER_WHITELIST_SEED)],
});

  pdaMap = { ...pdaMap, ...pdasFromTransferProgram };

  const usdcMint = new anchor.web3.PublicKey(USDC_MINT_ADDRESS);

  const ownersMap = {
    payer: wallet.publicKey,
    recipient: receiver.publicKey,
    feeCollector1: feeCollector1.publicKey,
    feeCollector2: feeCollector2.publicKey,
  };

  // Generate associated token accounts (ATAs) for all owners
  const ataMap = findATAs(pdaMap.mint, ownersMap);
  const sourceTokenAccount = ataMap.payer;
  const destinationTokenAccount = ataMap.recipient;
  const feeCollector1ATA = ataMap.feeCollector1;

  const initFeesArgs = {
    mintFeeBps: 100,
    transferFeeBps: 100,
    redemptionFeeBps: 100,
    feeCollector: feeCollector1ATA,
  }

  const transferAmount = toBN(5, RWD_DECIMALS);

  it("Initialize Mint & Fees", async () => {
    await initializeAll(mint_program, transfer_program, wallet, usdcMint, initFeesArgs, pdaMap)

    const newMintInfo = await connection.getAccountInfo(pdaMap.mint);
    assert(newMintInfo, "Mint should be initialized.");
    const newUSDCKeeperInfo = await connection.getAccountInfo(pdaMap.usdcKeeper);
    assert(newUSDCKeeperInfo, "USDC keeper should be initialized.");
  });


  it("Create Token Accounts and Mint Tokens", async () => {
    const mintAmount = toBN(100, RWD_DECIMALS);

    // Fetch existing token accounts
    const sourceAccountInfo = await connection.getAccountInfo(sourceTokenAccount);
    const destinationAccountInfo = await connection.getAccountInfo(destinationTokenAccount);

    const tx = new Transaction();

    if (!sourceAccountInfo) {
      console.log("Source token account missing. Recreating...");
      tx.add(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          sourceTokenAccount,
          wallet.publicKey,
          pdaMap.mint,
          TOKEN_2022_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );
    }
    if (!destinationAccountInfo) {
      console.log("Destination token account missing. Recreating...");
      tx.add(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          destinationTokenAccount,
          receiver.publicKey,
          pdaMap.mint,
          TOKEN_2022_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );
    }

    tx.add(
      createMintToInstruction(
        pdaMap.mint,
        sourceTokenAccount,
        wallet.publicKey,
        mintAmount.toNumber(),
        [],
        TOKEN_2022_PROGRAM_ID
      )
    );

    const sig = await sendAndConfirmTransaction(connection, tx, [wallet.payer]);
    console.log(sig);
    assert.ok(sig)
  });

  it("Regular Transfer (Should Fail if Transfer Hook is Enforced)", async () => {
    const tx = new anchor.web3.Transaction();

    // Attempt a standard token transfer (without using the transfer hook instruction)
    // It should fail since Transfer Hook requires additional accounts + program enforces it goes through hook
    tx.add(
      createTransferCheckedInstruction(
        sourceTokenAccount,
        pdaMap.mint,
        destinationTokenAccount,
        wallet.publicKey,
        transferAmount.toNumber(),
        RWD_DECIMALS,
        [],
        TOKEN_2022_PROGRAM_ID
      )
    );

    try {
      await sendAndConfirmTransaction(connection, tx, [wallet.payer]);
      assert.fail();
    } catch (err) {
      assert(err.message.includes("custom program error"), "Ensure correct error is thrown");
    }
  });

  it("Transfer Hook with Extra Account Meta", async () => {
    const mintData = await getMint(connection, pdaMap.mint, "confirmed", TOKEN_2022_PROGRAM_ID);
    const hasTransferHook = mintData.tlvData.includes(ExtensionType.TransferHook);
    assert(hasTransferHook, "Transfer Hook Extension Not Found");

    await transferTokens(transfer_program, wallet, transferAmount, sourceTokenAccount, destinationTokenAccount, pdaMap);
  });

});