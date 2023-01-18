import { initializeKeypair } from "./initializeKeypair"
import * as web3 from "@solana/web3.js"
import * as token from "@solana/spl-token"
import {
  Metaplex,
  keypairIdentity,
  bundlrStorage,
  toMetaplexFile,
} from "@metaplex-foundation/js"
import {
  DataV2,
  createCreateMetadataAccountV2Instruction,
  createUpdateMetadataAccountV2Instruction,
} from "@metaplex-foundation/mpl-token-metadata"
import  * as fs from 'fs'


// 1. create new mint account function
async function createNewMint(
  connection: web3.Connection,
  payer: web3.Keypair,
  mintAuthority: web3.PublicKey,
  freezeAuthority: web3.PublicKey,
  decimals: number
): Promise<web3.PublicKey> {
  const tokenMint = await token.createMint(
    connection,
    payer,
    mintAuthority,
    freezeAuthority,
    decimals
  );

  console.log(`The token mint address is ${tokenMint}`)
  console.log(
        `Token Mint: https://explorer.solana.com/address/${tokenMint}?cluster=devnet`
    );

  return tokenMint
}


// 2. Create token account
async function createTokenAccount(
  connection: web3.Connection,
  payer: web3.Keypair,
  mint: web3.PublicKey,
  owner: web3.PublicKey
) {
  const tokenAccount = await token.getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    owner
  )
  console.log(
        `Token Account: https://explorer.solana.com/address/${tokenAccount.address}?cluster=devnet`
    )
  
  return tokenAccount
}


// 3. Create the mint function
async function mintTokens(
  connection: web3.Connection,
  payer: web3.Keypair,
  mint: web3.PublicKey,
  destination: web3.PublicKey,
  authority: web3.Keypair,
  amount: number 
) {
  const mintInfo = await token.getMint(connection, mint)

  const transactionSignature = await token.mintTo(
    connection,
    payer,
    mint,
    destination,
    authority,
    amount * 10 ** mintInfo.decimals
  )

  console.log(
    `Mint Token Transaction: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
  )
}


// Transferring tokens

async function transferTokens(
  connection: web3.Connection,
  payer: web3.Keypair,
  source: web3.PublicKey,
  destination: web3.PublicKey,
  owner: web3.PublicKey,
  amount: number,
  mint: web3.PublicKey
) {
  const mintInfo = await token.getMint(connection, mint)

  const transactionSignature = await token.transfer(
    connection,
    payer,
    source,
    destination,
    owner,
    amount * 10 ** mintInfo.decimals
  )

  console.log(
    `Transfer Transaction: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
  )
}


// burn token function
async function burnTokens(
  connection: web3.Connection,
  payer: web3.Keypair,
  account: web3.PublicKey,
  mint: web3.PublicKey,
  owner: web3.Keypair,
  amount: number
) {
  const mintInfo = await token.getMint(connection, mint)

  const transactionSignature = await token.burn(
    connection,
    payer,
    account,
    mint,
    owner,
    amount * 10 ** mintInfo.decimals
  )

  console.log(
        `Burn Transaction: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
    )
}

// Metaplex
async function createTokenMetadata(
  connection: web3.Connection,
  metaplex: Metaplex,
  mint: web3.PublicKey,
  user: web3.Keypair,
  name: string,
  symbol: string,
  description: string
) {
  // file to buffer
  const buffer = fs.readFileSync('assets/img/jte-logo.png')

  // buffer to metaplex file
  const file = toMetaplexFile(buffer, 'jte-logo.png')

  // upload image and get image uri
  const imageUri = await metaplex.storage().upload(file)
  console.log('image uri: ', imageUri)

  // upload metadata and get the metadata uri (off chain metadata)
  const { uri } = await metaplex
    .nfts()
    .uploadMetadata({
      name: name,
      description: description,
      image: imageUri
    })

    console.log("metadata uri: ", uri)

    // get metadata account address
    const metadataPDA = metaplex.nfts().pdas().metadata({mint})

    // onchain metadata format
    const tokenMetadata = {
      name: name,
      symbol: symbol,
      uri: uri,
      sellerFeeBasisPoints: 0,
      creators: null,
      collection: null,
      uses: null
    } as DataV2

    // transaction to create metadata account CHANGE ME TO UPDATE
    const transaction = new web3.Transaction().add(
      createCreateMetadataAccountV2Instruction(
        {
          metadata: metadataPDA,
          mint: mint,
          mintAuthority: user.publicKey,
          payer: user.publicKey,
          updateAuthority: user.publicKey
        },
        {
          createMetadataAccountArgsV2: {
            data: tokenMetadata,
            isMutable: true
          },
        }
      )
    )

    // send transaction
    const transactionSignature = await web3.sendAndConfirmTransaction(
      connection, transaction, [user]
    )

    console.log(
    `Create Metadata Account: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
    )
}





