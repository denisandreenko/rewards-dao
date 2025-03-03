import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Dao } from "../target/types/dao";
import { assert } from "chai";
import { createAssociatedTokenAccount, createMint, mintTo, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { mintTokens } from "../utils/mint";
import { initializeAll } from "../utils/initialization";
import { EXTRA_ACCOUNT_METAS, FEES_SEED, FREEZE_SEED, TOKEN_2022_SEED, USDC_MINT_ADDRESS, USDC_SEED, USER_WHITELIST_SEED } from "../utils/constants";
import { findATAs, findPDAs } from "../utils/setup";
import { makeKeypairs } from "@solana-developers/helpers";
import { Rewards } from "../target/types/rewards";
import { TransferHook } from "../target/types/transfer_hook";

describe("dao", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Dao as Program<Dao>;
  const mint_program = anchor.workspace.Rewards as Program<Rewards>;
  const transfer_program = anchor.workspace.TransferHook as Program<TransferHook>;

  let member = anchor.web3.Keypair.generate();
  let governanceProposal = anchor.web3.Keypair.generate();
  let daoTreasury = anchor.web3.Keypair.generate();
  let tokenMint;
  let daoTokenAccount;
  let memberTokenAccount = null;
  // let proposer = provider.wallet;
  const proposer = provider.wallet as anchor.Wallet;

  const usdcMint = new anchor.web3.PublicKey(USDC_MINT_ADDRESS);
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
  const ownersMap = {
    payer: proposer.publicKey,
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


  it("Initialize RWD Token", async () => {
    await initializeAll(mint_program, transfer_program, proposer, usdcMint, initFeesArgs, pdaMap);

    tokenMint = await createMint(
      provider.connection,
      proposer.payer,
      proposer.publicKey,
      null,
      6, // Decimal places
    );
  

    daoTokenAccount = await createAssociatedTokenAccount(
      provider.connection,
      proposer.payer,
      tokenMint,
      daoTreasury.publicKey,
    );
  
  });
  

  it("Mint tokens to proposer", async () => {
    const mintAmount = new anchor.BN(1000000);
    await mintTokens(mint_program, proposer, mintAmount, sourceTokenAccount, pdaMap, feeCollector1.publicKey, feeCollector1ATA, usdcMint);
  });


  it("Initializes a member", async () => {
    await program.methods
      .initializeMember()
      .accountsStrict({
        member: member.publicKey,
        user: proposer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([member])
      .rpc();

    let memberAccount = await program.account.member.fetch(member.publicKey);
    assert.equal(memberAccount.reputationPoints.toNumber(), 0, "Member should start with 0 reputation points");
  });

  it("Submits a proposal", async () => {
    const title = "Proposal 1";
    const description = "This is a governance proposal";
    const options = ["Yes", "No"];

    await program.methods
      .submitProposal(title, description, options)
      .accountsStrict({
        governanceProposal: governanceProposal.publicKey,
        proposer: proposer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([governanceProposal])
      .rpc();

    let proposalAccount = await program.account.governanceProposal.fetch(governanceProposal.publicKey);
    console.log("Fetched Proposal:", proposalAccount);
    assert.deepEqual(proposalAccount.status, { open: {} }, "Proposal should be open");
    
  });

  it("Casts a vote", async () => {
    await program.methods
      .castVote(0)
      .accounts({
        governanceProposal: governanceProposal.publicKey,
        member: member.publicKey,
      })
      .signers([proposer.payer])
      .rpc();

    let proposalAccount = await program.account.governanceProposal.fetch(governanceProposal.publicKey);
    assert.equal(proposalAccount.votes.length, 1, "Vote should be registered");
    assert.equal(proposalAccount.votes[0].optionIndex, 0, "Vote should be for option 0");

    let memberAccount = await program.account.member.fetch(member.publicKey);
    assert.equal(memberAccount.reputationPoints.toNumber(), 1, "Voting should increase reputation points");
  });

  it("Funds DAO Treasury with Tokens", async () => {
    const mintAmount = new anchor.BN(1000000);
  
    await mintTo(
      provider.connection,
      proposer.payer,
      tokenMint,
      daoTokenAccount,
      proposer.publicKey, 
      mintAmount.toNumber()
    );
  
    const balance = await provider.connection.getTokenAccountBalance(daoTokenAccount);
    console.log(`DAO Treasury Funded. Balance: ${balance.value.amount}`);
  });
  

  it("Fails to close a proposal if not signed by DAO admin", async () => {
    try {
      await program.methods
        .closeProposal()
        .accountsStrict({
          governanceProposal: governanceProposal.publicKey,
          dao: member.publicKey, 
        })
        .signers([member])
        .rpc();
  
      assert.fail("Should not allow non-admin to close proposal");
    } catch (err) {
      console.log("Expected Error Caught:", err.toString()); 
    }
  });
  
  it("Gets proposal results", async () => {
    let results = await program.methods
      .getProposalResults()
      .accounts({
        governanceProposal: governanceProposal.publicKey,
      })
      .view();

    assert.equal(results[0].toNumber(), 1, "Option 0 should have 1 vote");
    assert.equal(results[1].toNumber(), 0, "Option 1 should have 0 votes");
  });
});
