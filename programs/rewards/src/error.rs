use anchor_lang::prelude::*;

#[error_code]
pub enum RewardTokenError {
    #[msg("Unauthorized access: Caller does not have the required permissions.")]
    Unauthorized, // 6000

    #[msg("This operation is currently not allowed.")]
    OperationNotAllowed, // 6001

    #[msg("Insufficient Balance")]
    InsufficientBalance, // 6002

    #[msg("Bps out of range: Bps must be between 0 and 10000.")]
    BpsOutOfRange, // 6003

    #[msg("Recipient is not whitelisted.")]
    RecipientNotWhitelisted, // 6004

    #[msg("The token is not currently transferring")]
    IsNotCurrentlyTransferring, // 6005

    #[msg("All operations are currently frozen.")]
    GlobalFrozen, // 6006

    #[msg("Minting operations are currently frozen.")]
    MintFrozen, // 6007

    #[msg("Transferring operations are currently frozen.")]
    TransferFrozen, // 6008
    
    #[msg("Burning operations are currently frozen.")]
    BurnFrozen, // 6009
}