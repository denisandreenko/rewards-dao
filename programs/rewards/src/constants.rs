use anchor_lang::prelude::*; 

#[constant]
pub const TOKEN_2022_SEED: &[u8] = b"token-2022";

#[constant]
pub const USDC_SEED: &[u8] = b"usdc";

#[constant]
pub const FEES_SEED: &[u8] = b"fees";

#[constant]
pub const USDC_MINT_ADDRESS_DEVNET: Pubkey = pubkey!("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

#[constant]
pub const USDC_DECIMALS: u8 = 6;

pub const DISCRIMINATOR: usize = 8;
