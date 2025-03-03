import * as anchor from "@coral-xyz/anchor";
import { sendAndConfirmTransaction, PublicKey } from "@solana/web3.js";
import {
    TOKEN_2022_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

import { Rewards } from "../target/types/rewards";
import { RWD_DECIMALS } from "./constants";

/**
 * Burns a specified amount of tokens from the sender's account.
 *
 * @param {anchor.Program} program - The Anchor program instance.
 * @param {anchor.Wallet} wallet - The user's wallet.
 * @param {anchor.BN} amount - The amount of tokens to burn.
 * @param {PublicKey} payerATA - The user's token account (from which tokens are burned).
 * @param {Record<string, PublicKey>} pdaMap - PDA map containing relevant program addresses.
 * @param {PublicKey} usdcMint - The USDC mint address.
 * @returns {Promise<string>} The transaction signature.
 */
export async function burnTokens(
    program: anchor.Program<Rewards>,
    wallet: anchor.Wallet,
    amount: anchor.BN,
    payerATA: PublicKey,
    feeCollector: PublicKey,
    pdaMap: Record<string, PublicKey>,
    usdcMint: PublicKey
): Promise<string> {
    const connection = program.provider.connection;

    const usdcToAta = await anchor.utils.token.associatedAddress({
        mint: usdcMint,
        owner: wallet.publicKey,
    });

    const ix = await program.methods
        .burnTokens(amount)
        .accountsStrict({
            signer: wallet.publicKey,
            mint: pdaMap.mint,
            usdcMint,
            usdcKeeper: pdaMap.usdcKeeper,
            fromAta: payerATA,
            usdcToAta,
            fees: pdaMap.fees,
            feeCollector,
            systemProgram: anchor.web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            tokenProgram2022: TOKEN_2022_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .instruction();

    const tx = new anchor.web3.Transaction().add(ix);

    const sig = await sendAndConfirmTransaction(connection, tx, [wallet.payer]);
    return sig;
}