use anchor_lang::prelude::*;
use spl_transfer_hook_interface::instruction::TransferHookInstruction;
pub mod constants;
pub mod error;
pub mod events;
pub mod instructions;

pub use constants::*;
pub use instructions::*;
pub use error::*;
pub use events::*;

declare_id!("bwBXEXnTs8NaQhhWgoK3c3DC1nEx6kaRMyi3R3VSjnm");

#[program]
pub mod transfer_hook {
    use super::*;

    pub fn initialize_extra_account_meta_list(ctx: Context<InitializeExtraAccountMetaList>,) -> Result<()> {
        _initialize_extra_account_meta_list(ctx)
    }
    
    pub fn transfer_hook(ctx: Context<TransferHook>, amount: u64) -> Result<()> {
        _transfer_hook(ctx, amount)
    }
    // Required for transfer_hook
    // fallback instruction handler as workaround to anchor instruction discriminator check
    pub fn fallback<'info>(
        program_id: &Pubkey,
        accounts: &'info [AccountInfo<'info>],
        data: &[u8],
    ) -> Result<()> {
        let instruction = TransferHookInstruction::unpack(data)?;

        // match instruction discriminator to transfer hook interface execute instruction
        // token2022 program CPIs this instruction on token transfer
        match instruction {
            TransferHookInstruction::Execute { amount } => {
                let amount_bytes = amount.to_le_bytes();

                // invoke custom transfer hook instruction on our program
                __private::__global::transfer_hook(program_id, accounts, &amount_bytes)
            }
            _ => return Err(ProgramError::InvalidInstructionData.into()),
        }
    }
}

#[derive(Accounts)]
pub struct Initialize {}
