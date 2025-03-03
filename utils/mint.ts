import * as anchor from '@coral-xyz/anchor';
import { sendAndConfirmTransaction, PublicKey } from '@solana/web3.js';
import { 
    ASSOCIATED_TOKEN_PROGRAM_ID,
    createAssociatedTokenAccountInstruction,
    TOKEN_2022_PROGRAM_ID,
    TOKEN_PROGRAM_ID 
} from '@solana/spl-token';

import type { Rewards } from '../target/types/rewards';
import { getTokenBalance } from '../utils/setup';

/**
 * General-purpose function to mint tokens.
 *
 * @param {anchor.Program<any>} program - The Anchor program instance.
 * @param {anchor.Wallet} wallet - The wallet signing the transaction.
 * @param {anchor.BN} mintAmount - Amount of tokens to mint.
 * @param {PublicKey} payerATA - Associated token account of the payer.
 * @param {Record<string, PublicKey>} pdaMap - Contains various PDAs related to minting.
 * @param {PublicKey} feeCollectorPubkey - Public key of the fee collector.
 * @param {PublicKey} feeCollectorATA - Associated token account of the fee collector.
 * @param {PublicKey} usdcMint - The USDC mint address.
 * @returns {Promise<string>} - The transaction signature.
 */
export async function mintTokens(
    program: anchor.Program<Rewards>,
    wallet: anchor.Wallet,
    mintAmount: anchor.BN,
    payerATA: PublicKey,
    pdaMap: Record<string, PublicKey>,
    feeCollectorPubkey: PublicKey,
    feeCollectorATA: PublicKey,
    usdcMint: PublicKey
): Promise<string> {
    const connection = program.provider.connection;
    const tx = new anchor.web3.Transaction();

    const usdcFromAta = await anchor.utils.token.associatedAddress({
        mint: usdcMint,
        owner: wallet.publicKey,
    })

    // Ensure the fee collector ATA exists
    let feeCollectorBalance;
    try {
        feeCollectorBalance = await getTokenBalance(connection, feeCollectorATA);
    } catch {
        // Fee collector account doesn't exist, so initialize it
        tx.add(
            createAssociatedTokenAccountInstruction(
                wallet.publicKey,
                feeCollectorATA,
                feeCollectorPubkey,
                pdaMap.mint,
                TOKEN_2022_PROGRAM_ID,
                ASSOCIATED_TOKEN_PROGRAM_ID
            )
        );
    }

    // Fetch the current fee collector
    const feesAccount = await program.account.fees.fetch(pdaMap.fees);

    // Prepare mint instruction
    const ix = await program.methods
        .mintTokens(mintAmount)
        .accountsStrict({
            payer: wallet.publicKey,
            mint: pdaMap.mint,
            usdcMint,
            usdcKeeper: pdaMap.usdcKeeper,
            toAta: payerATA,
            usdcFromAta: usdcFromAta,
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

    return sig;
}
