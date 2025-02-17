use anchor_lang::prelude::*;

declare_id!("44dqWPQqXs2TJ1DLDUBvpmLQz3NDBVgFsT5nZ5KkPoT5");

#[program]
pub mod dao {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
