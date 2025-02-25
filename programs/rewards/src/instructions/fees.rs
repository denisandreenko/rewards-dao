use anchor_lang::prelude::*;
use crate::constants::*;

use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount},
    token_interface::{
        self, Burn, Mint as Mint2022, TokenAccount as TokenAccount2022, TokenInterface,
    },
};

pub fn _initialize_fees(ctx: Context<InitializeFees>, args: InitFeesArgs) -> Result<()> {
    let fees = &mut ctx.accounts.fees;

    fees.mint_fee_bps = args.mint_fee_bps;
    fees.transfer_fee_bps = args.transfer_fee_bps;
    fees.redemption_fee_bps = args.redemption_fee_bps;
    fees.fee_collector = args.fee_collector;

    Ok(())
}

pub fn _update_fees(ctx: Context<UpdateFees>, args: UpdateFeesArgs) -> Result<()> {
    let fees = &mut ctx.accounts.fees;

    if let Some(mint_fee_bps) = args.mint_fee_bps {
        fees.mint_fee_bps = mint_fee_bps;
    }
    if let Some(transfer_fee_bps) = args.transfer_fee_bps {
        fees.transfer_fee_bps = transfer_fee_bps;
    }
    if let Some(redemption_fee_bps) = args.redemption_fee_bps {
        fees.redemption_fee_bps = redemption_fee_bps;
    }
    if let Some(fee_collector) = args.fee_collector {
        fees.fee_collector = fee_collector;
    }

    Ok(())
}

#[derive(Accounts)]
pub struct InitializeFees<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        init,
        payer = signer,
        seeds = [FEES_SEED],
        bump,
        space = DISCRIMINATOR + Fees::INIT_SPACE
    )]
    pub fees: Account<'info, Fees>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateFees<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        mut,
        seeds = [FEES_SEED],
        bump
    )]
    pub fees: Account<'info, Fees>,
}

#[account]
#[derive(InitSpace)]
pub struct Fees {
    pub mint_fee_bps: u16,
    pub transfer_fee_bps: u16,
    pub redemption_fee_bps: u16,
    pub fee_collector: Pubkey,
}

#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct InitFeesArgs {
    pub mint_fee_bps: u16,
    pub transfer_fee_bps: u16,
    pub redemption_fee_bps: u16,
    pub fee_collector: Pubkey,
}

#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct UpdateFeesArgs {
    pub mint_fee_bps: Option<u16>,
    pub transfer_fee_bps: Option<u16>,
    pub redemption_fee_bps: Option<u16>,
    pub fee_collector: Option<Pubkey>,
}