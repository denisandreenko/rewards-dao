use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{self, Mint, Burn, TokenAccount, TokenInterface}
};
use crate::constants::*;

pub fn _burn_tokens(ctx: Context<BurnTokens>, amount: u64) -> Result<()> {
    let cpi_accounts = Burn {
        authority: ctx.accounts.payer.to_account_info(),
        from: ctx.accounts.from_ata.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

    token_interface::burn(cpi_ctx, amount)?;
    Ok(())
}

#[derive(Accounts)]
pub struct BurnTokens<'info> {
    #[account(mut)]
    pub payer : Signer<'info>,
    #[account(
        mut,
        seeds = [TOKEN_2022_SEED],
        bump,
    )]
    pub mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        mut,
        associated_token::authority = payer,
        associated_token::mint = mint,
        associated_token::token_program = token_program,
    )]
    pub from_ata: InterfaceAccount<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}