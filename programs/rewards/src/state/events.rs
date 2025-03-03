use anchor_lang::prelude::*;
use crate::FreezeTarget;

#[event]
pub struct MintEvent {
    pub minter: Pubkey,
    pub receiver: Pubkey,
    pub amount_minted: u64,
    pub usdc_spent: u64,
    pub fee_amount: u64,
}

#[event]
pub struct BurnEvent {
    pub from_address: Pubkey,
    pub amount_burned: u64,
    pub fee_amount: u64,
    pub usdc_amount: u64,
    pub fee_collector: Pubkey,
}

#[event]
pub struct UpdateFeesEvent {
    pub mint_fee_bps: u16,
    pub transfer_fee_bps: u16,
    pub redemption_fee_bps: u16,
    pub fee_collector: Pubkey,
}

#[event]
pub struct FreezeStateChangedEvent {
    pub authority: Pubkey,
    pub target: FreezeTarget,
    pub is_frozen: bool,
}
