use anchor_lang::prelude::*;

declare_id!("bwBXEXnTs8NaQhhWgoK3c3DC1nEx6kaRMyi3R3VSjnm");

#[program]
pub mod transfer_hook {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
