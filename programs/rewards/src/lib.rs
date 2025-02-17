use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint as Mint2022, TokenInterface, TokenMetadataInitialize};

pub mod utils;
pub use utils::*;

declare_id!("6NYSjPnBM6zH4VSxcMqUgGohHt9ggQpinetq1zi89dvw");

#[program]
pub mod rewards {
    use anchor_spl::token_interface;
    use super::*;

    pub fn initialize_token(_ctx: Context<InitToken>, metadata: InitTokenParams) -> Result<()> {
        let cpi_accounts = TokenMetadataInitialize {
            token_program_id: _ctx.accounts.token_program.to_account_info(),
            mint: _ctx.accounts.mint.to_account_info(),
            metadata: _ctx.accounts.mint.to_account_info(), 
            mint_authority: _ctx.accounts.payer.to_account_info(),
            update_authority: _ctx.accounts.payer.to_account_info(),
        };
        let cpi_program = _ctx.accounts.token_program.to_account_info();
        let cpi_context = CpiContext::new(cpi_program, cpi_accounts);

        token_interface::token_metadata_initialize(
            cpi_context,
            metadata.name,
            metadata.symbol,
            metadata.uri,
        )?;

        _ctx.accounts.mint.reload()?;
        // transfer minimum rent to mint account
        update_account_lamports_to_minimum_balance(
            _ctx.accounts.mint.to_account_info(),
            _ctx.accounts.payer.to_account_info(),
            _ctx.accounts.system_program.to_account_info(),
        )?;

        msg!("Token mint created successfully.");
        Ok(())
    }

    pub fn mint_tokens(ctx: Context<MintTokens>, quantity: u64) -> Result<()> {
        let seeds = &["mint".as_bytes(), &[ctx.bumps.mint]];
        let signer = [&seeds[..]];
        mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    authority: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.destination.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                },
                &signer,
            ),
            quantity,
        )?;
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(params: InitTokenParams)]
pub struct InitToken<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init,
        payer = payer,
        seeds = [b"mint"],
        bump,
        mint::decimals = params.decimals,
        mint::authority = payer,
        mint::token_program = token_program,
        extensions::metadata_pointer::authority = payer,
        extensions::metadata_pointer::metadata_address = mint,
        extensions::transfer_hook::authority = payer,
        extensions::transfer_hook::program_id = transfer_hook::ID,
    )]
    pub mint: Box<InterfaceAccount<'info, Mint2022>>,
    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct MintTokens<'info> {
    #[account(
        mut,
        seeds = [b"mint"],
        bump,
        mint::authority = mint,
    )]
    pub mint: Account<'info, Mint>,
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = payer,
    )]
    pub destination: Account<'info, TokenAccount>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub rent: Sysvar<'info, Rent>, // fee to hold accounts in this program (autocalculated)
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone)]
pub struct InitTokenParams {
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub decimals: u8,
}
