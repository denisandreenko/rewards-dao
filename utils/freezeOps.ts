import * as anchor from "@coral-xyz/anchor";
import { PublicKey, sendAndConfirmTransaction } from "@solana/web3.js";

import type { Rewards } from "../target/types/rewards";
import { TransferHook } from "../target/types/transfer_hook";

/**
 * **FREEZE an operation (All, Mint, Burn)**
 * @param {anchor.Program<Rewards>} program - The Anchor program instance.
 * @param {PublicKey} mint - The mint account whose freeze state is being modified.
 * @param {anchor.Wallet} wallet - The admin wallet signing the transaction.
 * @param {FreezeTarget} target - Which operation to freeze.
 * @returns {Promise<string>} - Transaction signature.
 */
export const freezeOperation = async (
    program: anchor.Program<Rewards>,
    wallet: anchor.Wallet | anchor.web3.Keypair,
    target: any,
    pdaMap: Record<string, PublicKey>,
): Promise<string> => {
    const signer = wallet instanceof anchor.Wallet ? wallet.payer : wallet;
    const connection = program.provider.connection;
    const tx = new anchor.web3.Transaction();

    const ix = await program.methods.freeze(target)
        .accountsStrict({
            freezeState: pdaMap.freezeState,
            mint: pdaMap.mint,
            signer: wallet.publicKey,
        })
        .instruction();

    tx.add(ix);
    const sig = await sendAndConfirmTransaction(connection, tx, [signer]);
    console.log("Freeze signature:", sig);

    return sig;
};


/**
 * **FREEZE an operation Transfer**
 * @param {anchor.Program<Rewards>} program - The Anchor program instance.
 * @param {PublicKey} mint - The mint account whose freeze state is being modified.
 * @param {anchor.Wallet} wallet - The admin wallet signing the transaction.
 * @param {FreezeTarget} target - Which operation to freeze.
 * @returns {Promise<string>} - Transaction signature.
 */
export const freezeTransferOperation = async (
    program: anchor.Program<TransferHook>,
    wallet: anchor.Wallet | anchor.web3.Keypair,
    pdaMap: Record<string, PublicKey>,
): Promise<string> => {
    const signer = wallet instanceof anchor.Wallet ? wallet.payer : wallet;
    const connection = program.provider.connection;
    const tx = new anchor.web3.Transaction();

    const ix = await program.methods.freeze()
        .accountsStrict({
            whiteList: pdaMap.whitelist,
            signer: wallet.publicKey,
            user: wallet.publicKey
        })
        .instruction();

    tx.add(ix);
    const sig = await sendAndConfirmTransaction(connection, tx, [signer]);
    console.log("Freeze Transfer signature:", sig);

    return sig;
};

/**
 * **UNFREEZE an operation (All, Mint, Burn)**
 * @param {anchor.Program<Rewards>} program - The Anchor program instance.
 * @param {PublicKey} mint - The mint account whose freeze state is being modified.
 * @param {anchor.Wallet} wallet - The admin wallet signing the transaction.
 * @param {FreezeTarget} target - Which operation to unfreeze.
 * @param {Record<string, PublicKey>} pdaMap - The mint account whose freeze state is being checked.
 * @returns {Promise<string>} - Transaction signature.
 */
export const unfreezeOperation = async (
    program: anchor.Program<Rewards>,
    wallet: anchor.Wallet | anchor.web3.Keypair,
    target: any,
    pdaMap: Record<string, PublicKey>,
): Promise<string> => {
    const signer = wallet instanceof anchor.Wallet ? wallet.payer : wallet;
    const connection = program.provider.connection;
    const tx = new anchor.web3.Transaction();

    const ix = await program.methods.unfreeze(target)
        .accountsStrict({
            freezeState: pdaMap.freezeState,
            mint: pdaMap.mint,
            signer: wallet.publicKey,
        })
        .instruction();

    tx.add(ix);
    const sig = await sendAndConfirmTransaction(connection, tx, [signer]);
    console.log("UnFreeze signature:", sig);
    return sig;
};
/**
 * **UNFREEZE operation Transfer**
 * @param {anchor.Program<Rewards>} program - The Anchor program instance.
 * @param {PublicKey} mint - The mint account whose freeze state is being modified.
 * @param {anchor.Wallet} wallet - The admin wallet signing the transaction.
 * @param {FreezeTarget} target - Which operation to unfreeze.
 * @param {Record<string, PublicKey>} pdaMap - The mint account whose freeze state is being checked.
 * @returns {Promise<string>} - Transaction signature.
 */
export const unfreezeTransferOperation = async (
    program: anchor.Program<TransferHook>,
    wallet: anchor.Wallet | anchor.web3.Keypair,
    pdaMap: Record<string, PublicKey>,
): Promise<string> => {
    const signer = wallet instanceof anchor.Wallet ? wallet.payer : wallet;
    const connection = program.provider.connection;
    const tx = new anchor.web3.Transaction();

    const ix = await program.methods.unfreeze()
        .accountsStrict({
            whiteList: pdaMap.whitelist,
            signer: wallet.publicKey,
            user: wallet.publicKey,
        })
        .instruction();

    tx.add(ix);
    const sig = await sendAndConfirmTransaction(connection, tx, [signer]);
    console.log("UnFreeze Transfer signature:", sig);
    return sig;
};

/**
 * Fetches the current freeze state from the on-chain PDA.
 * @param {anchor.Program<Rewards>} program - The Anchor program instance.
 * @param {Record<string, PublicKey>} pdaMap - The mint account whose freeze state is being checked.
 * @returns {Promise<any>} - Freeze state data.
 */
export const getFreezeState = async (
    program: anchor.Program<Rewards>,
    pdaMap: Record<string, PublicKey>,
): Promise<any> => {
    try {
        const freezeState = await program.account.freezeState.fetch(pdaMap.freezeState);
        return freezeState;
    } catch (error) {
        console.error("Error fetching freeze state:", error);
        return null;
    }
};

/**
 * Fetches the current transfer freeze state from whitelistpda
 * @param {anchor.Program<Rewards>} program - The Anchor program instance.
 * @param {Record<string, PublicKey>} pdaMap - The mint account whose freeze state is being checked.
 * @returns {Promise<any>} - Freeze state data.
 */
export const getWhitelistFreezeState = async (
    program: anchor.Program<TransferHook>,
    pdaMap: Record<string, PublicKey>,
): Promise<Boolean | null> => {
    console.log("Fetching WhiteList PDA:", pdaMap.whiteList);

    try {
        const whitelistAccount = await program.account.whiteList.fetch(pdaMap.whitelist);
        return whitelistAccount.freezeTransfer; 
    } catch (error) {
        console.error("Error fetching whitelist authority:", error);
        return null;
    }
};
