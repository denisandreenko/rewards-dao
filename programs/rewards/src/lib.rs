use anchor_lang::prelude::*;

declare_id!("DzGDD34981LzJKkL3U4okU4wRfCk6P3PUnK5MLzj4sxy");

#[program]
pub mod rewards {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
