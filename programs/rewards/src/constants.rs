use anchor_lang::prelude::*; 

#[constant]
pub const TOKEN_2022_SEED: &[u8] = b"token-2022";

#[constant]
pub const USDC_SEED: &[u8] = b"usdc";

#[constant]
pub const FEES_SEED: &[u8] = b"fees";

#[constant]
pub const FREEZE_SEED: &[u8] = b"freeze";

// Mainnet - EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
// Devnet - 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
#[constant]
pub const USDC_MINT_ADDRESS: Pubkey = pubkey!("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

#[constant]
pub const USDC_DECIMALS: u8 = 6;

#[constant]
pub const RWD_PER_USDC: u64 = 10;

pub const DISCRIMINATOR: usize = 8;
