import assert from "assert";
import path from "path";
import { readFileSync } from "fs";
import * as toml from "toml";

import * as anchor from "@coral-xyz/anchor";
import { sendAndConfirmTransaction, PublicKey, SystemProgram } from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";

import { RWD_DECIMALS } from "../utils/constants";
import type { Rewards } from "../target/types/rewards";
import type { TransferHook } from "../target/types/transfer_hook";

// Parse Anchor.toml config to get tranfer hook program id
const anchorTomlPath = path.resolve(__dirname, '../Anchor.toml');  
const anchorToml = readFileSync(anchorTomlPath, 'utf-8');  
const parsedToml = toml.parse(anchorToml); 

export const initializeMint = async (
    mint_program: anchor.Program<Rewards>,
    wallet: anchor.Wallet,
    usdcMint: PublicKey,
    pdaMap: Record<string, anchor.web3.PublicKey>
) => {
    const connection = mint_program.provider.connection;

    const mintInfo = await connection.getAccountInfo(pdaMap.mint);
    if (mintInfo) {
        console.log("Mint already exists, skipping initialization.");
        return;
    }

    const transferHookProgramId = parsedToml.programs.localnet.transfer_hook
    const metadata = {
        name: "Rewards Token",
        symbol: "RWD",
        uri: "https://f47c2zywkjkof3eoprv7wvdzb5umkf36cdp6gusrwxosxvxj5v3q.arweave.net/Lz4tZxZSVOLsjnxr-1R5D2jFF34Q3-NSUbXdK9bp7Xc",
        decimals: RWD_DECIMALS,
        transferHookProgramId: new PublicKey(transferHookProgramId),
    }

    const ix = await mint_program.methods
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
    console.log("Mint initialized:", sig);
};

export const initializeFees = async (
    program: anchor.Program<Rewards>,
    wallet: anchor.Wallet,
    initFeesArgs: {
        mintFeeBps: number;
        transferFeeBps: number;
        redemptionFeeBps: number;
        feeCollector: anchor.web3.PublicKey;
    },
    pdaMap: Record<string, anchor.web3.PublicKey>
): Promise<boolean> => {
    const connection = program.provider.connection;
    const feesInfo = await connection.getAccountInfo(pdaMap.fees);

    if (feesInfo) {
        console.log("Fees account already already exists, skipping initialization.");
        return true;
    }

    const ix = await program.methods
        .initializeFees({
            mintFeeBps: initFeesArgs.mintFeeBps,
            transferFeeBps: initFeesArgs.transferFeeBps,
            redemptionFeeBps: initFeesArgs.redemptionFeeBps,
            feeCollector: initFeesArgs.feeCollector,
        })
        .accountsStrict({
            signer: wallet.publicKey,
            fees: pdaMap.fees,
            systemProgram: anchor.web3.SystemProgram.programId,
        })
        .instruction();

    const tx = new anchor.web3.Transaction().add(ix);

    const sig = await sendAndConfirmTransaction(connection, tx, [wallet.payer]);
    console.log("Fees initialized:", sig);

    const newFeesData = await program.account.fees.fetch(pdaMap.fees);
    assert(newFeesData, "Fees account should be initialized.");
    return false;
};


export const initializeFreeze = async (
    program: anchor.Program<Rewards>,
    wallet: anchor.Wallet,
    pdaMap: Record<string, anchor.web3.PublicKey>
): Promise<boolean> => {
    const connection = program.provider.connection;
    const freezeStateInfo = await connection.getAccountInfo(pdaMap.freezeState);

    if (freezeStateInfo) {
        console.log("Freeze Account already already exists, skipping initialization.");
        return true;
    }

    const ix = await program.methods
        .intializeFreeze()
        .accountsStrict({
            signer: wallet.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
            freezeState: pdaMap.freezeState,
            mint: pdaMap.mint,
        })
        .instruction();

    const tx = new anchor.web3.Transaction().add(ix);

    const sig = await sendAndConfirmTransaction(connection, tx, [wallet.payer]);
    console.log("Freeze Account initialized:", sig);
};

export const initializeExtraAccountMetaList = async (
    program: anchor.Program<TransferHook>,
    wallet: anchor.Wallet,
    pdaMap: Record<string, anchor.web3.PublicKey>
) => {
    const connection = program.provider.connection;

    const metaListInfo = await connection.getAccountInfo(pdaMap.extraAccountMetaList);
    if (metaListInfo) {
        console.log("ExtraAccountMetaList already exists, skipping initialization.");
        return;
    }

    const ix = await program.methods
        .initializeExtraAccountMetaList()
        .accountsStrict({
            mint: pdaMap.mint,
            extraAccountMetaList: pdaMap.extraAccountMetaList,
            signer: wallet.publicKey,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            whiteList: pdaMap.whitelist,
        })
        .instruction();

    const tx = new anchor.web3.Transaction().add(ix);

    const sig = await sendAndConfirmTransaction(connection, tx, [wallet.payer]);
    console.log("ExtraAccountMetaList initialized:", sig);
};

/**
 * Initialize all necessary accounts (Mint, Fees, etc.); useful to just quick init
 */
export const initializeAll = async (
    mint_program: anchor.Program<Rewards>,
    transfer_program: anchor.Program<TransferHook>,
    wallet: anchor.Wallet,
    usdcMint: PublicKey,
    initFeesArgs: {
        mintFeeBps: number;
        transferFeeBps: number;
        redemptionFeeBps: number;
        feeCollector: anchor.web3.PublicKey;
    },
    pdaMap: Record<string, anchor.web3.PublicKey>) => {

    await initializeMint(mint_program, wallet, usdcMint, pdaMap);
    await initializeFreeze(mint_program, wallet, pdaMap);
    await initializeFees(mint_program, wallet, initFeesArgs, pdaMap);
    await initializeExtraAccountMetaList(transfer_program, wallet, pdaMap);
};