async function main() {
  const connection = new web3.Connection(web3.clusterApiUrl("devnet"))
  const user = await initializeKeypair(connection)

  console.log("PublicKey:", user.publicKey.toBase58())

  // meta plex stuff, usually comes later
  const MINT_ADDRESS = 'NB8Cy83SxoP16ZErnSHeWnMY48hmiUVMZKiPrHAq1aJ'

  // actual metaplex setup
  const metaplex = Metaplex.make(connection)
    .use(keypairIdentity(user))
    .use(
      bundlrStorage({
        address: "https://devnet.bundlr.network",
        providerUrl: "https://api.devnet.solana.com",
        timeout: 60000 // 1 minute
      })
    )

    // calling the token
    await createTokenMetadata(
      connection,
      metaplex,
      new web3.PublicKey(MINT_ADDRESS),
      user,
      "JTECoin", // TOKEN NAME
      "JTC", // TOKEN SYMBOL
      "With great token, comes great responsibility." // TOKEN DESCRIPTION
    )

  // TO UPDATE SEE THE VERY LAST FUNCTION BELOW
  // END OF METAPLEX SECTION



  // const mint = await createNewMint(
  //   connection,
  //   user,           // This account pays the fees
  //   user.publicKey, // This account is the mint authority
  //   user.publicKey, // And also the freeze authority
  //   2               // Only 2 decimals?
  // )

  const mint = new web3.PublicKey('NB8Cy83SxoP16ZErnSHeWnMY48hmiUVMZKiPrHAq1aJ')
  // const tokenAccount = await createTokenAccount(
  //   connection,
  //   user,
  //   mint,
  //   user.publicKey // Associating our address with the token account
  // )

  // mint 100 tokens to our address
  // await mintTokens(connection, user, mint, tokenAccount.address, user, 100)


  // using transfer and burn functions
  // const receiver = new web3.PublicKey("6ct2dvUxb7d8bR7N2f5w9Dc2MPtAdVHt2RoVituXfEG")

  // const receiverTokenAccount = await createTokenAccount(
  //   connection,
  //   user,
  //   mint,
  //   receiver // owner
  // )

  // await transferTokens(
  //   connection,
  //   user,
  //   tokenAccount.address,
  //   receiverTokenAccount.address,
  //   user.publicKey,
  //   50,
  //   mint
  // )

  // await burnTokens(connection, user, tokenAccount.address, mint, user, 25)
}

main()
  .then(() => {
    console.log("Finished successfully")
    process.exit(0)
  })
  .catch((error) => {
    console.log(error)
    process.exit(1)
  })




  // One of the coolest parts of the token metadata program is how easy it is to update.
  // All you need to do is change the transaction from createCreateMetadataAccountV2Instruction
  // to createUpdateMetadataAccountV2Instruction

  // VERY LAST FUNCTION
  // adapt accordingly
  

  // async function updateTokenMetadata(
  //   connection: web3.Connection,
  //   metaplex: Metaplex,
  //   mint: web3.PublicKey,
  //   user: web3.Keypair,
  //   name: string,
  //   symbol: string,
  //   description: string
  // ) {
  
  //   ... 
    
  //   // transaction to update metadata account
  //   const transaction = new web3.Transaction().add(
  //     createUpdateMetadataAccountV2Instruction(
  //       {
  //         metadata: metadataPDA,
  //         updateAuthority: user.publicKey,
  //       },
  //       {
  //         updateMetadataAccountArgsV2: {
  //           data: tokenMetadata,
  //           updateAuthority: user.publicKey,
  //           primarySaleHappened: true,
  //           isMutable: true,
  //         },
  //       }
  //     )
  //   )
    
  //   // Everything else remains the same
  //   ...
  // }



  // Shipping challenge
  // https://buildspace.so/p/solana-core/lessons/give-your-token-an-identity#:~:text=%F0%9F%9A%A2-,Ship%20challenge,-Young%20glass%20chewer