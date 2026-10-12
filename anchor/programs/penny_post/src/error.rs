use anchor_lang::prelude::*;

#[error_code]
pub enum PostError {
    #[msg("Only the program's upgrade authority can open the post office")]
    NotUpgradeAuthority,
    #[msg("The burn share is above the 20% ceiling")]
    BurnShareTooHigh,
    #[msg("That time zone offset is outside UTC-12:00 to UTC+14:00")]
    BadUtcOffset,
    #[msg("A letterbox price cannot be below the post office floor")]
    PriceBelowFloor,
    #[msg("You cannot post a card to yourself")]
    SelfAddressed,
    #[msg("The recipient letterbox account does not hold a letterbox")]
    BadLetterbox,
    #[msg("The postage is below this reader's price")]
    PostageTooLow,
    #[msg("This letterbox has taken its paid cards for that day")]
    LetterboxFull,
    #[msg("A free card needs a seal held by the sender")]
    NoSeal,
    #[msg("That seal belongs to another wallet")]
    SealNotYours,
    #[msg("Today's free stamp has already been used")]
    StampAlreadyUsed,
    #[msg("Postage or an express fee needs the sender's token account")]
    MissingSenderToken,
    #[msg("A paid card needs the reader's token account")]
    MissingReaderToken,
    #[msg("That token account does not belong here")]
    WrongTokenAccount,
    #[msg("The post has not come yet")]
    NotDeliveredYet,
    #[msg("Only the reader can send a card back before it expires")]
    NotExpiredYet,
    #[msg("That account is not a Seeker Genesis Token mint")]
    NotGenesisToken,
    #[msg("The Genesis Token is not in this wallet")]
    GenesisTokenNotHeld,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("The express fee is higher than the sender agreed to")]
    ExpressFeeTooHigh,
    #[msg("That day has already gone")]
    CircularDayPassed,
    #[msg("A circular needs a question and two to four short answers")]
    CircularBadQuestion,
    #[msg("The pot is below what a circular must carry")]
    CircularPotTooLow,
    #[msg("That day is taken, and taking it over needs a pot a tenth larger")]
    CircularBidTooLow,
    #[msg("A question that is already open cannot be replaced")]
    CircularAlreadyOpen,
    #[msg("Taking over a day needs the previous sponsor's accounts, to pay them back")]
    MissingPreviousSponsor,
    #[msg("This question is not open today")]
    CircularNotOpen,
    #[msg("This question is still open")]
    CircularStillOpen,
    #[msg("That is not one of the answers")]
    BadChoice,
    #[msg("Some phones have not collected their share yet")]
    CircularNotFinished,
}
