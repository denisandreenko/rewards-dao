use anchor_lang::prelude::*;
use crate::TOKEN_MINT_SEED;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Token, Mint, Burn, TokenAccount}
};

pub fn _burn_tokens(ctx: Context<BurnTokens>, amount: u64) -> Result<()> {
    let cpi_accounts = Burn {
        authority: ctx.accounts.payer.to_account_info(),
        from: ctx.accounts.from_ata.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

    token::burn(cpi_ctx, amount)?;

    Ok(())
}

#[derive(Accounts)]
pub struct BurnTokens<'info> {
    #[account(
        mut,
        seeds = [TOKEN_MINT_SEED.as_bytes()],
        bump,
    )]
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = payer,
    )]
    pub from_ata: Account<'info, TokenAccount>,
    #[account(mut)]
    pub payer : Signer<'info>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}