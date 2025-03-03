use anchor_lang::prelude::*;
declare_id!("44dqWPQqXs2TJ1DLDUBvpmLQz3NDBVgFsT5nZ5KkPoT5");

#[program]
mod dao {
    use super::*;

    pub fn initialize_member(ctx: Context<InitializeMember>) -> Result<()> {
        let member = &mut ctx.accounts.member;
        member.reputation_points = 0;
        Ok(())
    }

    pub fn submit_proposal(
        ctx: Context<SubmitProposal>,
        title: String,
        description: String,
        options: Vec<String>,
    ) -> Result<()> {
        let proposal = &mut ctx.accounts.governance_proposal;
        proposal.title = title;
        proposal.description = description;
        proposal.options = options;
        proposal.status = ProposalStatus::Open;
        proposal.votes = vec![];
        Ok(())
    }

    pub fn cast_vote(ctx: Context<CastVote>, option_index: u8) -> Result<()> {
        let proposal = &mut ctx.accounts.governance_proposal;
        let member = &mut ctx.accounts.member;

        let vote = Vote {
            voter: *member.to_account_info().key,
            option_index,
        };
        proposal.votes.push(vote);

        member.reputation_points += 1;

        Ok(())
    }

    pub fn close_proposal(ctx: Context<CloseProposal>) -> Result<()> {
        let proposal = &mut ctx.accounts.governance_proposal;
        
        require!(ctx.accounts.dao.is_signer, GovernanceError::UnauthorizedClose);

        proposal.status = ProposalStatus::Closed;
        Ok(())
    }

    pub fn get_proposal_results(ctx: Context<GetProposalResults>) -> Result<Vec<u64>> {
        let proposal = &ctx.accounts.governance_proposal;

        require!(
            proposal.status == ProposalStatus::Closed,
            GovernanceError::ProposalStillOpen
        );

        let mut results = vec![0; proposal.options.len()];

        for vote in &proposal.votes {
            if (vote.option_index as usize) < results.len() {
                results[vote.option_index as usize] += 1;
            }
        }

        Ok(results)
    }
}

#[account]
pub struct GovernanceProposal {
    pub title: String,
    pub description: String,
    pub options: Vec<String>,
    pub status: ProposalStatus,
    pub votes: Vec<Vote>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct Vote {
    pub voter: Pubkey,
    pub option_index: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum ProposalStatus {
    Open,
    Closed,
}

#[account]
pub struct Member {
    pub reputation_points: u64,
}

#[derive(Accounts)]
pub struct InitializeMember<'info> {
    #[account(init, payer = user, space = 8 + 8)]
    pub member: Account<'info, Member>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SubmitProposal<'info> {
    #[account(init, payer = proposer, space = 8 + 1024)]
    pub governance_proposal: Account<'info, GovernanceProposal>,
    #[account(mut)]
    pub proposer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CastVote<'info> {
    #[account(mut)]
    pub governance_proposal: Account<'info, GovernanceProposal>,
    #[account(mut)]
    pub member: Account<'info, Member>,
}

#[derive(Accounts)]
pub struct CloseProposal<'info> {
    #[account(mut)]
    pub governance_proposal: Account<'info, GovernanceProposal>,
    
    #[account(mut)]
    pub dao: Signer<'info>, 
}

#[derive(Accounts)]
pub struct GetProposalResults<'info> {
    pub governance_proposal: Account<'info, GovernanceProposal>,
}

#[error_code]
pub enum GovernanceError {
    #[msg("Cannot get results for an open proposal")]
    ProposalStillOpen,
    #[msg("Only the DAO admin can close the proposal")]
    UnauthorizedClose,
}
