use anchor_lang::prelude::*;
use crate::constants::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{
        self,
        Mint,
        Token,
        TokenAccount
    },
    token_interface::{
        self,
        Burn,
        Mint as Mint2022,
        TokenAccount as TokenAccount2022,
        TokenInterface
    },
};

pub fn _release_usdc(ctx: &Context<BurnTokens>, amount: u64) -> Result<()> {
    let cpi_accounts = token_interface::TransferChecked {
        mint: ctx.accounts.usdc_mint.to_account_info(),
        from: ctx.accounts.usdc_keeper.to_account_info(),  
        to: ctx.accounts.usdc_to_ata.to_account_info(),  
        authority: ctx.accounts.signer.to_account_info(),  
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_context = CpiContext::new(cpi_program, cpi_accounts);

    token_interface::transfer_checked(cpi_context, amount, USDC_DECIMALS)?;
    Ok(())
}

pub fn _burn_tokens(ctx: Context<BurnTokens>, amount: u64) -> Result<()> {
    let cpi_accounts = Burn {
        authority: ctx.accounts.signer.to_account_info(),
        from: ctx.accounts.from_ata.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program2022.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

    token_interface::burn(cpi_ctx, amount)?;
    Ok(())
}

#[derive(Accounts)]
pub struct BurnTokens<'info> {
    #[account(mut)]
    pub signer : Signer<'info>,
    
    #[account(
        mut,
        seeds = [TOKEN_2022_SEED],
        bump,
    )]
    pub mint: Box<InterfaceAccount<'info, Mint2022>>,

    #[account(
        address = USDC_MINT_ADDRESS_MAINNET,
        mint::token_program = token_program,
    )]
    pub usdc_mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [USDC_SEED],
        bump,
        token::mint = usdc_mint,
        token::authority = signer,
        token::token_program = token_program,
    )]
    pub usdc_keeper: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::authority = signer,
        associated_token::mint = mint,
        associated_token::token_program = token_program2022,
    )]
    pub from_ata: InterfaceAccount<'info, TokenAccount2022>,

    #[account(
        init_if_needed,
        payer = signer,
        associated_token::mint = usdc_mint,
        associated_token::authority = signer,
        associated_token::token_program = token_program,
    )]
    pub usdc_to_ata: Account<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub token_program2022: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}