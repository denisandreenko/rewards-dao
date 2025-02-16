use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    metadata::{
        create_metadata_accounts_v3, mpl_token_metadata::types::DataV2, CreateMetadataAccountsV3,
        Metadata as Metaplex,
    },
    token::{mint_to, Mint, MintTo, Token, TokenAccount},
};

declare_id!("DzGDD34981LzJKkL3U4okU4wRfCk6P3PUnK5MLzj4sxy");

#[program]
pub mod rewards {
    use super::*;

    pub fn initialize_token(_ctx: Context<InitToken>, metadata: InitTokenParams) -> Result<()> {
        let seeds = &["mint".as_bytes(), &[_ctx.bumps.mint]];
        let signer = [&seeds[..]];
        let token_data: DataV2 = DataV2 {
            name: metadata.name,
            symbol: metadata.symbol,
            uri: metadata.uri,
            seller_fee_basis_points: 0,
            creators: None,
            collection: None,
            uses: None,
        };
        let metadata_ctx = CpiContext::new_with_signer(
            _ctx.accounts.token_metadata_program.to_account_info(),
            CreateMetadataAccountsV3 {
                payer: _ctx.accounts.payer.to_account_info(), // owner address
                update_authority: _ctx.accounts.mint.to_account_info(),
                mint: _ctx.accounts.mint.to_account_info(), // owner address
                metadata: _ctx.accounts.metadata.to_account_info(),
                mint_authority: _ctx.accounts.mint.to_account_info(), // owner address
                system_program: _ctx.accounts.system_program.to_account_info(),
                rent: _ctx.accounts.rent.to_account_info(),
            },
            &signer,
        );
        create_metadata_accounts_v3(metadata_ctx, token_data, false, true, None)?;
        msg!("Token mint created successfully.");
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(params: InitTokenParams)]
pub struct InitToken<'info> {
    #[account(mut)] 
    /// CHECK: UncheckedAccount
    pub metadata: UncheckedAccount<'info>,
    #[account(
        init,
        seeds = [b"mint"],
        bump,
        payer = payer, 
        mint::decimals = params.decimals,
        mint::authority = mint,
    )]
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub token_metadata_program: Program<'info, Metaplex>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone)]
pub struct InitTokenParams {
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub decimals: u8,
}