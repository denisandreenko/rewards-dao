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
  RWD_PER_USDC,
} from '../utils/constants';
import { makeKeypairs, airdropIfRequired } from "@solana-developers/helpers"
import { calcFee, findATAs, findPDAs, getTokenBalance, toBN } from "../utils/setup";
import { initializeFreeze } from "../utils/initialization";
import { getFreezeState } from "../utils/freezeOps";
import { mintTokens } from "../utils/mint";
import { burnTokens } from "../utils/burn";

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

  const mintAmount = toBN(20, RWD_DECIMALS);
  const burnAmount = toBN(3, RWD_DECIMALS);


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

  it("Mint Token to payer", async () => {
    const usdcFromAta = await anchor.utils.token.associatedAddress({
      mint: usdcMint,
      owner: wallet.publicKey,
    });

    let initialRWDBalance: anchor.BN;
    try {
      initialRWDBalance = await getTokenBalance(connection, payerATA);
    } catch {
      // Token account not yet initiated has 0 balance
      initialRWDBalance = new anchor.BN(0);
    }

    const usdcFromBalance = await getTokenBalance(connection, usdcFromAta);
    const usdcToBalance = await getTokenBalance(connection, pdaMap.usdcKeeper);

    let initialFeeCollectorBalance: anchor.BN;
    try {
      initialFeeCollectorBalance = await getTokenBalance(connection, feeCollector2ATA);
    } catch {
      // Token account not yet initiated has 0 balance
      initialFeeCollectorBalance = new anchor.BN(0);
    }

    await mintTokens(
      program,
      wallet,
      mintAmount,
      payerATA,
      pdaMap,
      feeCollector2.publicKey,
      feeCollector2ATA,
      usdcMint
    );

    const fee = calcFee(mintAmount, updateFeesArgs.mintFeeBps);
    const mintAmountAfterFees = mintAmount.sub(fee);

    const postFeeCollectorBalance = await getTokenBalance(connection, feeCollector2ATA);
    assert.ok(
      postFeeCollectorBalance.eq(initialFeeCollectorBalance.add(fee)),
      "Fee collector balance should increase correctly"
    );

    const postRWDBalance = await getTokenBalance(connection, payerATA);
    assert.ok(
      postRWDBalance.eq(initialRWDBalance.add(mintAmountAfterFees)),
      "RWD balances should match after minting"
    );

    const usdcFromPostBalance = await getTokenBalance(connection, usdcFromAta);
    assert.ok(
      usdcFromPostBalance.eq(usdcFromBalance.sub(mintAmount.div(new anchor.BN(RWD_PER_USDC)))),
      "USDC From balance should decrease correctly"
    );

    const usdcToPostBalance = await getTokenBalance(connection, pdaMap.usdcKeeper);
    assert.ok(
      usdcToPostBalance.eq(usdcToBalance.add(mintAmount.div(new anchor.BN(RWD_PER_USDC)))),
      "USDC To balance should increase correctly"
    );
  });

  it("Burn Token", async () => {
    const usdcToAta = await anchor.utils.token.associatedAddress({
      mint: usdcMint,
      owner: wallet.publicKey,
    });

    const initialRWDBalance = await getTokenBalance(connection, payerATA);
    const initialSupply = new anchor.BN((await connection.getTokenSupply(pdaMap.mint)).value.amount);
    const usdcFromBalance = await getTokenBalance(connection, pdaMap.usdcKeeper);
    const usdcToBalance = await getTokenBalance(connection, usdcToAta);
    const feeCollectorBalance = await getTokenBalance(connection, feeCollector2ATA);

    const fee = calcFee(burnAmount, updateFeesArgs.redemptionFeeBps);

    const sig = await burnTokens(program, wallet, burnAmount, payerATA, feeCollector2ATA, pdaMap, usdcMint);
    console.log(sig);

    const postRWDBalance = await getTokenBalance(connection, payerATA);
    assert.ok(
      postRWDBalance.eq(initialRWDBalance.sub(burnAmount)),
      "SP balances should match after burning"
    );

    const postFeeCollectorBalance = await getTokenBalance(connection, feeCollector2ATA);
    assert.ok(
      feeCollectorBalance.add(fee).eq(postFeeCollectorBalance),
      "Fee collector post balance should increase correctly"
    );

    const postSupply = new anchor.BN((await connection.getTokenSupply(pdaMap.mint)).value.amount);
    assert.ok(
      postSupply.eq(initialSupply.sub(burnAmount.sub(fee))),
      "SP token supply should decrease correctly"
    );

    const usdcFromPostBalance = await getTokenBalance(connection, pdaMap.usdcKeeper);
    const burnAmountWithoutFee = burnAmount.sub(fee);
    assert.ok(
      usdcFromPostBalance.eq(usdcFromBalance.sub(burnAmountWithoutFee.div(new anchor.BN(RWD_PER_USDC)))),
      "USDC storage post balance should decrease correctly"
    );

    const usdcToPostBalance = await getTokenBalance(connection, usdcToAta);
    assert.ok(
      usdcToPostBalance.eq(usdcToBalance.add(burnAmountWithoutFee.div(new anchor.BN(RWD_PER_USDC)))),
      "USDC To balance should increase correctly"
    );
  });
});
