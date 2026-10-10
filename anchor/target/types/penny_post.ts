/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/penny_post.json`.
 */
export type PennyPost = {
  "address": "D5LZ7kUmpXhE2hsKHnse9itthWHX6j8o4EkGcfz2MLAD",
  "metadata": {
    "name": "pennyPost",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Penny Post: a letterbox for every .skr name. Postage sits in escrow until the reader signs for the card."
  },
  "instructions": [
    {
      "name": "openCard",
      "discriminator": [
        161,
        252,
        38,
        184,
        192,
        45,
        152,
        172
      ],
      "accounts": [
        {
          "name": "recipient",
          "writable": true,
          "signer": true,
          "relations": [
            "card"
          ]
        },
        {
          "name": "sender",
          "writable": true,
          "relations": [
            "card"
          ]
        },
        {
          "name": "card",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  97,
                  114,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "sender"
              },
              {
                "kind": "account",
                "path": "card.cardId",
                "account": "card"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "card"
              }
            ]
          }
        },
        {
          "name": "recipientToken",
          "writable": true,
          "optional": true
        },
        {
          "name": "recipientLetterbox",
          "docs": [
            "open a card without ever opening a letterbox, so the handler loads it by",
            "hand and skips the tally if there is none."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  116,
                  116,
                  101,
                  114,
                  98,
                  111,
                  120
                ]
              },
              {
                "kind": "account",
                "path": "recipient"
              }
            ]
          }
        },
        {
          "name": "postOffice",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  115,
                  116,
                  95,
                  111,
                  102,
                  102,
                  105,
                  99,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "postageMint",
          "writable": true,
          "relations": [
            "postOffice"
          ]
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "openLetterbox",
      "discriminator": [
        120,
        230,
        115,
        46,
        26,
        11,
        201,
        242
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "letterbox",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  116,
                  116,
                  101,
                  114,
                  98,
                  111,
                  120
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "postOffice",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  115,
                  116,
                  95,
                  111,
                  102,
                  102,
                  105,
                  99,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "readingKey",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "price",
          "type": "u64"
        },
        {
          "name": "utcOffsetMinutes",
          "type": "i16"
        }
      ]
    },
    {
      "name": "openPostOffice",
      "discriminator": [
        185,
        97,
        137,
        26,
        136,
        198,
        123,
        68
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "postOffice",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  115,
                  116,
                  95,
                  111,
                  102,
                  102,
                  105,
                  99,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "postageMint"
        },
        {
          "name": "program",
          "address": "D5LZ7kUmpXhE2hsKHnse9itthWHX6j8o4EkGcfz2MLAD"
        },
        {
          "name": "programData"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "terms",
          "type": {
            "defined": {
              "name": "terms"
            }
          }
        },
        {
          "name": "sgtGroup",
          "type": "pubkey"
        },
        {
          "name": "sgtMintAuthority",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "postCard",
      "discriminator": [
        156,
        34,
        80,
        249,
        125,
        98,
        223,
        43
      ],
      "accounts": [
        {
          "name": "sender",
          "writable": true,
          "signer": true
        },
        {
          "name": "recipient",
          "docs": [
            "is not the sender."
          ]
        },
        {
          "name": "card",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  97,
                  114,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "sender"
              },
              {
                "kind": "arg",
                "path": "cardId"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "card"
              }
            ]
          }
        },
        {
          "name": "recipientLetterbox",
          "docs": [
            "another letterbox or leave this one out to dodge the reader's price. The",
            "reader may not have opened a letterbox yet, so the handler loads it by",
            "hand and treats a missing one as \"no letterbox\"."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  116,
                  116,
                  101,
                  114,
                  98,
                  111,
                  120
                ]
              },
              {
                "kind": "account",
                "path": "recipient"
              }
            ]
          }
        },
        {
          "name": "senderToken",
          "writable": true,
          "optional": true
        },
        {
          "name": "senderSeal",
          "writable": true,
          "optional": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  101,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "senderSeal.sgtMint",
                "account": "seal"
              }
            ]
          }
        },
        {
          "name": "postOffice",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  115,
                  116,
                  95,
                  111,
                  102,
                  102,
                  105,
                  99,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "postageMint",
          "writable": true,
          "relations": [
            "postOffice"
          ]
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "cardId",
          "type": "u64"
        },
        {
          "name": "postage",
          "type": "u64"
        },
        {
          "name": "contentHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "stamp",
          "type": "u16"
        },
        {
          "name": "express",
          "type": "bool"
        }
      ]
    },
    {
      "name": "returnCard",
      "discriminator": [
        125,
        9,
        101,
        59,
        149,
        134,
        126,
        22
      ],
      "accounts": [
        {
          "name": "caller",
          "signer": true
        },
        {
          "name": "sender",
          "writable": true,
          "relations": [
            "card"
          ]
        },
        {
          "name": "card",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  97,
                  114,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "sender"
              },
              {
                "kind": "account",
                "path": "card.cardId",
                "account": "card"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "card"
              }
            ]
          }
        },
        {
          "name": "senderToken",
          "writable": true,
          "optional": true
        },
        {
          "name": "postOffice",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  115,
                  116,
                  95,
                  111,
                  102,
                  102,
                  105,
                  99,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "postageMint",
          "relations": [
            "postOffice"
          ]
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "setLetterbox",
      "discriminator": [
        50,
        17,
        249,
        74,
        221,
        232,
        168,
        118
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "letterbox"
          ]
        },
        {
          "name": "letterbox",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  116,
                  116,
                  101,
                  114,
                  98,
                  111,
                  120
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "postOffice",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  115,
                  116,
                  95,
                  111,
                  102,
                  102,
                  105,
                  99,
                  101
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "readingKey",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "price",
          "type": "u64"
        },
        {
          "name": "utcOffsetMinutes",
          "type": "i16"
        }
      ]
    },
    {
      "name": "setTerms",
      "discriminator": [
        198,
        18,
        197,
        226,
        220,
        230,
        87,
        173
      ],
      "accounts": [
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "postOffice"
          ]
        },
        {
          "name": "postOffice",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  115,
                  116,
                  95,
                  111,
                  102,
                  102,
                  105,
                  99,
                  101
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "terms",
          "type": {
            "defined": {
              "name": "terms"
            }
          }
        }
      ]
    },
    {
      "name": "verifyLetterbox",
      "discriminator": [
        7,
        220,
        80,
        152,
        46,
        101,
        207,
        106
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "letterbox"
          ]
        },
        {
          "name": "letterbox",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  116,
                  116,
                  101,
                  114,
                  98,
                  111,
                  120
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "postOffice",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  115,
                  116,
                  95,
                  111,
                  102,
                  102,
                  105,
                  99,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "sgtMint",
          "docs": [
            "and group membership and compares both with the post office's record."
          ]
        },
        {
          "name": "sgtToken",
          "docs": [
            "account and requires that it holds exactly one of `sgt_mint` for `owner`."
          ]
        },
        {
          "name": "seal",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  101,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "sgtMint"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "card",
      "discriminator": [
        166,
        250,
        46,
        230,
        152,
        63,
        140,
        182
      ]
    },
    {
      "name": "letterbox",
      "discriminator": [
        47,
        83,
        120,
        52,
        88,
        157,
        166,
        89
      ]
    },
    {
      "name": "postOffice",
      "discriminator": [
        161,
        160,
        143,
        130,
        251,
        2,
        63,
        36
      ]
    },
    {
      "name": "seal",
      "discriminator": [
        162,
        149,
        250,
        10,
        100,
        125,
        36,
        168
      ]
    }
  ],
  "events": [
    {
      "name": "cardOpened",
      "discriminator": [
        219,
        5,
        173,
        44,
        107,
        139,
        136,
        87
      ]
    },
    {
      "name": "cardPosted",
      "discriminator": [
        252,
        211,
        62,
        28,
        94,
        235,
        122,
        81
      ]
    },
    {
      "name": "cardReturned",
      "discriminator": [
        88,
        9,
        52,
        95,
        99,
        249,
        46,
        210
      ]
    },
    {
      "name": "letterboxVerified",
      "discriminator": [
        166,
        24,
        70,
        84,
        50,
        47,
        119,
        3
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "notUpgradeAuthority",
      "msg": "Only the program's upgrade authority can open the post office"
    },
    {
      "code": 6001,
      "name": "burnShareTooHigh",
      "msg": "The burn share is above the 20% ceiling"
    },
    {
      "code": 6002,
      "name": "badUtcOffset",
      "msg": "That time zone offset is outside UTC-12:00 to UTC+14:00"
    },
    {
      "code": 6003,
      "name": "priceBelowFloor",
      "msg": "A letterbox price cannot be below the post office floor"
    },
    {
      "code": 6004,
      "name": "selfAddressed",
      "msg": "You cannot post a card to yourself"
    },
    {
      "code": 6005,
      "name": "badLetterbox",
      "msg": "The recipient letterbox account does not hold a letterbox"
    },
    {
      "code": 6006,
      "name": "postageTooLow",
      "msg": "The postage is below this reader's price"
    },
    {
      "code": 6007,
      "name": "letterboxFull",
      "msg": "This letterbox has taken its paid cards for that day"
    },
    {
      "code": 6008,
      "name": "noSeal",
      "msg": "A free card needs a seal held by the sender"
    },
    {
      "code": 6009,
      "name": "sealNotYours",
      "msg": "That seal belongs to another wallet"
    },
    {
      "code": 6010,
      "name": "stampAlreadyUsed",
      "msg": "Today's free stamp has already been used"
    },
    {
      "code": 6011,
      "name": "missingSenderToken",
      "msg": "Postage or an express fee needs the sender's token account"
    },
    {
      "code": 6012,
      "name": "missingReaderToken",
      "msg": "A paid card needs the reader's token account"
    },
    {
      "code": 6013,
      "name": "wrongTokenAccount",
      "msg": "That token account does not belong here"
    },
    {
      "code": 6014,
      "name": "notDeliveredYet",
      "msg": "The post has not come yet"
    },
    {
      "code": 6015,
      "name": "notExpiredYet",
      "msg": "Only the reader can send a card back before it expires"
    },
    {
      "code": 6016,
      "name": "notGenesisToken",
      "msg": "That account is not a Seeker Genesis Token mint"
    },
    {
      "code": 6017,
      "name": "genesisTokenNotHeld",
      "msg": "The Genesis Token is not in this wallet"
    },
    {
      "code": 6018,
      "name": "overflow",
      "msg": "Arithmetic overflow"
    }
  ],
  "types": [
    {
      "name": "card",
      "docs": [
        "A card in the post. Closed when it is opened or returned, and its rent goes",
        "back to the sender."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "sender",
            "type": "pubkey"
          },
          {
            "name": "recipient",
            "type": "pubkey"
          },
          {
            "name": "postage",
            "type": "u64"
          },
          {
            "name": "cardId",
            "type": "u64"
          },
          {
            "name": "contentHash",
            "docs": [
              "SHA-256 of the card as stored off-chain."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "postedAt",
            "type": "i64"
          },
          {
            "name": "deliverAt",
            "type": "i64"
          },
          {
            "name": "expiresAt",
            "type": "i64"
          },
          {
            "name": "stamp",
            "type": "u16"
          },
          {
            "name": "express",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "cardOpened",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "card",
            "type": "pubkey"
          },
          {
            "name": "sender",
            "type": "pubkey"
          },
          {
            "name": "recipient",
            "type": "pubkey"
          },
          {
            "name": "paidToReader",
            "type": "u64"
          },
          {
            "name": "burned",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "cardPosted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "card",
            "type": "pubkey"
          },
          {
            "name": "sender",
            "type": "pubkey"
          },
          {
            "name": "recipient",
            "type": "pubkey"
          },
          {
            "name": "postage",
            "type": "u64"
          },
          {
            "name": "deliverAt",
            "type": "i64"
          },
          {
            "name": "express",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "cardReturned",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "card",
            "type": "pubkey"
          },
          {
            "name": "sender",
            "type": "pubkey"
          },
          {
            "name": "recipient",
            "type": "pubkey"
          },
          {
            "name": "refunded",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "letterbox",
      "docs": [
        "A reader's letterbox. One per wallet."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "readingKey",
            "docs": [
              "X25519 public key senders seal letters to."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "price",
            "docs": [
              "What a stranger pays to reach this reader, in base units."
            ],
            "type": "u64"
          },
          {
            "name": "earned",
            "docs": [
              "Postage this reader has been paid, in base units."
            ],
            "type": "u64"
          },
          {
            "name": "paidDay",
            "docs": [
              "Local delivery day the paid counter below belongs to."
            ],
            "type": "i64"
          },
          {
            "name": "sealMint",
            "docs": [
              "Genesis Token mint behind this letterbox, or the default key if unverified."
            ],
            "type": "pubkey"
          },
          {
            "name": "received",
            "type": "u32"
          },
          {
            "name": "opened",
            "type": "u32"
          },
          {
            "name": "utcOffsetMinutes",
            "type": "i16"
          },
          {
            "name": "paidCount",
            "type": "u8"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "letterboxVerified",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "sgtMint",
            "type": "pubkey"
          },
          {
            "name": "memberNumber",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "postOffice",
      "docs": [
        "The one account that holds the post office's terms. Opened once by the",
        "program's upgrade authority."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "postageMint",
            "docs": [
              "The token postage is paid in. SKR on mainnet."
            ],
            "type": "pubkey"
          },
          {
            "name": "sgtGroup",
            "docs": [
              "Token-2022 group every Seeker Genesis Token is a member of."
            ],
            "type": "pubkey"
          },
          {
            "name": "sgtMintAuthority",
            "docs": [
              "Mint authority shared by every Seeker Genesis Token."
            ],
            "type": "pubkey"
          },
          {
            "name": "floorPrice",
            "docs": [
              "Lowest postage a paid card can carry, in base units."
            ],
            "type": "u64"
          },
          {
            "name": "expressFee",
            "docs": [
              "Burned when a card is sent express, in base units."
            ],
            "type": "u64"
          },
          {
            "name": "burnBps",
            "docs": [
              "Share of postage burned when a card is opened."
            ],
            "type": "u16"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "seal",
      "docs": [
        "One seal per Seeker Genesis Token. It follows the token, so moving the token",
        "to another wallet never buys a second free stamp."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "sgtMint",
            "type": "pubkey"
          },
          {
            "name": "holder",
            "type": "pubkey"
          },
          {
            "name": "memberNumber",
            "type": "u64"
          },
          {
            "name": "lastFreeDay",
            "docs": [
              "UTC day the free stamp was last used."
            ],
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "terms",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "floorPrice",
            "type": "u64"
          },
          {
            "name": "expressFee",
            "type": "u64"
          },
          {
            "name": "burnBps",
            "type": "u16"
          }
        ]
      }
    }
  ],
  "constants": [
    {
      "name": "cardSeed",
      "type": "bytes",
      "value": "[99, 97, 114, 100]"
    },
    {
      "name": "letterboxSeed",
      "type": "bytes",
      "value": "[108, 101, 116, 116, 101, 114, 98, 111, 120]"
    },
    {
      "name": "postOfficeSeed",
      "type": "bytes",
      "value": "[112, 111, 115, 116, 95, 111, 102, 102, 105, 99, 101]"
    },
    {
      "name": "sealSeed",
      "type": "bytes",
      "value": "[115, 101, 97, 108]"
    },
    {
      "name": "vaultSeed",
      "type": "bytes",
      "value": "[118, 97, 117, 108, 116]"
    }
  ]
};
