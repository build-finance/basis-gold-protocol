// const POOL_START_DATE     = Math.round(Date.now() / 1000) + 1 * 60 * 60;
// const ORACLE_START_DATE   = Math.round(Date.now() / 1000) + 1 * 60 * 120;
// const TREASURY_START_DATE = Math.round(Date.now() / 1000) + 1 * 60 * 120;

const POOL_START_DATE     = 1610596800; // 01/14/2021 @ 4:00am (UTC)
const ORACLE_START_DATE   = 1611028800; // 01/19/2021 @ 4:00am (UTC)
const TREASURY_START_DATE = 1611201600; // 01/21/2021 @ 4:00am (UTC)

const UNI_FACTORY = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f';
const DAI = '0x6b175474e89094c44da98b954eedeac495271d0f';
    
module.exports = {
    POOL_START_DATE,
    ORACLE_START_DATE,
    TREASURY_START_DATE,
    UNI_FACTORY,
    DAI
}
